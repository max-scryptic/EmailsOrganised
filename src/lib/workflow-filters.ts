/**
 * Filters on the wires between nodes.
 *
 * A node decides what happens; a wire decides whether it happens at all. A
 * filter sits on the wire feeding a node — "only classify mail from this
 * domain", "only forward when there is an attachment" — and either lets the
 * email through or stops the run there.
 *
 * Every wire on the board has exactly one node at its downstream end, so a
 * filter is stored on that node: `WorkflowAction.filter` for the wire feeding
 * an action, `WorkflowDraft.classifierFilter` for the one feeding the
 * classification. That is what keeps a wire addressable without the board
 * having to keep an edge list of its own.
 *
 * This module is plain synchronous TypeScript with no I/O, so the same
 * evaluation runs in the browser for a test run and on the server for a live
 * one.
 */

import { resolveTemplate } from "@/lib/workflow-variables";

/** How the conditions on one filter are combined. */
export type FilterMatch = "all" | "any";

export type FilterOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "ends_with"
  | "matches"
  | "not_matches"
  | "is_one_of"
  | "is_not_one_of"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "is_true"
  | "is_false"
  | "before"
  | "after";

/** The families the operator list is grouped by in the picker. */
export type FilterOperatorGroup =
  | "Text"
  | "Presence"
  | "Number"
  | "Yes / no"
  | "Date";

export type FilterOperatorSpec = {
  /** How the operator reads in the picker and in a summary line. */
  label: string;
  group: FilterOperatorGroup;
  /** False for the operators that ask about one value alone. */
  takesValue: boolean;
  /** What the right-hand field suggests for this operator. */
  placeholder?: string;
};

/**
 * Every comparison a wire can make. Chosen for what a mailbox rule actually
 * asks: mostly text, plus the handful of counts, flags, and dates the email
 * variables carry (`email.attachments.count`, `email.isUnread`,
 * `email.receivedAt`, `classification.confidence`).
 */
export const filterOperators: Record<FilterOperator, FilterOperatorSpec> = {
  contains: { label: "contains", group: "Text", takesValue: true, placeholder: "invoice" },
  not_contains: {
    label: "does not contain",
    group: "Text",
    takesValue: true,
    placeholder: "invoice",
  },
  equals: { label: "is exactly", group: "Text", takesValue: true, placeholder: "invoice" },
  not_equals: {
    label: "is not",
    group: "Text",
    takesValue: true,
    placeholder: "invoice",
  },
  starts_with: {
    label: "starts with",
    group: "Text",
    takesValue: true,
    placeholder: "Re:",
  },
  ends_with: {
    label: "ends with",
    group: "Text",
    takesValue: true,
    placeholder: "@example.com",
  },
  matches: {
    label: "matches pattern",
    group: "Text",
    takesValue: true,
    placeholder: "invoice\\s+\\d+",
  },
  not_matches: {
    label: "does not match pattern",
    group: "Text",
    takesValue: true,
    placeholder: "invoice\\s+\\d+",
  },
  is_one_of: {
    label: "is one of",
    group: "Text",
    takesValue: true,
    placeholder: "ada@example.com, finance@example.com",
  },
  is_not_one_of: {
    label: "is none of",
    group: "Text",
    takesValue: true,
    placeholder: "ada@example.com, finance@example.com",
  },
  is_empty: { label: "is empty", group: "Presence", takesValue: false },
  is_not_empty: { label: "is not empty", group: "Presence", takesValue: false },
  greater_than: {
    label: "is greater than",
    group: "Number",
    takesValue: true,
    placeholder: "0",
  },
  greater_or_equal: {
    label: "is at least",
    group: "Number",
    takesValue: true,
    placeholder: "1",
  },
  less_than: {
    label: "is less than",
    group: "Number",
    takesValue: true,
    placeholder: "10",
  },
  less_or_equal: {
    label: "is at most",
    group: "Number",
    takesValue: true,
    placeholder: "10",
  },
  is_true: { label: "is yes", group: "Yes / no", takesValue: false },
  is_false: { label: "is no", group: "Yes / no", takesValue: false },
  before: {
    label: "is before",
    group: "Date",
    takesValue: true,
    placeholder: "2026-09-01",
  },
  after: {
    label: "is after",
    group: "Date",
    takesValue: true,
    placeholder: "2026-09-01",
  },
};

/** The operator names as a tuple, so the schema and the picker share one list. */
export const filterOperatorNames = Object.keys(filterOperators) as [
  FilterOperator,
  ...FilterOperator[],
];

/** The order the picker groups the operators in. */
export const filterOperatorGroups: FilterOperatorGroup[] = [
  "Text",
  "Presence",
  "Number",
  "Yes / no",
  "Date",
];

/**
 * One comparison. `left` is nearly always a `{{variable}}` from an earlier
 * step and `right` is what it is measured against — both are templates, so a
 * condition can compare two values from the run against each other.
 */
export type FilterCondition = {
  id: string;
  left: string;
  operator: FilterOperator;
  right: string;
};

