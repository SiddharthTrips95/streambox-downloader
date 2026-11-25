import { Clock, Film, Music2, RotateCcw, Trash2, X } from 'lucide-react';
import { BentoTile } from './BentoTile';
import { formatRelativeTime } from '../utils/youtube';

export function RecentHistoryTile({ history, onRedownload, onRemoveItem, onClearAll }) {
  return (
    <BentoTile className="col-span-12 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
            Recent Downloads
          </h3>
          {history.length > 0 && (
            <span className="tabular-nums rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-neutral-500 dark:bg-white/[0.08] dark:text-neutral-400">
              {history.length}
            </span>
          )}
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="spring-press inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-neutral-500 hover:bg-[#FF3B30]/10 hover:text-[#D70015] dark:text-neutral-400 dark:hover:bg-[#FF453A]/15 dark:hover:text-[#FF6961]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-black/[0.08] py-7 text-center dark:border-white/[0.08]">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
            Completed MP4 and MP3 downloads will appear here for quick re-downloads.
          </p>
        </div>
      ) : (
        <div className="hig-scroll max-h-64 space-y-2 overflow-y-auto pr-1">
          {history.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white/50 p-2.5 transition-colors hover:bg-white/85 dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="h-11 w-19 shrink-0 rounded-xl object-cover ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                  />
                ) : (
                  <div className="flex h-11 w-19 shrink-0 items-center justify-center rounded-xl bg-black/[0.05] dark:bg-white/[0.08]">
                    {item.format === 'mp3' ? (
                      <Music2 className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <Film className="h-4 w-4 text-neutral-400" />
                    )}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold uppercase ${
                        item.format === 'mp3'
                          ? 'bg-[#AF52DE]/12 text-[#8944AB] dark:bg-[#BF5AF2]/20 dark:text-[#DA8FFF]'
                          : 'bg-[#007AFF]/12 text-[#0066D6] dark:bg-[#0A84FF]/20 dark:text-[#5AC8FA]'
                      }`}
                    >
                      {item.format} · {item.qualityLabel}
                    </span>
                    {item.sizeLabel && <span className="tabular-nums">{item.sizeLabel}</span>}
                    <span>{formatRelativeTime(item.timestamp)}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRedownload(item)}
                  className="spring-press inline-flex items-center gap-1.5 rounded-xl bg-black/[0.05] px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-[#007AFF] hover:text-white dark:bg-white/[0.08] dark:text-neutral-200 dark:hover:bg-[#0A84FF] dark:hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Re-download</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label="Remove from history"
                  className="spring-press rounded-xl p-1.5 text-neutral-400 hover:bg-black/[0.06] hover:text-neutral-700 dark:hover:bg-white/[0.1] dark:hover:text-neutral-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </BentoTile>
  );
}
