"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
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

type AppShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function AppShell({
  children,
  title,
  description,
  actions,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/80 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center gap-2 px-4 sm:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <AppBreadcrumb title={title} />
            <div className="ml-auto hidden h-10 min-w-56 max-w-sm flex-1 items-center gap-2 rounded-md border bg-card px-3 transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-8 lg:flex">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                className="h-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                placeholder="Search customers, invoices, settings..."
              />
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
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
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppBreadcrumb({ title }: { title: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">App</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
