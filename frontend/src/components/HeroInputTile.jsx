import { AlertCircle, CheckCircle2, ClipboardPaste, Link2, Loader2, Search, X } from 'lucide-react';
import { BentoTile } from './BentoTile';

export function HeroInputTile({
  url,
  onUrlChange,
  onPaste,
  onClear,
  onFetch,
  validation,
  isFetching,
  serverError,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onFetch();
  };

  const inlineError = serverError || (!validation.empty && !validation.valid ? validation.error : null);

  return (
    <BentoTile className="col-span-12">
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* URL Search Bar */}
          <div
            className={`group relative flex flex-1 items-center rounded-2xl border bg-black/[0.03] px-3.5 py-2.5 transition-all duration-200 dark:bg-white/[0.04] ${
              inlineError
                ? 'border-[#FF3B30]/60 ring-2 ring-[#FF3B30]/15 dark:border-[#FF453A]/60 dark:ring-[#FF453A]/20'
                : validation.valid
                  ? 'border-[#34C759]/50 focus-within:border-[#007AFF] focus-within:ring-4 focus-within:ring-[#007AFF]/15 dark:border-[#30D158]/40 dark:focus-within:border-[#0A84FF]'
                  : 'border-black/[0.08] focus-within:border-[#007AFF] focus-within:ring-4 focus-within:ring-[#007AFF]/15 dark:border-white/[0.1] dark:focus-within:border-[#0A84FF]'
            }`}
          >
            <Link2 className="mr-2.5 h-4 w-4 shrink-0 text-neutral-400 transition-colors group-focus-within:text-[#007AFF] dark:group-focus-within:text-[#0A84FF]" />

            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="Paste a YouTube link (watch, youtu.be, or Shorts)..."
              aria-label="YouTube video URL"
              className="w-full bg-transparent text-[15px] font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />

            <div className="ml-2 flex shrink-0 items-center gap-1.5">
              {validation.valid && !inlineError && (
                <span className="hidden items-center gap-1 rounded-full bg-[#34C759]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#248A3D] sm:inline-flex dark:bg-[#30D158]/15 dark:text-[#30D158]">
                  <CheckCircle2 className="h-3 w-3" />
                  {validation.kind}
                </span>
              )}

              {url && (
                <button
                  type="button"
                  onClick={onClear}
                  aria-label="Clear URL"
                  className="spring-press rounded-full p-1 text-neutral-400 hover:bg-black/[0.06] hover:text-neutral-700 dark:hover:bg-white/[0.1] dark:hover:text-neutral-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onPaste}
                className="spring-press inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-xs ring-1 ring-black/[0.07] hover:bg-neutral-50 dark:bg-white/[0.1] dark:text-neutral-100 dark:ring-white/[0.1] dark:hover:bg-white/[0.15]"
              >
                <ClipboardPaste className="h-3.5 w-3.5 text-[#007AFF] dark:text-[#0A84FF]" />
                <span>Paste</span>
              </button>
            </div>
          </div>

          {/* Primary Fetch Action */}
          <button
            type="submit"
            disabled={isFetching || !validation.valid}
            className="spring-press inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#007AFF] px-6 text-[15px] font-semibold text-white shadow-sm shadow-[#007AFF]/25 hover:bg-[#0066D6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007AFF]/30 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#0A84FF] dark:hover:bg-[#3B9EFF]"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Fetch</span>
              </>
            )}
          </button>
        </div>

        {/* Inline Validation / Error Banner */}
        {inlineError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-[#FF3B30]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#D70015] dark:bg-[#FF453A]/15 dark:text-[#FF6961]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{inlineError}</span>
          </div>
        )}
      </form>
    </BentoTile>
  );
}
