import { appConfig } from "@/lib/template-data";
import { cn } from "@/lib/utils";

/**
 * The EmailsOrganised mark: an orange tile with a white envelope. Drawn inline
 * rather than loaded from `/logo.svg` so it inherits the brand tokens — the
 * same orange `--primary` resolves to — and stays crisp at every size.
 * `public/logo.svg` and `src/app/icon.svg` carry the same artwork for contexts
 * outside React.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="4.5" className="fill-brand" />
      <g
        fill="none"
        className="stroke-brand-foreground"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5.15" y="7.15" width="13.7" height="9.7" rx="1.9" />
        <path d="M5.9 8.6l5.15 3.95a1.55 1.55 0 0 0 1.9 0L18.1 8.6" />
      </g>
    </svg>
  );
}

/** Mark plus wordmark, for surfaces that introduce the product by name. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="text-lg font-medium tracking-tight">
        {appConfig.name}
      </span>
    </div>
  );
}
