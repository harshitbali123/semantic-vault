-- Add connector sync metadata and document storage tracking

alter table documents
  add column if not exists external_file_id text,
  add column if not exists external_modified_at timestamptz,
  add column if not exists storage_path text;

create index if not exists idx_documents_external_file_id
  on documents(external_file_id);

alter table connectors
  add column if not exists sync_cursor text,
  add column if not exists is_active boolean default true,
  add column if not exists total_files_synced integer default 0;
