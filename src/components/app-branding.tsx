import { BrandMark } from "@/components/brand-logo"
import { appConfig } from "@/lib/template-data"

export function AppBranding() {
  return (
    <div className="flex h-12 items-center gap-2 p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
      <BrandMark />
      <span className="truncate text-base font-medium group-data-[collapsible=icon]:hidden">
        {appConfig.name}
      </span>
    </div>
  )
}
