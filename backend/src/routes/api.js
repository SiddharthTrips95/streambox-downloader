import { Router } from 'express';
import fs from 'node:fs';
import { validateYouTubeUrl } from '../utils/youtube.js';
import {
  cancelJob,
  checkDependencies,
  cleanupJob,
  createDownloadJob,
  fetchVideoInfo,
  getJob,
} from '../services/ytdlp.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const deps = await checkDependencies();
  res.json({
    ok: true,
    dependencies: deps,
    ready: deps.ytDlp.available && deps.ffmpeg.available,
  });
});

router.get('/info', async (req, res) => {
  const rawUrl = String(req.query.url || '');
  const validation = validateYouTubeUrl(rawUrl);

  if (!validation.valid) {
    return res.status(400).json({
      code: 'INVALID_URL',
      message: validation.error,
    });
  }

  try {
    const metadata = await fetchVideoInfo(validation.normalizedUrl);
    return res.json(metadata);
  } catch (err) {
    return res.status(err.status || 500).json({
      code: err.code || 'FETCH_FAILED',
      message: err.message || 'Failed to fetch video metadata.',
    });
  }
});

router.post('/downloads', async (req, res) => {
  const { url, format = 'mp4', quality = 1080, title } = req.body || {};
  const validation = validateYouTubeUrl(String(url || ''));

  if (!validation.valid) {
    return res.status(400).json({
      code: 'INVALID_URL',
      message: validation.error,
    });
  }

  const normalizedFormat = format === 'mp3' ? 'mp3' : 'mp4';

  try {
    const job = await createDownloadJob({
      url: validation.normalizedUrl,
      format: normalizedFormat,
      quality: Number(quality),
      title,
    });

    return res.status(201).json({
      jobId: job.id,
      status: job.state.status,
    });
  } catch {
    return res.status(500).json({
      code: 'JOB_CREATE_FAILED',
      message: 'Failed to initialize download job.',
    });
  }
});

router.get('/downloads/:jobId/events', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      code: 'JOB_NOT_FOUND',
      message: 'Download job not found or expired.',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Emit current state immediately so late subscribers sync up
  sendEvent(job.state);

  if (job.state.status === 'completed' || job.state.status === 'error') {
    res.end();
    return;
  }

  const onUpdate = (state) => {
    sendEvent(state);
    if (state.status === 'completed' || state.status === 'error') {
      job.emitter.off('update', onUpdate);
      res.end();
    }
  };

  job.emitter.on('update', onUpdate);

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    job.emitter.off('update', onUpdate);
  });
});

router.get('/downloads/:jobId/file', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job || job.state.status !== 'completed' || !job.filePath) {
    return res.status(404).json({
      code: 'FILE_NOT_READY',
      message: 'File is not ready or has expired.',
    });
  }

  const filename = job.filename || `download.${job.format}`;
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
  const encodedName = encodeURIComponent(filename);

  res.setHeader(
    'Content-Type',
    job.format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`,
  );
  if (job.fileSize) {
    res.setHeader('Content-Length', String(job.fileSize));
  }

  const stream = fs.createReadStream(job.filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ code: 'STREAM_ERROR', message: 'Failed to stream file.' });
    }
  });

  res.on('finish', () => {
    // Clean up temporary directory right after successful transfer
    cleanupJob(job.id).catch(() => {});
  });

  stream.pipe(res);
});

router.delete('/downloads/:jobId', async (req, res) => {
  const cancelled = await cancelJob(req.params.jobId);
  res.json({ cancelled });
});

export default router;
