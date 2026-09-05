-- Filters on the wires between workflow nodes.
--
-- A wire's filter is stored on the node the wire feeds, so the filters on the
-- wires into actions already ride along inside `outcomes`. The one wire whose
-- downstream node is not in that column is trigger → classification, which is
-- what this column holds.

alter table public.workflows
  add column if not exists classifier_filter jsonb not null default '{}'::jsonb;

comment on column public.workflows.classifier_filter is
  'Filter on the wire from the email watcher to the classification node. An empty object means no filter; the shape is WorkflowFilter in src/lib/workflow-filters.ts.';

alter table public.workflows
  drop constraint if exists workflows_classifier_filter_is_object;

alter table public.workflows
  add constraint workflows_classifier_filter_is_object
  check (jsonb_typeof(classifier_filter) = 'object');
