import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatEta,
  mapYtDlpError,
  parseMetadataAndFormats,
  parseYtDlpProgressLine,
  sanitizeFilename,
  validateYouTubeUrl,
} from '../src/utils/youtube.js';

test('validateYouTubeUrl accepts standard, shortlink, and shorts URLs', () => {
  const watch = validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s');
  assert.equal(watch.valid, true);
  assert.equal(watch.videoId, 'dQw4w9WgXcQ');
  assert.equal(watch.kind, 'watch');
  assert.equal(watch.normalizedUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  const shortlink = validateYouTubeUrl('https://youtu.be/jNQXAC9IVRw?si=abc');
  assert.equal(shortlink.valid, true);
  assert.equal(shortlink.videoId, 'jNQXAC9IVRw');
  assert.equal(shortlink.kind, 'shortlink');

  const shorts = validateYouTubeUrl('youtube.com/shorts/aqz-KE-bpKQ');
  assert.equal(shorts.valid, true);
  assert.equal(shorts.videoId, 'aqz-KE-bpKQ');
  assert.equal(shorts.kind, 'shorts');
});

test('validateYouTubeUrl rejects invalid or non-YouTube URLs', () => {
  assert.equal(validateYouTubeUrl('').valid, false);
  assert.equal(validateYouTubeUrl('https://vimeo.com/123456').valid, false);
  assert.equal(validateYouTubeUrl('https://youtube.com/watch?v=short').valid, false);
});

test('parseMetadataAndFormats extracts MP4 resolutions and MP3 bitrates with sizes', () => {
  const sampleInfo = {
    id: 'dQw4w9WgXcQ',
    title: 'Sample Video',
    channel: 'Sample Channel',
    duration: 200,
    view_count: 1500000,
    upload_date: '20250115',
    thumbnails: [
      { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg', width: 120, height: 90 },
      { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', width: 1280, height: 720 },
    ],
    formats: [
      { format_id: '140', ext: 'm4a', acodec: 'mp4a.40.2', vcodec: 'none', abr: 128, filesize: 3200000 },
      { format_id: '137', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 1080, fps: 60, filesize: 50000000 },
      { format_id: '136', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 720, fps: 30, filesize: 25000000 },
    ],
  };

  const parsed = parseMetadataAndFormats(sampleInfo);
  assert.equal(parsed.id, 'dQw4w9WgXcQ');
  assert.equal(parsed.thumbnail, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  assert.equal(parsed.formats.mp4.length, 2);
  assert.equal(parsed.formats.mp4[0].label, '1080p');
  assert.equal(parsed.formats.mp4[0].badge, 'HD');
  assert.equal(parsed.formats.mp4[0].fps, 60);
  assert.equal(parsed.formats.mp4[0].estimatedBytes, 53200000);
  assert.equal(parsed.formats.mp3.length, 3);
  assert.equal(parsed.formats.mp3[0].quality, 320);
  assert.equal(parsed.formats.mp3[0].estimatedBytes, 8000000);
});

test('parseYtDlpProgressLine parses download progress and ffmpeg stage', () => {
  const dl = parseYtDlpProgressLine('PROG|downloading| 42.5%|4250000|10000000|10000000|2097152|15');
  assert.equal(dl.status, 'downloading');
  assert.equal(dl.percent, 42.5);
  assert.equal(dl.speed, '2.0 MB/s');
  assert.equal(dl.eta, '00:15');

  const conv = parseYtDlpProgressLine('[ExtractAudio] Destination: track.mp3');
  assert.equal(conv.status, 'processing');
  assert.equal(conv.percent, 97);
});

test('mapYtDlpError maps private, unavailable, and missing binary errors', () => {
  assert.equal(mapYtDlpError('ERROR: Private video. Sign in if you have been granted access').status, 403);
  assert.equal(mapYtDlpError('ERROR: Video unavailable').status, 404);
  assert.equal(mapYtDlpError('spawn yt-dlp ENOENT').code, 'YTDLP_MISSING');
});

test('formatting helpers behave accurately', () => {
  assert.equal(formatBytes(1024 * 1024 * 15.5), '15.5 MB');
  assert.equal(formatEta(125), '02:05');
  assert.equal(sanitizeFilename('Hello: World? / Test*'), 'Hello World Test');
});
