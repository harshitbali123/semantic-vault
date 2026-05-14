-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- DOCUMENTS
-- Tracks every file ingested into the system
-- ─────────────────────────────────────────────
create table documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  source      text not null check (source in ('upload','google_drive','notion','dropbox','onedrive')),
  file_path   text,
  mime_type   text,
  file_size   bigint,
  status      text not null default 'pending'
                check (status in ('pending','processing','done','error')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- CHUNKS
-- One row per text chunk embedded into Qdrant
-- ─────────────────────────────────────────────
create table chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid references documents(id) on delete cascade,
  chunk_text      text,
  page_no         integer,
  chunk_index     integer,
  qdrant_point_id text,     -- ID of the vector stored in Qdrant
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
-- JOBS
-- Links Express dispatch → Celery task via Redis
-- ─────────────────────────────────────────────
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid references documents(id) on delete cascade,
  celery_task_id  text,     -- key to poll in Redis result backend
  status          text not null default 'pending'
                    check (status in ('pending','started','success','failure')),
  error_message   text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
-- CONNECTORS
-- Stores OAuth tokens for cloud integrations
-- ─────────────────────────────────────────────
create table connectors (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  type            text not null check (type in ('google_drive','notion','dropbox','onedrive')),
  access_token    text,
  refresh_token   text,
  page_token      text,     -- Drive/OneDrive delta sync cursor
  last_synced_at  timestamptz,
  created_at      timestamptz default now(),
  unique(user_id, type)     -- one connector per type per user
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Users can only see their own data
-- ─────────────────────────────────────────────
alter table documents  enable row level security;
alter table chunks     enable row level security;
alter table jobs       enable row level security;
alter table connectors enable row level security;

-- documents: user sees only their own
create policy "users_own_documents" on documents
  for all using (auth.uid() = user_id);

-- chunks: user sees chunks of their own documents
create policy "users_own_chunks" on chunks
  for all using (
    document_id in (
      select id from documents where user_id = auth.uid()
    )
  );

-- jobs: user sees jobs for their own documents
create policy "users_own_jobs" on jobs
  for all using (
    document_id in (
      select id from documents where user_id = auth.uid()
    )
  );

-- connectors: user sees only their own connectors
create policy "users_own_connectors" on connectors
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- INDEXES for query performance
-- ─────────────────────────────────────────────
create index idx_documents_user_id    on documents(user_id);
create index idx_documents_status     on documents(status);
create index idx_chunks_document_id   on chunks(document_id);
create index idx_jobs_document_id     on jobs(document_id);
create index idx_jobs_celery_task_id  on jobs(celery_task_id);
create index idx_connectors_user_id   on connectors(user_id);