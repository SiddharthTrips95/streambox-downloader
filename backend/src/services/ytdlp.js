import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import ffmpegStaticPath from 'ffmpeg-static';
import {
  mapYtDlpError,
  parseMetadataAndFormats,
  parseYtDlpProgressLine,
  sanitizeFilename,
} from '../utils/youtube.js';

const PROGRESS_TEMPLATE =
  'download:PROG|%(progress.status)s|%(progress._percent_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s';

const jobs = new Map();
const JOB_TTL_MS = 15 * 60 * 1000;

let cachedYtDlpBin = null;
let cachedFfmpegBin = null;

/**
 * Search common Windows install directories (Winget, Chocolatey, Python Scripts, C:\ffmpeg)
 * so binaries work even before a terminal PATH refresh.
 * @param {string} exeName
 * @returns {string | null}
 */
function findWindowsBinary(exeName) {
  if (process.platform !== 'win32') return null;

  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  const programData = process.env.ProgramData || 'C:\\ProgramData';
  const candidates = [
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links', exeName),
    path.join(programData, 'chocolatey', 'bin', exeName),
    path.join('C:\\ffmpeg\\bin', exeName),
    path.join('C:\\yt-dlp', exeName),
  ];

  for (const p of candidates) {
    if (p && fsSync.existsSync(p)) return p;
  }

  // Scan Winget Packages directory (up to 2 levels deep)
  const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fsSync.existsSync(wingetPackages)) {
    try {
      for (const pkgDir of fsSync.readdirSync(wingetPackages)) {
        const fullPkgDir = path.join(wingetPackages, pkgDir);
        const direct = path.join(fullPkgDir, exeName);
        if (fsSync.existsSync(direct)) return direct;

        try {
          for (const sub of fsSync.readdirSync(fullPkgDir)) {
            const nested = path.join(fullPkgDir, sub, exeName);
            if (fsSync.existsSync(nested)) return nested;
            const nestedBin = path.join(fullPkgDir, sub, 'bin', exeName);
            if (fsSync.existsSync(nestedBin)) return nestedBin;
          }
        } catch {
          // Not a directory
        }
      }
    } catch {
      // Ignore permission/read errors
    }
  }

  // Scan Python user/local Scripts folders for pip-installed yt-dlp.exe
  const pythonBases = [
    path.join(localAppData, 'Programs', 'Python'),
    path.join(appData, 'Python'),
  ];
  for (const base of pythonBases) {
    if (!fsSync.existsSync(base)) continue;
    try {
      for (const pyDir of fsSync.readdirSync(base)) {
        const scriptExe = path.join(base, pyDir, 'Scripts', exeName);
        if (fsSync.existsSync(scriptExe)) return scriptExe;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Check if a binary executes successfully.
 * @param {string} bin
 * @param {string[]} args
 * @returns {Promise<{ available: boolean, version: string | null }>}
 */
function checkBinary(bin, args = ['--version']) {
  return new Promise((resolve) => {
    let stdout = '';
    const child = spawn(bin, args, { windowsHide: true });
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('error', () => resolve({ available: false, version: null }));
    child.on('close', (code) => {
      if (code === 0) {
        const firstLine = stdout.split(/\r?\n/)[0]?.trim() || 'installed';
        resolve({ available: true, version: firstLine });
      } else {
        resolve({ available: false, version: null });
      }
    });
  });
}

async function resolveYtDlpBin() {
  if (process.env.YT_DLP_PATH?.trim()) {
    return process.env.YT_DLP_PATH.trim();
  }
  if (cachedYtDlpBin) return cachedYtDlpBin;

  const pathCheck = await checkBinary('yt-dlp', ['--version']);
  if (pathCheck.available) {
    cachedYtDlpBin = 'yt-dlp';
    return cachedYtDlpBin;
  }

  const winBin = findWindowsBinary('yt-dlp.exe');
  if (winBin) {
    cachedYtDlpBin = winBin;
    return cachedYtDlpBin;
  }

  return 'yt-dlp';
}

async function resolveFfmpegBin() {
  if (process.env.FFMPEG_PATH?.trim()) {
    return process.env.FFMPEG_PATH.trim();
  }
  if (cachedFfmpegBin) return cachedFfmpegBin;

  const pathCheck = await checkBinary('ffmpeg', ['-version']);
  if (pathCheck.available) {
    cachedFfmpegBin = 'ffmpeg';
    return cachedFfmpegBin;
  }

  const winBin = findWindowsBinary('ffmpeg.exe');
  if (winBin) {
    cachedFfmpegBin = winBin;
    return cachedFfmpegBin;
  }

  if (ffmpegStaticPath && fsSync.existsSync(ffmpegStaticPath)) {
    cachedFfmpegBin = ffmpegStaticPath;
    return cachedFfmpegBin;
  }

  return 'ffmpeg';
}

/**
 * Verify yt-dlp and ffmpeg availability on the host.
 */
export async function checkDependencies() {
  const [ytBin, ffBin] = await Promise.all([resolveYtDlpBin(), resolveFfmpegBin()]);
  const [ytDlp, ffmpeg] = await Promise.all([
    checkBinary(ytBin, ['--version']),
    checkBinary(ffBin, ['-version']),
  ]);
  return { ytDlp, ffmpeg };
}

/**
 * Fetch metadata and format list using yt-dlp JSON dump.
 * @param {string} url
 */
export async function fetchVideoInfo(url) {
  const ytBin = await resolveYtDlpBin();

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--skip-download',
      url,
    ];

    const child = spawn(ytBin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(mapYtDlpError(err.message));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(mapYtDlpError(stderr || `yt-dlp exited with code ${code}`));
      }
      try {
        const info = JSON.parse(stdout);
        if (info.is_live) {
          return reject({
            status: 422,
            code: 'LIVE_STREAM',
            message: 'Live streams cannot be downloaded while broadcasting.',
          });
        }
        return resolve(parseMetadataAndFormats(info));
      } catch {
        return reject({
          status: 500,
          code: 'PARSE_ERROR',
          message: 'Failed to parse video metadata from yt-dlp.',
        });
      }
    });
  });
}

