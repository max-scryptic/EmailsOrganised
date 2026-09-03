"use client";

import { useSyncExternalStore } from "react";
import type { SavedWorkflow } from "@/lib/workflow-data";

/**
 * Workflows still come from the static list in `workflow-data.ts`, so a delete
 * has nowhere to be written yet. Until they are persisted, deletions are kept
 * as a set of hidden ids in this browser so the workflow does not come back on
 * the next navigation or reload. Replace this whole module with the real
 * delete call when workflows move to Supabase.
 */
const STORAGE_KEY = "emailsorganised.deleted-workflows";

const EMPTY: readonly string[] = [];

let cache: readonly string[] | null = null;
const listeners = new Set<() => void>();

function readStorage(): readonly string[] {
  if (typeof window === "undefined") {
    return EMPTY;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return EMPTY;
    }

    const ids = parsed.filter((id): id is string => typeof id === "string");
    return ids.length > 0 ? ids : EMPTY;
  } catch {
    // Private mode, a disabled storage API, or a value we did not write.
    return EMPTY;
  }
}

/** Cached so `useSyncExternalStore` sees a stable reference between renders. */
function getSnapshot(): readonly string[] {
  cache ??= readStorage();
  return cache;
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Deleting in one tab should empty the row in the others too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) {
      return;
    }
    cache = readStorage();
    for (const notify of listeners) {
      notify();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function deleteWorkflow(id: string) {
  const current = getSnapshot();
  if (current.includes(id)) {
    return;
  }

  const next = [...current, id];
  cache = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The delete still applies to this session; it just will not outlive it.
  }

  for (const notify of listeners) {
    notify();
  }
}

export function useDeletedWorkflowIds(): readonly string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useWorkflowIsDeleted(id: string): boolean {
  return useDeletedWorkflowIds().includes(id);
}

export function useVisibleWorkflows(
  workflows: SavedWorkflow[]
): SavedWorkflow[] {
  const deletedIds = useDeletedWorkflowIds();

  if (deletedIds.length === 0) {
    return workflows;
  }

  return workflows.filter((workflow) => !deletedIds.includes(workflow.id));
}
