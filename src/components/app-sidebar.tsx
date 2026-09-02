"use client"

import * as React from "react"

import { AppBranding } from "@/components/app-branding"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { appNavItems, currentUser } from "@/lib/template-data"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const navMain = appNavItems.map((item) => ({
  title: item.title,
  url: item.href,
  icon: item.icon,
}))

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AppBranding />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
