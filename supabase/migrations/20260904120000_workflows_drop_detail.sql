-- The builder no longer has a description field under the workflow title, and
-- nothing else reads the column, so it goes rather than sitting here empty.

alter table public.workflows
  drop column if exists detail;
