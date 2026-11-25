import { ArrowDownToLine, CheckCircle2, FileDown, RotateCcw, XCircle } from 'lucide-react';
import { BentoTile } from './BentoTile';
import { formatBytes } from '../utils/youtube';

export function ActionStatusTile({
  metadata,
  format,
  selectedOption,
  downloadState,
  onStartDownload,
  onCancelDownload,
  onSaveAgain,
  onResetStatus,
}) {
  const { status, percent = 0, speed, eta, stageLabel, error, fileSize } = downloadState;
  const isActive = status === 'starting' || status === 'downloading' || status === 'processing';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <BentoTile className="flex flex-col justify-between gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
          Download Manager
        </h3>
        {selectedOption && (
          <span className="tabular-nums rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-white/[0.08] dark:text-neutral-300">
            {format.toUpperCase()} · {selectedOption.label}
          </span>
        )}
      </div>

      {/* Idle / Ready CTA State */}
      {!isActive && !isCompleted && !isError && (
        <div className="space-y-3">
          <button
            type="button"
            disabled={!metadata || !selectedOption}
            onClick={onStartDownload}
            className="spring-press flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#007AFF] px-5 py-3.5 text-[15px] font-semibold text-white shadow-md shadow-[#007AFF]/25 hover:bg-[#0066D6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007AFF]/30 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#0A84FF] dark:hover:bg-[#3B9EFF]"
          >
            <ArrowDownToLine className="h-5 w-5" />
            <span>
              {metadata && selectedOption
                ? `Download ${format.toUpperCase()} (${selectedOption.estimatedSize})`
                : 'Select a video to download'}
            </span>
          </button>
          <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
            Streams are processed directly with yt-dlp & FFmpeg.
          </p>
        </div>
      )}

      {/* Active Progress Ring + Bar */}
      {isActive && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  className="text-black/[0.08] dark:text-white/[0.1]"
                />
                <circle
                  cx="28"
                  cy="28"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  className="text-[#007AFF] transition-all duration-300 ease-out dark:text-[#0A84FF]"
                />
              </svg>
              <span className="tabular-nums absolute text-xs font-bold text-neutral-900 dark:text-white">
                {Math.round(percent)}%
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                {stageLabel || 'Processing...'}
              </p>
              <div className="tabular-nums flex flex-wrap items-center gap-x-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>{percent.toFixed(1)}%</span>
                {speed && <span>{speed}</span>}
                {eta && <span>ETA {eta}</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={onCancelDownload}
              aria-label="Cancel download"
              className="spring-press rounded-xl bg-black/[0.05] px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-[#FF3B30]/15 hover:text-[#D70015] dark:bg-white/[0.08] dark:text-neutral-300 dark:hover:bg-[#FF453A]/20 dark:hover:text-[#FF6961]"
            >
              Cancel
            </button>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.09]">
            <div
              className="h-full rounded-full bg-[#007AFF] transition-all duration-300 ease-out dark:bg-[#0A84FF]"
              style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed State */}
      {isCompleted && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-[#34C759]/12 px-4 py-3 dark:bg-[#30D158]/15">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#248A3D] dark:text-[#30D158]" />
              <div>
                <p className="text-sm font-semibold text-[#1D6F31] dark:text-[#30D158]">
                  Download complete
                </p>
                <p className="tabular-nums text-xs text-[#248A3D]/80 dark:text-[#30D158]/80">
                  {fileSize ? `Saved ${formatBytes(fileSize)}` : 'File transferred to browser'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onResetStatus}
              className="spring-press rounded-xl bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-white dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15"
            >
              Done
            </button>
          </div>

          {downloadState.jobId && (
            <button
              type="button"
              onClick={onSaveAgain}
              className="spring-press flex w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.08] bg-white/70 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-white dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-neutral-100 dark:hover:bg-white/[0.1]"
            >
              <FileDown className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF]" />
              <span>Save File Again</span>
            </button>
          )}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-2xl bg-[#FF3B30]/10 px-4 py-3 text-sm text-[#D70015] dark:bg-[#FF453A]/15 dark:text-[#FF6961]">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Download failed</p>
              <p className="mt-0.5 text-xs opacity-90">{error}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartDownload}
            className="spring-press flex w-full items-center justify-center gap-2 rounded-2xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0066D6] dark:bg-[#0A84FF] dark:hover:bg-[#3B9EFF]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retry Download</span>
          </button>
        </div>
      )}
    </BentoTile>
  );
}
