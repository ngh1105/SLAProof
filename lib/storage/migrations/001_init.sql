-- SLAProof case store schema.
-- One row per SLA case; the case payload lives in the `data` JSONB column.
-- created_at / updated_at exist for ordering and operational queries.
create table if not exists cases (
  id          text primary key,
  data        jsonb        not null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);
