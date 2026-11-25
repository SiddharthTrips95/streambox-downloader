const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

/**
 * Real-time client validation for YouTube watch, shortlink, Shorts, live, and embed URLs.
 * @param {string} rawUrl
 */
export function validateYouTubeUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) {
    return { valid: false, empty: true, error: null, kind: null };
  }

  const trimmed = rawUrl.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      valid: false,
      empty: false,
      error: 'Enter a valid YouTube link (youtube.com/watch?v=..., youtu.be/..., or Shorts).',
      kind: null,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return {
      valid: false,
      empty: false,
      error: 'Only YouTube links (youtube.com, youtu.be, Shorts) are supported.',
      kind: null,
    };
  }

  let videoId = '';
  let kind = 'Video';
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    videoId = segments[0] || '';
    kind = 'Short Link';
  } else if (segments[0] === 'watch') {
    videoId = parsed.searchParams.get('v') || '';
    kind = 'YouTube Video';
  } else if (segments[0] === 'shorts' && segments[1]) {
    videoId = segments[1];
    kind = 'YouTube Shorts';
  } else if (segments[0] === 'live' && segments[1]) {
    videoId = segments[1];
    kind = 'YouTube Live';
  } else if (segments[0] === 'embed' && segments[1]) {
    videoId = segments[1];
    kind = 'Embedded Video';
  } else if (parsed.searchParams.has('v')) {
    videoId = parsed.searchParams.get('v') || '';
    kind = 'YouTube Video';
  }

  if (!YOUTUBE_ID_REGEX.test(videoId)) {
    return {
      valid: false,
      empty: false,
      error: 'Missing or incomplete 11-character YouTube video ID.',
      kind: null,
    };
  }

  return {
    valid: true,
    empty: false,
    videoId,
    kind,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    error: null,
  };
}

export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
}

export function formatViewCount(count) {
  if (!Number.isFinite(count) || count < 0) return null;
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B views`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${count} views`;
}

export function formatUploadDate(yyyymmdd) {
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return null;
  const str = String(yyyymmdd);
  const date = new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  const decimals = i <= 1 ? 0 : val >= 100 ? 0 : 1;
  return `${val.toFixed(decimals)} ${units[i]}`;
}

export function formatRelativeTime(timestamp) {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
