import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, Moon, Sun } from 'lucide-react';
import { HeroInputTile } from './components/HeroInputTile';
import { MediaPreviewTile } from './components/MediaPreviewTile';
import { FormatQualityTile } from './components/FormatQualityTile';
import { ActionStatusTile } from './components/ActionStatusTile';
import { RecentHistoryTile } from './components/RecentHistoryTile';
import { ToastContainer } from './components/ToastContainer';
import {
  cancelDownloadJob,
  checkBackendHealth,
  fetchVideoMetadata,
  getDownloadFileUrl,
  startDownloadJob,
  subscribeToDownloadEvents,
} from './services/api';
import { formatBytes, validateYouTubeUrl } from './utils/youtube';

const HISTORY_KEY = 'yt_bento_history_v1';
const THEME_KEY = 'streambox_theme';

const INITIAL_DOWNLOAD_STATE = {
  status: 'idle',
  percent: 0,
  speed: null,
  eta: null,
  stageLabel: '',
  jobId: null,
  fileSize: null,
  error: null,
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [url, setUrl] = useState('');
  const [serverError, setServerError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [metadata, setMetadata] = useState(null);

  const [format, setFormat] = useState('mp4');
  const [selectedQuality, setSelectedQuality] = useState(1080);

  const [downloadState, setDownloadState] = useState(INITIAL_DOWNLOAD_STATE);
  const [history, setHistory] = useState(loadHistory);
  const [toasts, setToasts] = useState([]);
  const [health, setHealth] = useState(null);

  const unsubscribeRef = useRef(null);
  const validation = useMemo(() => validateYouTubeUrl(url), [url]);

  const addToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync theme class with document root and system preference when no manual override exists
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setDarkMode(e.matches);
      }
    };
    mq.addEventListener('change', onSystemChange);
    return () => mq.removeEventListener('change', onSystemChange);
  }, []);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  // Persist download history
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  // Check backend yt-dlp & ffmpeg readiness on mount
  useEffect(() => {
    checkBackendHealth()
      .then((data) => setHealth(data))
      .catch(() => setHealth({ ok: false, ready: false }));

    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  // Keep selectedQuality valid when switching format or fetching new metadata
  const currentFormatOptions = useMemo(() => {
    if (!metadata) return [];
    return format === 'mp4' ? metadata.formats?.mp4 || [] : metadata.formats?.mp3 || [];
  }, [metadata, format]);

  useEffect(() => {
    if (currentFormatOptions.length === 0) return;
    const stillValid = currentFormatOptions.some(
      (o) => Number(o.quality) === Number(selectedQuality),
    );
    if (!stillValid) {
      const preferred =
        format === 'mp4'
          ? currentFormatOptions.find((o) => o.quality === 1080) || currentFormatOptions[0]
          : currentFormatOptions.find((o) => o.quality === 192) || currentFormatOptions[0];
      if (preferred) setSelectedQuality(preferred.quality);
    }
  }, [currentFormatOptions, format, selectedQuality]);

  const selectedOption = useMemo(
    () => currentFormatOptions.find((o) => Number(o.quality) === Number(selectedQuality)) || null,
    [currentFormatOptions, selectedQuality],
  );

  const handleUrlChange = (value) => {
    setUrl(value);
    if (serverError) setServerError(null);
  };

  const triggerBrowserSave = useCallback((jobId) => {
    const link = document.createElement('a');
    link.href = getDownloadFileUrl(jobId);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const handleFetch = useCallback(
    async (overrideUrl) => {
      const targetUrl = typeof overrideUrl === 'string' ? overrideUrl : url;
      const check = validateYouTubeUrl(targetUrl);
      if (!check.valid) {
        setServerError(check.error || 'Enter a valid YouTube link.');
        return;
      }

      setServerError(null);
      setIsFetching(true);
      setDownloadState(INITIAL_DOWNLOAD_STATE);

      try {
        const data = await fetchVideoMetadata(check.normalizedUrl);
        setMetadata(data);
        const defaultMp4 = data.formats?.mp4?.find((o) => o.quality === 1080) || data.formats?.mp4?.[0];
        if (format === 'mp4' && defaultMp4) {
          setSelectedQuality(defaultMp4.quality);
        }
        addToast('Video details loaded', 'success');
      } catch (err) {
        setMetadata(null);
        setServerError(err.message || 'Unable to fetch video info.');
      } finally {
        setIsFetching(false);
      }
    },
    [url, format, addToast],
  );

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        addToast('Clipboard is empty', 'info');
        return;
      }
      const cleaned = text.trim();
      setUrl(cleaned);
      setServerError(null);
      addToast('Link pasted from clipboard', 'info');

      if (validateYouTubeUrl(cleaned).valid) {
        handleFetch(cleaned);
      }
    } catch {
      addToast('Clipboard access blocked — paste manually with Ctrl/Cmd+V', 'error');
    }
  };

  const handleQuickFill = (sampleUrl) => {
    setUrl(sampleUrl);
    setServerError(null);
    handleFetch(sampleUrl);
  };

  const handleStartDownload = async () => {
    if (!metadata || !selectedOption) return;

    unsubscribeRef.current?.();
    setDownloadState({
      ...INITIAL_DOWNLOAD_STATE,
      status: 'starting',
      percent: 2,
      stageLabel: 'Starting yt-dlp...',
    });

    try {
      const { jobId } = await startDownloadJob({
        url: metadata.webpageUrl,
        format,
        quality: selectedOption.quality,
        title: metadata.title,
      });

      setDownloadState((prev) => ({ ...prev, jobId }));

      unsubscribeRef.current = subscribeToDownloadEvents(jobId, {
        onUpdate: (payload) => {
          setDownloadState((prev) => ({
            ...prev,
            ...payload,
            jobId,
          }));

          if (payload.status === 'completed') {
            triggerBrowserSave(jobId);
            addToast(`Saved ${format.toUpperCase()} (${selectedOption.label})`, 'success');

            const entry = {
              id: `${metadata.id}-${format}-${selectedOption.quality}-${Date.now()}`,
              videoId: metadata.id,
              url: metadata.webpageUrl,
              title: metadata.title,
              thumbnail: metadata.thumbnail,
              format,
              quality: selectedOption.quality,
              qualityLabel: selectedOption.label,
              sizeLabel: payload.fileSize
                ? formatBytes(payload.fileSize)
                : selectedOption.estimatedSize,
              timestamp: Date.now(),
            };

            setHistory((prev) => [entry, ...prev].slice(0, 20));
          } else if (payload.status === 'error') {
            addToast(payload.error || 'Download failed', 'error');
          }
        },
        onError: (msg) => {
          setDownloadState((prev) => ({
            ...prev,
            status: 'error',
            error: msg,
          }));
        },
      });
    } catch (err) {
      setDownloadState({
        ...INITIAL_DOWNLOAD_STATE,
        status: 'error',
        error: err.message || 'Could not start download.',
      });
      addToast(err.message || 'Could not start download', 'error');
    }
  };

  const handleCancelDownload = async () => {
    unsubscribeRef.current?.();
    if (downloadState.jobId) {
      await cancelDownloadJob(downloadState.jobId);
    }
    setDownloadState(INITIAL_DOWNLOAD_STATE);
    addToast('Download cancelled', 'info');
  };

  const handleRedownload = (item) => {
    setUrl(item.url);
    setFormat(item.format);
    setSelectedQuality(item.quality);
    handleFetch(item.url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isDownloading =
    downloadState.status === 'starting' ||
    downloadState.status === 'downloading' ||
    downloadState.status === 'processing';

  return (
    <div className="relative min-h-screen overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      {/* Subtle Apple-inspired ambient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#007AFF]/[0.08] blur-[120px] dark:bg-[#0A84FF]/[0.12]" />
        <div className="absolute right-0 bottom-0 h-[320px] w-[480px] rounded-full bg-[#AF52DE]/[0.06] blur-[120px] dark:bg-[#BF5AF2]/[0.09]" />
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="mx-auto max-w-5xl space-y-4">
        {/* Top Minimal Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-white shadow-md shadow-[#007AFF]/25">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                StreamBox
              </h1>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                YouTube to MP4 & MP3 Downloader
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {health && !health.ready && (
              <div
                title="Install yt-dlp and ffmpeg on the backend server to enable downloads"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-400/15 dark:text-amber-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>
                  {!health.ok
                    ? 'Backend offline'
                    : !health.dependencies?.ytDlp?.available
                      ? 'yt-dlp missing'
                      : 'ffmpeg missing'}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="bento-surface spring-press flex h-10 w-10 items-center justify-center rounded-2xl text-neutral-700 hover:text-neutral-950 dark:text-neutral-200 dark:hover:text-white"
            >
              {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </header>

        {/* Bento Box Grid (16px gaps, uniform 24px rounded-3xl corners) */}
        <main className="grid grid-cols-12 gap-4">
          {/* 1. Hero Input Tile (Full Width Top) */}
          <HeroInputTile
            url={url}
            onUrlChange={handleUrlChange}
            onPaste={handlePaste}
            onClear={() => {
              setUrl('');
              setServerError(null);
            }}
            onFetch={() => handleFetch()}
            validation={validation}
            isFetching={isFetching}
            serverError={serverError}
          />

          {/* 2. Media Preview Tile (Large Left) */}
          <MediaPreviewTile
            metadata={metadata}
            isFetching={isFetching}
            onQuickFill={handleQuickFill}
          />

          {/* Right Column Stack: Format/Quality (Top Right) + Action/Status (Bottom Right) */}
          <div className="col-span-12 flex flex-col gap-4 lg:col-span-5">
            <FormatQualityTile
              format={format}
              onFormatChange={setFormat}
              selectedQuality={selectedQuality}
              onQualityChange={setSelectedQuality}
              metadata={metadata}
              disabled={isDownloading}
            />

            <ActionStatusTile
              metadata={metadata}
              format={format}
              selectedOption={selectedOption}
              downloadState={downloadState}
              onStartDownload={handleStartDownload}
              onCancelDownload={handleCancelDownload}
              onSaveAgain={() => downloadState.jobId && triggerBrowserSave(downloadState.jobId)}
              onResetStatus={() => setDownloadState(INITIAL_DOWNLOAD_STATE)}
            />
          </div>

          {/* 5. Recent History Tile (Bottom Span) */}
          <RecentHistoryTile
            history={history}
            onRedownload={handleRedownload}
            onRemoveItem={(id) => setHistory((prev) => prev.filter((i) => i.id !== id))}
            onClearAll={() => {
              setHistory([]);
              addToast('Download history cleared', 'info');
            }}
          />
        </main>
      </div>
    </div>
  );
}