export type WorkflowFilter = {
  /**
   * Off keeps the conditions but lets everything through, which is how a
   * filter is taken out of the way without being rewritten later.
   */
  enabled: boolean;
  /** Shown on the wire. Blank is fine — the marker falls back to its icon. */
  name: string;
  match: FilterMatch;
  /** Off by default: mailbox rules are written the way people type, not case. */
  caseSensitive: boolean;
  conditions: FilterCondition[];
};

export function createFilterCondition(
  overrides: Partial<FilterCondition> = {}
): FilterCondition {
  return {
    id: overrides.id ?? `cond-${Math.random().toString(36).slice(2, 10)}`,
    left: "",
    operator: "contains",
    right: "",
    ...overrides,
  };
}

export function createWorkflowFilter(
  overrides: Partial<WorkflowFilter> = {}
): WorkflowFilter {
  return {
    enabled: true,
    name: "",
    match: "all",
    caseSensitive: false,
    conditions: [],
    ...overrides,
  };
}

/**
 * A condition is complete when it has something to compare and, unless the
 * operator asks about one value alone, something to compare it with. An
 * incomplete condition is never evaluated — half a rule is not a rule, and
 * blocking mail on one would be the worst possible reading of a blank field.
 */
export function isConditionComplete(condition: FilterCondition) {
  if (!condition.left.trim()) {
    return false;
  }

  return (
    !filterOperators[condition.operator].takesValue ||
    Boolean(condition.right.trim())
  );
}

/** The conditions a run would actually check. */
export function usableFilterConditions(filter: WorkflowFilter) {
  return filter.conditions.filter(isConditionComplete);
}

/** True when this wire really stops anything: switched on, with a rule on it. */
export function isFilterActive(filter: WorkflowFilter) {
  return filter.enabled && usableFilterConditions(filter).length > 0;
}

/** True when the wire has a filter at all, finished or not. */
export function isFilterSet(filter: WorkflowFilter) {
  return filter.conditions.length > 0 || Boolean(filter.name.trim());
}

/** Conditions the user started and left half-written. */
export function incompleteFilterConditions(filter: WorkflowFilter) {
  return filter.conditions.filter((condition) => !isConditionComplete(condition));
}

/** What the wire's marker warns about, when it warns. */
export function filterNeeds(filter: WorkflowFilter) {
  if (!isFilterSet(filter) || !filter.enabled) {
    return undefined;
  }

  if (filter.conditions.length === 0) {
    return "This filter has no conditions yet";
  }

  if (usableFilterConditions(filter).length === 0) {
    return "No condition on this filter is finished";
  }

  if (incompleteFilterConditions(filter).length > 0) {
    return "Some conditions are unfinished and are skipped";
  }

  return undefined;
}

/** One condition as the run read it: both sides resolved, and the verdict. */
export type FilterConditionResult = {
  id: string;
  operator: FilterOperator;
  /** What was typed on the left, and what it came out as. */
  left: { template: string; value: string; missing: string[] };
  right: { template: string; value: string; missing: string[] };
  passed: boolean;
  /** Set when the comparison could not be made at all, e.g. a bad pattern. */
  problem: string | null;
};

export type FilterResult = {
  passed: boolean;
  /** True when there was nothing to check, so the wire simply let mail through. */
  skipped: boolean;
  match: FilterMatch;
  conditions: FilterConditionResult[];
  /** Conditions left half-written, which this run did not check. */
  skippedCount: number;
};

/**
 * Runs one wire's filter against the values the steps before it produced.
 *
 * A filter with nothing usable on it passes: an unfinished rule must never be
 * the reason an email stops, because the board would then be blocking mail for
 * a rule its author has not written yet.
 */
export function evaluateFilter(
  filter: WorkflowFilter,
  values: Map<string, string>
): FilterResult {
  const usable = usableFilterConditions(filter);

  if (!filter.enabled || usable.length === 0) {
    return {
      passed: true,
      skipped: true,
      match: filter.match,
      conditions: [],
      skippedCount: filter.conditions.length - usable.length,
    };
  }

  const conditions = usable.map((condition) =>
    evaluateCondition(condition, values, filter.caseSensitive)
  );
  const passed =
    filter.match === "all"
      ? conditions.every((condition) => condition.passed)
      : conditions.some((condition) => condition.passed);

  return {
    passed,
    skipped: false,
    match: filter.match,
    conditions,
    skippedCount: filter.conditions.length - usable.length,
  };
}

function evaluateCondition(
  condition: FilterCondition,
  values: Map<string, string>,
  caseSensitive: boolean
): FilterConditionResult {
  const left = resolveTemplate(condition.left, values);
  const right = resolveTemplate(condition.right, values);
  const outcome = compare({
    operator: condition.operator,
    left: left.value,
    right: right.value,
    caseSensitive,
  });

  return {
    id: condition.id,
    operator: condition.operator,
    left: { template: condition.left, ...left },
    right: { template: condition.right, ...right },
    passed: outcome.passed,
    problem: outcome.problem,
  };
}

