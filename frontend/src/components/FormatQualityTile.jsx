import { Film, Music2, Sparkles } from 'lucide-react';
import { BentoTile } from './BentoTile';

const DEFAULT_MP4_OPTIONS = [
  { id: '1080', quality: 1080, label: '1080p', badge: 'HD', estimatedSize: '—' },
  { id: '720', quality: 720, label: '720p', badge: 'HD', estimatedSize: '—' },
  { id: '480', quality: 480, label: '480p', badge: 'SD', estimatedSize: '—' },
  { id: '360', quality: 360, label: '360p', badge: '', estimatedSize: '—' },
];

const DEFAULT_MP3_OPTIONS = [
  { id: '320', quality: 320, label: '320 kbps', badge: 'Studio', estimatedSize: '—' },
  { id: '192', quality: 192, label: '192 kbps', badge: 'High', estimatedSize: '—' },
  { id: '128', quality: 128, label: '128 kbps', badge: 'Standard', estimatedSize: '—' },
];

export function FormatQualityTile({
  format,
  onFormatChange,
  selectedQuality,
  onQualityChange,
  metadata,
  disabled,
}) {
  const options = metadata
    ? format === 'mp4'
      ? metadata.formats?.mp4 || []
      : metadata.formats?.mp3 || []
    : format === 'mp4'
      ? DEFAULT_MP4_OPTIONS
      : DEFAULT_MP3_OPTIONS;

  return (
    <BentoTile className="flex flex-col justify-between gap-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
            Format & Quality
          </h3>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400">
            <Sparkles className="h-3 w-3" />
            {metadata ? 'Streams detected' : 'Fetch video to unlock'}
          </span>
        </div>

        {/* Apple HIG Sliding Segmented Control */}
        <div
          role="tablist"
          aria-label="Output Format"
          className="relative grid grid-cols-2 rounded-2xl bg-black/[0.05] p-1 dark:bg-white/[0.08]"
        >
          <div
            aria-hidden="true"
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm ring-1 ring-black/[0.05] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-[#2c2c2e] dark:ring-white/[0.08] ${
              format === 'mp3' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />

          <button
            type="button"
            role="tab"
            aria-selected={format === 'mp4'}
            disabled={disabled}
            onClick={() => onFormatChange('mp4')}
            className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-2 text-[13px] font-semibold transition-colors ${
              format === 'mp4'
                ? 'text-neutral-900 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Film className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF]" />
            <span>MP4 Video</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={format === 'mp3'}
            disabled={disabled}
            onClick={() => onFormatChange('mp3')}
            className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-2 text-[13px] font-semibold transition-colors ${
              format === 'mp3'
                ? 'text-neutral-900 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Music2 className="h-4 w-4 text-[#AF52DE] dark:text-[#BF5AF2]" />
            <span>MP3 Audio</span>
          </button>
        </div>

        {/* Dynamic Quality Selector Grid */}
        <div
          className={`grid gap-2 ${
            format === 'mp3' ? 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-1' : 'grid-cols-2'
          } ${!metadata ? 'opacity-55' : ''}`}
        >
          {options.map((option) => {
            const isSelected = Number(selectedQuality) === Number(option.quality);
            return (
              <button
                key={option.id}
                type="button"
                disabled={!metadata || disabled}
                onClick={() => onQualityChange(option.quality)}
                className={`spring-press flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-[#007AFF] bg-[#007AFF]/[0.08] ring-2 ring-[#007AFF]/20 dark:border-[#0A84FF] dark:bg-[#0A84FF]/[0.14] dark:ring-[#0A84FF]/25'
                    : 'border-black/[0.07] bg-white/50 hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.07]'
                } disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-[14px] font-semibold text-neutral-900 dark:text-white">
                    {option.label}
                  </span>
                  {option.badge && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                        option.badge === '4K' || option.badge === 'Studio'
                          ? 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300'
                          : 'bg-black/[0.06] text-neutral-600 dark:bg-white/[0.1] dark:text-neutral-300'
                      }`}
                    >
                      {option.badge}
                    </span>
                  )}
                  {option.fps && option.fps > 30 && (
                    <span className="tabular-nums text-[10px] font-semibold text-neutral-400">
                      {option.fps}fps
                    </span>
                  )}
                </div>

                <span className="tabular-nums text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {option.estimatedSize}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </BentoTile>
  );
}
