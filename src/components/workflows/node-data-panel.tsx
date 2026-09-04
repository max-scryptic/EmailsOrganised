"use client";

import * as React from "react";
import { ChevronRight, Database, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useVariableInsert } from "@/components/workflows/variable-fields";
import { cn } from "@/lib/utils";
import {
  variableExpression,
  type NodeOutputField,
  type NodeOutputGroup,
} from "@/lib/workflow-variables";

/** Above this many values the panel gets a filter box. */
const searchThreshold = 8;

/**
 * Everything the nodes before this one produced, grouped by the node that
 * produced it. It is the inspector's left column: the material you are working
 * from sits beside the settings you are working on, so picking a value never
 * scrolls the field it lands in off screen.
 *
 * Clicking a value drops it into the settings field that was last focused, so a
 * text field can read "Chasing {{email.subject}} from {{email.from.name}}".
 */
export function UpstreamDataPanel({
  upstream,
}: {
  upstream: NodeOutputGroup[];
}) {
  const insertContext = useVariableInsert();
  const [query, setQuery] = React.useState("");
  // The node right before this one is the one people reach for, so it starts
  // open and everything further back starts collapsed.
  const nearestGroupId = upstream.at(-1)?.nodeId;
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    {}
  );
  const totalFields = upstream.reduce(
    (total, group) => total + group.fields.length,
    0
  );
  const trimmedQuery = query.trim().toLowerCase();
  const filteredGroups = upstream
    .map((group) => ({
      ...group,
      fields: trimmedQuery
        ? group.fields.filter((field) => matchesQuery(field, trimmedQuery))
        : group.fields,
    }))
    .filter((group) => group.fields.length > 0);

  function isGroupOpen(nodeId: string) {
    if (trimmedQuery) {
      return true;
    }

    return openGroups[nodeId] ?? nodeId === nearestGroupId;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <Database className="size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs font-medium">Data from earlier steps</p>
          <Badge variant="outline" className="ml-auto shrink-0">
            {totalFields}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {insertContext?.activeLabel
            ? `Pick a value to insert it into ${insertContext.activeLabel}.`
            : "Pick a value to insert it into the settings beside this."}
        </p>

        {totalFields > searchThreshold ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a value"
              aria-label="Find a value from an earlier step"
              className="pl-8"
            />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filteredGroups.length > 0 ? (
          <div className="space-y-1.5">
            {filteredGroups.map((group) => (
              <Collapsible
                key={group.nodeId}
                open={isGroupOpen(group.nodeId)}
                onOpenChange={(open) =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.nodeId]: open,
                  }))
                }
                className="overflow-hidden rounded-md border bg-card"
              >
                <CollapsibleTrigger className="group/group flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-muted/60">
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/group:rotate-90" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {group.title}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {group.kindLabel}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {group.fields.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 border-t p-1.5">
                  {group.fields.map((field) => (
                    <VariableRow
                      key={field.token}
                      field={field}
                      onInsert={
                        insertContext
                          ? () =>
                              insertContext.insert(
                                variableExpression(field.token)
                              )
                          : undefined
                      }
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
            No value matches “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * What this node hands to the ones after it. It belongs beside the node's own
 * settings rather than in the upstream column: it is a fact about the node you
 * have selected, not material you can insert here.
 */
export function NodeOutputSummary({ own }: { own: NodeOutputGroup }) {
  return (
    <Collapsible className="overflow-hidden rounded-md border border-dashed">
      <CollapsibleTrigger className="group/own flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-muted/60">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/own:rotate-90" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            This step outputs
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Available to every node after it
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {own.fields.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 border-t p-1.5">
        {own.fields.map((field) => (
          <VariableRow key={field.token} field={field} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function matchesQuery(field: NodeOutputField, query: string) {
  return (
    field.label.toLowerCase().includes(query) ||
    field.token.toLowerCase().includes(query)
  );
}

/**
 * One value. Insertable rows are buttons; a node's own outputs are shown for
 * reference only, since a node cannot read what it has not produced yet.
 */
function VariableRow({
  field,
  onInsert,
}: {
  field: NodeOutputField;
  onInsert?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {field.label}
        </span>
        {onInsert ? (
          <Plus
            aria-hidden="true"
            className="size-3 shrink-0 text-primary opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
          />
        ) : null}
      </span>
      {/* A tinted chip rather than brand-coloured text: at this size the token
          has to stay readable in both themes. */}
      <code className="mt-1 block w-fit max-w-full truncate rounded-sm bg-primary/10 px-1 font-mono text-[11px] text-foreground">
        {variableExpression(field.token)}
      </code>
      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
        e.g. {previewExample(field.example)}
      </span>
    </>
  );
  const title = `${field.description} Example: ${previewExample(field.example)}`;

  if (!onInsert) {
    return (
      <div
        title={title}
        className="rounded-md border border-transparent bg-muted/40 px-2 py-1.5"
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      // Keeps focus — and the caret — in the settings field the value is
      // being inserted into.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onInsert}
      title={`Insert into the selected field. ${title}`}
      className={cn(
        "group/row w-full rounded-md border px-2 py-1.5 text-left transition",
        "hover:border-primary/60 hover:bg-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {body}
    </button>
  );
}

/** Bodies run long and carry newlines, so rows show a single tidy line. */
function previewExample(example: string) {
  const singleLine = example.replace(/\s+/g, " ").trim();

  return singleLine.length > 64 ? `${singleLine.slice(0, 63)}…` : singleLine;
}