type Comparison = { passed: boolean; problem: string | null };

const passes = (passed: boolean): Comparison => ({ passed, problem: null });
/** A comparison that could not be made counts as not passing, and says why. */
const fails = (problem: string): Comparison => ({ passed: false, problem });

function compare({
  operator,
  left,
  right,
  caseSensitive,
}: {
  operator: FilterOperator;
  left: string;
  right: string;
  caseSensitive: boolean;
}): Comparison {
  const fold = (value: string) => (caseSensitive ? value : value.toLowerCase());
  const a = fold(left);
  const b = fold(right);

  switch (operator) {
    case "contains":
      return passes(a.includes(b));
    case "not_contains":
      return passes(!a.includes(b));
    case "equals":
      return passes(a.trim() === b.trim());
    case "not_equals":
      return passes(a.trim() !== b.trim());
    case "starts_with":
      return passes(a.trimStart().startsWith(b.trim()));
    case "ends_with":
      return passes(a.trimEnd().endsWith(b.trim()));
    case "matches":
    case "not_matches": {
      const pattern = compilePattern(right, caseSensitive);

      if (!pattern) {
        return fails("That is not a valid pattern.");
      }

      const matched = pattern.test(left);

      return passes(operator === "matches" ? matched : !matched);
    }
    case "is_one_of":
    case "is_not_one_of": {
      const listed = splitList(right).map((entry) => fold(entry));
      const found = listed.includes(a.trim());

      return passes(operator === "is_one_of" ? found : !found);
    }
    case "is_empty":
      return passes(left.trim() === "");
    case "is_not_empty":
      return passes(left.trim() !== "");
    case "greater_than":
    case "greater_or_equal":
    case "less_than":
    case "less_or_equal":
      return compareNumbers(operator, left, right);
    case "is_true":
      return passes(readBoolean(left) === true);
    case "is_false":
      return passes(readBoolean(left) === false);
    case "before":
    case "after":
      return compareDates(operator, left, right);
  }
}

function compareNumbers(
  operator: "greater_than" | "greater_or_equal" | "less_than" | "less_or_equal",
  left: string,
  right: string
): Comparison {
  const a = readNumber(left);
  const b = readNumber(right);

  if (a === null || b === null) {
    return fails(
      a === null
        ? `“${truncate(left)}” is not a number.`
        : `“${truncate(right)}” is not a number.`
    );
  }

  if (operator === "greater_than") {
    return passes(a > b);
  }

  if (operator === "greater_or_equal") {
    return passes(a >= b);
  }

  if (operator === "less_than") {
    return passes(a < b);
  }

  return passes(a <= b);
}

function compareDates(
  operator: "before" | "after",
  left: string,
  right: string
): Comparison {
  const a = readDate(left);
  const b = readDate(right);

  if (a === null || b === null) {
    return fails(
      a === null
        ? `“${truncate(left)}” is not a date.`
        : `“${truncate(right)}” is not a date.`
    );
  }

  return passes(operator === "before" ? a < b : a > b);
}

/**
 * A pattern the user typed, compiled once per check. Invalid patterns are a
 * typo rather than a crash, so the caller reports them instead.
 */
function compilePattern(source: string, caseSensitive: boolean) {
  try {
    return new RegExp(source, caseSensitive ? "" : "i");
  } catch {
    return null;
  }
}

/** A comma- or newline-separated list, as people type one. */
function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readNumber(value: string) {
  const trimmed = value.trim().replace(/,/g, "");

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The `{{email.isUnread}}` family arrive as `"true"` / `"false"`, but a person
 * writing a rule may well have typed "yes" — so both read, and anything else
 * is neither.
 */
function readBoolean(value: string) {
  const trimmed = value.trim().toLowerCase();

  if (["true", "yes", "y", "1", "on"].includes(trimmed)) {
    return true;
  }

  if (["false", "no", "n", "0", "off", ""].includes(trimmed)) {
    return false;
  }

  return null;
}

function readDate(value: string) {
  const parsed = Date.parse(value.trim());

  return Number.isNaN(parsed) ? null : parsed;
}

function truncate(value: string) {
  const singleLine = value.replace(/\s+/g, " ").trim();

  return singleLine.length > 32 ? `${singleLine.slice(0, 31)}…` : singleLine;
}

/** One condition written out, e.g. `{{email.subject}} contains invoice`. */
export function conditionSummary(condition: FilterCondition) {
  const spec = filterOperators[condition.operator];
  const left = condition.left.trim() || "…";

  return spec.takesValue
    ? `${left} ${spec.label} ${condition.right.trim() || "…"}`
    : `${left} ${spec.label}`;
}

/** What the wire's marker is called: the filter's name, or what it checks. */
export function filterLabel(filter: WorkflowFilter) {
  const name = filter.name.trim();

  if (name) {
    return name;
  }

  const usable = usableFilterConditions(filter);

  if (usable.length === 0) {
    return "Filter";
  }

  return usable.length === 1
    ? conditionSummary(usable[0])
    : `${usable.length} conditions`;
}
