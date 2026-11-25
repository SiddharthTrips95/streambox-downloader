/**
 * YouTube URL validation, format extraction, error mapping, and yt-dlp progress parsing.
 */

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const STANDARD_MP4_HEIGHTS = [
  { height: 2160, label: '2160p', badge: '4K' },
  { height: 1440, label: '1440p', badge: 'QHD' },
  { height: 1080, label: '1080p', badge: 'HD' },
  { height: 720, label: '720p', badge: 'HD' },
  { height: 480, label: '480p', badge: 'SD' },
  { height: 360, label: '360p', badge: '' },
];

const MP3_BITRATES = [
  { bitrate: 320, label: '320 kbps', tier: 'Studio' },
  { bitrate: 192, label: '192 kbps', tier: 'High' },
  { bitrate: 128, label: '128 kbps', tier: 'Standard' },
];

/**
 * Validate a YouTube URL (standard watch, youtu.be, Shorts, live, embed)
 * and normalize it to a canonical watch URL.
 * @param {string} rawUrl
 * @returns {{ valid: boolean, videoId?: string, normalizedUrl?: string, kind?: string, error?: string }}
 */
export function validateYouTubeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, error: 'Please paste a YouTube link.' };
  }

  const trimmed = rawUrl.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { valid: false, error: 'Invalid URL format. Check the link and try again.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return {
      valid: false,
      error: 'Unsupported URL. Enter a youtube.com, youtu.be, or YouTube Shorts link.',
    };
  }

  let videoId = '';
  let kind = 'video';
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    videoId = segments[0] || '';
    kind = 'shortlink';
  } else if (segments[0] === 'watch') {
    videoId = parsed.searchParams.get('v') || '';
    kind = 'watch';
  } else if (segments[0] === 'shorts' && segments[1]) {
    videoId = segments[1];
    kind = 'shorts';
  } else if (segments[0] === 'live' && segments[1]) {
    videoId = segments[1];
    kind = 'live';
  } else if (segments[0] === 'embed' && segments[1]) {
    videoId = segments[1];
    kind = 'embed';
  } else if (parsed.searchParams.has('v')) {
    videoId = parsed.searchParams.get('v') || '';
    kind = 'watch';
  }

  if (!YOUTUBE_ID_REGEX.test(videoId)) {
    return {
      valid: false,
      error: 'Could not find a valid YouTube video ID in this link.',
    };
  }

  return {
    valid: true,
    videoId,
    kind,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/**
 * Format bytes into human-readable string (e.g. "42.8 MB").
 * @param {number | null | undefined} bytes
 * @returns {string | null}
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  const decimals = unitIdx <= 1 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIdx]}`;
}

/**
 * Estimate byte size of a yt-dlp format object.
 * @param {object} fmt
 * @param {number} durationSeconds
 * @returns {number}
 */
function estimateFormatBytes(fmt, durationSeconds) {
  if (!fmt) return 0;
  if (Number.isFinite(fmt.filesize) && fmt.filesize > 0) return fmt.filesize;
  if (Number.isFinite(fmt.filesize_approx) && fmt.filesize_approx > 0) return fmt.filesize_approx;
  const bitrateKbps = Number(fmt.tbr || fmt.vbr || fmt.abr || 0);
  if (bitrateKbps > 0 && durationSeconds > 0) {
    return Math.round((bitrateKbps * 1000 * durationSeconds) / 8);
  }
  return 0;
}

/**
 * Pick the best thumbnail URL from yt-dlp info JSON.
 * @param {object} info
 * @returns {string}
 */
function selectBestThumbnail(info) {
  if (Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
    const sorted = [...info.thumbnails]
      .filter((t) => t?.url)
      .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
    const preferred = sorted.find((t) => !t.url.includes('.webp')) || sorted[0];
    if (preferred?.url) return preferred.url;
  }
  return info.thumbnail || '';
}

/**
 * Extract normalized video metadata and available MP4/MP3 quality options from yt-dlp -J JSON.
 * @param {object} info
 * @returns {object}
 */
export function parseMetadataAndFormats(info) {
  const duration = Number(info.duration || 0);
  const formats = Array.isArray(info.formats) ? info.formats : [];

  const audioFormats = formats
    .filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
    .sort((a, b) => {
      const aScore = (a.ext === 'm4a' ? 20 : 0) + (Number(a.abr || a.tbr || 0));
      const bScore = (b.ext === 'm4a' ? 20 : 0) + (Number(b.abr || b.tbr || 0));
      return bScore - aScore;
    });

  const bestAudio = audioFormats[0] || null;
  const bestAudioBytes = estimateFormatBytes(bestAudio, duration) || (duration > 0 ? Math.round((128 * 1000 * duration) / 8) : 0);

  const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none' && Number(f.height) > 0);
  const maxAvailableHeight = videoFormats.reduce((max, f) => Math.max(max, Number(f.height || 0)), 0);

  const mp4Options = [];
  for (const preset of STANDARD_MP4_HEIGHTS) {
    if (preset.height > maxAvailableHeight && maxAvailableHeight > 0) continue;

    const matchingStreams = videoFormats.filter((f) => Number(f.height) === preset.height);
    if (matchingStreams.length === 0) continue;

    // Prefer MP4/H.264/H.265/AV1 streams with known size or highest tbr
    matchingStreams.sort((a, b) => {
      const aMp4 = a.ext === 'mp4' ? 1 : 0;
      const bMp4 = b.ext === 'mp4' ? 1 : 0;
      if (aMp4 !== bMp4) return bMp4 - aMp4;
      return Number(b.tbr || 0) - Number(a.tbr || 0);
    });

    const chosen = matchingStreams[0];
    const hasMuxedAudio = chosen.acodec && chosen.acodec !== 'none';
    const videoBytes = estimateFormatBytes(chosen, duration);
    const totalBytes = videoBytes > 0 ? videoBytes + (hasMuxedAudio ? 0 : bestAudioBytes) : 0;

    mp4Options.push({
      id: String(preset.height),
      quality: preset.height,
      label: preset.label,
      badge: preset.badge,
      fps: chosen.fps ? Math.round(chosen.fps) : null,
      estimatedBytes: totalBytes || null,
      estimatedSize: formatBytes(totalBytes) || 'Variable',
    });
  }

  // Fallback if non-standard heights exist (e.g., portrait Shorts like 1920x1080 where height=1920 or 1280x720)
  if (mp4Options.length === 0 && videoFormats.length > 0) {
    const seenHeights = new Set();
    const sorted = [...videoFormats].sort((a, b) => Number(b.height) - Number(a.height));
    for (const f of sorted) {
      const h = Number(f.height);
      if (seenHeights.has(h)) continue;
      seenHeights.add(h);
      const hasMuxedAudio = f.acodec && f.acodec !== 'none';
      const totalBytes = estimateFormatBytes(f, duration) + (hasMuxedAudio ? 0 : bestAudioBytes);
      mp4Options.push({
        id: String(h),
        quality: h,
        label: `${h}p`,
        badge: h >= 2160 ? '4K' : h >= 720 ? 'HD' : '',
        fps: f.fps ? Math.round(f.fps) : null,
        estimatedBytes: totalBytes || null,
        estimatedSize: formatBytes(totalBytes) || 'Variable',
      });
      if (mp4Options.length >= 6) break;
    }
  }

  const mp3Options = MP3_BITRATES.map((item) => {
    const estBytes = duration > 0 ? Math.round((item.bitrate * 1000 * duration) / 8) : 0;
    return {
      id: String(item.bitrate),
      quality: item.bitrate,
      label: item.label,
      badge: item.tier,
      estimatedBytes: estBytes || null,
      estimatedSize: formatBytes(estBytes) || 'Variable',
    };
  });

  return {
    id: info.id,
    title: info.title || 'Untitled Video',
    channel: info.channel || info.uploader || 'Unknown Channel',
    channelUrl: info.channel_url || info.uploader_url || null,
    thumbnail: selectBestThumbnail(info),
    duration,
    viewCount: Number.isFinite(info.view_count) ? info.view_count : null,
    uploadDate: info.upload_date || null,
    isLive: Boolean(info.is_live),
    webpageUrl: info.webpage_url || `https://www.youtube.com/watch?v=${info.id}`,
    formats: {
      mp4: mp4Options,
      mp3: mp3Options,
    },
  };
}

/**
 * Translate raw yt-dlp/system error output into structured HTTP status & user-friendly error.
 * @param {string} stderr
 * @returns {{ status: number, code: string, message: string }}
 */
export function mapYtDlpError(stderr = '') {
  const text = String(stderr);
  const lower = text.toLowerCase();

  if (lower.includes('enoent') || lower.includes('not recognized') || lower.includes('not found')) {
    if (lower.includes('ffmpeg')) {
      return {
        status: 503,
        code: 'FFMPEG_MISSING',
        message: 'FFmpeg is not installed on the server. Install ffmpeg and restart the backend.',
      };
    }
    return {
      status: 503,
      code: 'YTDLP_MISSING',
      message: 'yt-dlp is not installed on the server. Install yt-dlp and restart the backend.',
    };
  }
  if (lower.includes('private video') || lower.includes('this video is private')) {
    return {
      status: 403,
      code: 'PRIVATE_VIDEO',
      message: 'This video is private and cannot be downloaded.',
    };
  }
  if (lower.includes('members-only') || lower.includes('join this channel')) {
    return {
      status: 403,
      code: 'MEMBERS_ONLY',
      message: 'This video is restricted to channel members.',
    };
  }
  if (lower.includes('sign in to confirm your age') || lower.includes('age-restricted')) {
    return {
      status: 403,
      code: 'AGE_RESTRICTED',
      message: 'This video is age-restricted and requires authentication.',
    };
  }
  if (lower.includes('video unavailable') || lower.includes('has been removed') || lower.includes('account associated with this video has been terminated')) {
    return {
      status: 404,
      code: 'UNAVAILABLE',
      message: 'This video is unavailable or has been removed by YouTube.',
    };
  }
  if (lower.includes('copyright')) {
    return {
      status: 404,
      code: 'COPYRIGHT_BLOCKED',
      message: 'This video is unavailable due to a copyright claim.',
    };
  }
  if (lower.includes('not available in your country') || lower.includes('geo-restricted')) {
    return {
      status: 403,
      code: 'GEO_RESTRICTED',
      message: 'This video is geo-restricted in the server region.',
    };
  }
  if (lower.includes('incomplete youtube id') || lower.includes('is not a valid url')) {
    return {
      status: 400,
      code: 'INVALID_URL',
      message: 'The provided YouTube URL is invalid.',
    };
  }

  return {
    status: 500,
    code: 'FETCH_FAILED',
    message: 'Could not process this YouTube video. Verify the link or try again shortly.',
  };
}

/**
 * Parse a single stdout/stderr line from yt-dlp with custom progress template:
 * `PROG|<status>|<percent_str>|<downloaded_bytes>|<total_bytes>|<total_bytes_estimate>|<speed>|<eta>`
 * @param {string} line
 * @returns {object | null}
 */
export function parseYtDlpProgressLine(line) {
  if (!line || typeof line !== 'string') return null;
  const trimmed = line.trim();

  if (trimmed.startsWith('PROG|')) {
    const [, status, percentStr, downloadedRaw, totalRaw, estRaw, speedRaw, etaRaw] = trimmed.split('|');

    const downloaded = Number(downloadedRaw);
    const total = Number(totalRaw) || Number(estRaw) || 0;
    let percent = parseFloat(String(percentStr || '').replace('%', '').trim());
    if (!Number.isFinite(percent) && downloaded > 0 && total > 0) {
      percent = (downloaded / total) * 100;
    }
    if (!Number.isFinite(percent)) percent = 0;
    percent = Math.max(0, Math.min(100, Number(percent.toFixed(1))));

    const speedBytes = Number(speedRaw);
    const speedText = Number.isFinite(speedBytes) && speedBytes > 0
      ? `${formatBytes(speedBytes)}/s`
      : null;

    const etaSeconds = Number(etaRaw);
    const etaText = Number.isFinite(etaSeconds) && etaSeconds >= 0
      ? formatEta(etaSeconds)
      : null;

    if (status === 'finished') {
      return {
        status: 'processing',
        percent: 96,
        speed: null,
        eta: '00:00',
        stageLabel: 'Finalizing stream...',
      };
    }

    return {
      status: 'downloading',
      percent: Math.min(percent, 95),
      speed: speedText,
      eta: etaText,
      downloadedBytes: Number.isFinite(downloaded) ? downloaded : null,
      totalBytes: total > 0 ? total : null,
      stageLabel: 'Downloading stream...',
    };
  }

  if (trimmed.includes('[ExtractAudio]') || trimmed.includes('[ffmpeg]')) {
    return {
      status: 'processing',
      percent: 97,
      speed: null,
      eta: null,
      stageLabel: 'Converting audio with FFmpeg...',
    };
  }

  if (trimmed.includes('[Merger]')) {
    return {
      status: 'processing',
      percent: 97,
      speed: null,
      eta: null,
      stageLabel: 'Merging video & audio...',
    };
  }

  return null;
}

/**
 * Format seconds into MM:SS or HH:MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatEta(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

/**
 * Sanitize a string for safe filesystem usage and HTTP Content-Disposition headers.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  return String(name || 'video')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'video';
}
