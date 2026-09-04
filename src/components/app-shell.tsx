"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { useSidebarState } from "@/components/sidebar-state-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbEntry[];
  /**
   * Drops the title/description/actions row so a page can render its own
   * heading — an editable one, for example — as part of `children`.
   */
  hideHeading?: boolean;
  /**
   * Sizes the content area to the viewport instead of to the content, so a
   * full-page surface like the workflow board can own everything below the
   * top bar. The page itself stops scrolling; `children` handles overflow.
   */
  fill?: boolean;
};

type BreadcrumbEntry = {
  title: string;
  href?: string;
};

export function AppShell({
  children,
  title,
  description,
  actions,
  breadcrumbs,
  hideHeading = false,
  fill = false,
}: AppShellProps) {
  // This shell remounts on every navigation, so the open/collapsed state is
  // controlled from the root layout instead of being held by the provider here.
  const sidebarState = useSidebarState();

  return (
    <SidebarProvider
      className={cn(fill && "h-svh overflow-hidden")}
      open={sidebarState?.open}
      onOpenChange={sidebarState?.setOpen}
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/80 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center gap-2 px-4 sm:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <AppBreadcrumb breadcrumbs={breadcrumbs ?? [{ title }]} />
            <div className="ml-auto hidden h-10 min-w-56 max-w-sm flex-1 items-center gap-2 rounded-md border bg-card px-3 transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-8 lg:flex">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                className="h-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                placeholder="Search customers, workflows, settings..."
              />
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div
          className={cn(
            "flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8",
            // A filling page is all board, so it keeps only enough padding to
            // clear the top bar and the window edges.
            fill && "min-h-0 py-3"
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full max-w-7xl flex-col gap-6",
              fill && "min-h-0 max-w-none flex-1 gap-3"
            )}
          >
            {hideHeading ? null : (
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                      {title}
                    </h1>
                    {description ? (
                      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        {description}
                      </p>
                    ) : null}
                  </div>
                </div>
                {actions ? <div className="flex gap-2">{actions}</div> : null}
              </div>
            )}
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppBreadcrumb({ breadcrumbs }: { breadcrumbs: BreadcrumbEntry[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => {
          const isCurrent = index === breadcrumbs.length - 1;

          return (
            <Fragment key={`${breadcrumb.title}-${index}`}>
              <BreadcrumbItem>
                {isCurrent || !breadcrumb.href ? (
                  <BreadcrumbPage>{breadcrumb.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={breadcrumb.href}>{breadcrumb.title}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isCurrent ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
