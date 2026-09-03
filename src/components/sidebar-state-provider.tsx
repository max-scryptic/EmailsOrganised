"use client";

import { createContext, useContext, useMemo, useState } from "react";

type SidebarState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * Holds the expanded/collapsed state of the app sidebar.
 *
 * Every page renders its own `AppShell`, so the `SidebarProvider` inside it is
 * unmounted and remounted on each navigation and cannot own this state — it
 * would snap back to the default on every route change. This provider lives in
 * the root layout, which survives client-side navigation, so the state carries
 * across page transitions. The initial value comes from the `sidebar_state`
 * cookie the sidebar primitive writes, which carries it across reloads too.
 */
const SidebarStateContext = createContext<SidebarState | null>(null);

export function SidebarStateProvider({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const value = useMemo<SidebarState>(() => ({ open, setOpen }), [open]);

  return (
    <SidebarStateContext.Provider value={value}>
      {children}
    </SidebarStateContext.Provider>
  );
}

/**
 * Returns `null` when no provider is above — an `AppShell` rendered outside the
 * root layout then falls back to the primitive's own uncontrolled state.
 */
export function useSidebarState() {
  return useContext(SidebarStateContext);
}
