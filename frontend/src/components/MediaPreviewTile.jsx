import { Calendar, Eye, Film, Play, Sparkles, UserCheck } from 'lucide-react';
import { BentoTile } from './BentoTile';
import { formatDuration, formatUploadDate, formatViewCount } from '../utils/youtube';

const SAMPLE_LINKS = [
  { label: 'Standard Watch', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
  { label: 'Short Link', url: 'https://youtu.be/aqz-KE-bpKQ' },
];

export function MediaPreviewTile({ metadata, isFetching, onQuickFill }) {
  if (isFetching) {
    return (
      <BentoTile className="col-span-12 flex flex-col justify-between lg:col-span-7">
        <div className="space-y-4">
          <div className="hig-skeleton aspect-video w-full rounded-2xl" />
          <div className="space-y-2.5">
            <div className="hig-skeleton h-6 w-4/5 rounded-lg" />
            <div className="hig-skeleton h-4 w-2/5 rounded-lg" />
          </div>
        </div>
      </BentoTile>
    );
  }

  if (!metadata) {
    return (
      <BentoTile className="col-span-12 flex min-h-[300px] flex-col items-center justify-center text-center lg:col-span-7">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#0A84FF]/15 dark:text-[#0A84FF]">
          <Film className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
          Ready to preview your media
        </h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          Paste any YouTube watch URL, <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">youtu.be</code> short link, or Shorts link above to inspect streams and download.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
            <Sparkles className="h-3.5 w-3.5" /> Try example:
          </span>
          {SAMPLE_LINKS.map((item) => (
            <button
              key={item.url}
              type="button"
              onClick={() => onQuickFill(item.url)}
              className="spring-press rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-neutral-700 ring-1 ring-black/[0.06] hover:bg-black/[0.08] dark:bg-white/[0.07] dark:text-neutral-200 dark:ring-white/[0.08] dark:hover:bg-white/[0.12]"
            >
              {item.label}
            </button>
          ))}
        </div>
      </BentoTile>
    );
  }

  const viewsLabel = formatViewCount(metadata.viewCount);
  const dateLabel = formatUploadDate(metadata.uploadDate);
  const topQuality = metadata.formats?.mp4?.[0];

  return (
    <BentoTile className="col-span-12 flex flex-col justify-between gap-4 lg:col-span-7">
      {/* 16:9 Thumbnail Container */}
      <div className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900/10 ring-1 ring-black/[0.06] dark:bg-black/40 dark:ring-white/[0.08]">
        {metadata.thumbnail ? (
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <Play className="h-10 w-10" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        {/* Top-left Quality Badge */}
        {topQuality?.badge && (
          <div className="absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
            Up to {topQuality.label} {topQuality.badge}
          </div>
        )}

        {/* Bottom-right Duration Badge */}
        {metadata.duration > 0 && (
          <div className="tabular-nums absolute right-3 bottom-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
            {formatDuration(metadata.duration)}
          </div>
        )}
      </div>

      {/* Metadata Details */}
      <div className="space-y-2.5">
        <h2 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-neutral-900 sm:text-xl dark:text-white">
          {metadata.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
            <UserCheck className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF]" />
            {metadata.channel}
          </span>

          {viewsLabel && (
            <span className="tabular-nums inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {viewsLabel}
            </span>
          )}

          {dateLabel && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
          )}
        </div>
      </div>
    </BentoTile>
  );
}