/**
 * Create and start a background download job with SSE progress emitter.
 * @param {{ url: string, format: 'mp4' | 'mp3', quality: number, title?: string }} params
 */
export async function createDownloadJob({ url, format, quality, title }) {
  const [ytBin, ffBin] = await Promise.all([resolveYtDlpBin(), resolveFfmpegBin()]);
  const jobId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `yt-bento-${jobId}`);
  await fs.mkdir(tempDir, { recursive: true });

  const safeTitle = sanitizeFilename(title || 'youtube-media');
  const outputTemplate = path.join(tempDir, '%(title).120B.%(ext)s');
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--progress-template',
    PROGRESS_TEMPLATE,
    '-o',
    outputTemplate,
  ];

  if (ffBin && ffBin !== 'ffmpeg') {
    args.push('--ffmpeg-location', path.dirname(ffBin));
  }

  if (format === 'mp3') {
    const bitrate = [320, 192, 128].includes(Number(quality)) ? Number(quality) : 192;
    args.push(
      '-f',
      'bestaudio/best',
      '-x',
      '--audio-format',
      'mp3',
      '--postprocessor-args',
      `ffmpeg:-b:a ${bitrate}k`,
    );
  } else {
    const height = Number(quality) > 0 ? Number(quality) : 1080;
    args.push(
      '-f',
      `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`,
      '--merge-output-format',
      'mp4',
    );
  }

  args.push(url);

  const emitter = new EventEmitter();
  const job = {
    id: jobId,
    url,
    format,
    quality,
    title: safeTitle,
    tempDir,
    emitter,
    process: null,
    cancelled: false,
    filePath: null,
    filename: null,
    fileSize: null,
    state: {
      status: 'starting',
      percent: 0,
      speed: null,
      eta: null,
      stageLabel: 'Initializing download...',
    },
    cleanupTimer: null,
  };

  jobs.set(jobId, job);

  const updateState = (patch) => {
    job.state = { ...job.state, ...patch };
    emitter.emit('update', job.state);
  };

  const scheduleCleanup = () => {
    if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
    job.cleanupTimer = setTimeout(() => {
      cleanupJob(jobId).catch(() => {});
    }, JOB_TTL_MS);
  };

  const child = spawn(ytBin, args, { windowsHide: true });
  job.process = child;

  let stderrBuf = '';
  let lineBuf = '';

  const handleChunk = (chunk) => {
    lineBuf += chunk.toString();
    const lines = lineBuf.split(/\r?\n/);
    lineBuf = lines.pop() || '';
    for (const line of lines) {
      const parsed = parseYtDlpProgressLine(line);
      if (parsed) {
        updateState(parsed);
      }
    }
  };

  child.stdout.on('data', handleChunk);
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrBuf += text;
    handleChunk(chunk);
  });

  child.on('error', (err) => {
    if (job.cancelled) return;
    const mapped = mapYtDlpError(err.message);
    updateState({
      status: 'error',
      error: mapped.message,
      code: mapped.code,
      stageLabel: 'Download failed',
    });
    scheduleCleanup();
  });

  child.on('close', async (code) => {
    job.process = null;
    if (job.cancelled) {
      await cleanupJob(jobId);
      return;
    }

    if (code !== 0) {
      const mapped = mapYtDlpError(stderrBuf || `yt-dlp exited with code ${code}`);
      updateState({
        status: 'error',
        error: mapped.message,
        code: mapped.code,
        stageLabel: 'Download failed',
      });
      scheduleCleanup();
      return;
    }

    try {
      const files = await fs.readdir(tempDir);
      const targetExt = format === 'mp3' ? '.mp3' : '.mp4';
      const outputFile =
        files.find((f) => f.toLowerCase().endsWith(targetExt)) ||
        files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));

      if (!outputFile) {
        throw new Error('Processed media file not found.');
      }

      const fullPath = path.join(tempDir, outputFile);
      const stat = await fs.stat(fullPath);

      job.filePath = fullPath;
      job.filename = `${safeTitle}${path.extname(outputFile) || targetExt}`;
      job.fileSize = stat.size;

      updateState({
        status: 'completed',
        percent: 100,
        speed: null,
        eta: '00:00',
        stageLabel: 'Ready to save',
        filename: job.filename,
        fileSize: stat.size,
      });
      scheduleCleanup();
    } catch {
      updateState({
        status: 'error',
        error: 'Failed to locate the converted output file. Ensure ffmpeg is installed.',
        code: 'OUTPUT_MISSING',
        stageLabel: 'Processing failed',
      });
      scheduleCleanup();
    }
  });

  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export async function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return false;
  job.cancelled = true;
  if (job.process) {
    job.process.kill('SIGTERM');
  }
  await cleanupJob(jobId);
  return true;
}

export async function cleanupJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
  jobs.delete(jobId);
  try {
    await fs.rm(job.tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on already-removed directories
  }
}
