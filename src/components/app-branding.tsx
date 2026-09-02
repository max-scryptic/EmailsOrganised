import { GalleryVerticalEndIcon } from "lucide-react"

import { appConfig } from "@/lib/template-data"

export function AppBranding() {
  return (
    <div className="flex h-12 items-center gap-2 p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
      <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-brand bg-sidebar-primary text-sidebar-primary-foreground">
        <GalleryVerticalEndIcon className="size-4" />
      </div>
      <span className="truncate text-base font-medium group-data-[collapsible=icon]:hidden">
        {appConfig.name}
      </span>
    </div>
  )
}
