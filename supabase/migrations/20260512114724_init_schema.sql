-- Documents: tracks every file ingested
create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null,
  file_path text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Jobs: links Express to Celery via Redis task_id
create table jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id),
  celery_task_id text,
  status text default 'pending',
  error_message text,
  started_at timestamptz,
  finished_at timestamptz
);

-- Chunks: metadata for each embedded chunk
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id),
  chunk_text text,
  page_no int,
  chunk_index int,
  qdrant_point_id text
);

-- Connectors: stores OAuth tokens
create table connectors (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  access_token text,
  refresh_token text,
  page_token text,
  last_synced_at timestamptz
);
