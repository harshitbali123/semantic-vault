-- Add missing sync metadata columns and uniqueness constraints

alter table connectors
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists page_token text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists total_files_synced integer default 0,
  add column if not exists is_active boolean default true;

alter table documents
  add column if not exists external_file_id text,
  add column if not exists external_modified_at timestamptz;

create index if not exists idx_documents_external_file_id
  on documents(external_file_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_external_file_unique'
      and conrelid = 'documents'::regclass
  ) then
    alter table documents
      add constraint documents_external_file_unique
      unique (user_id, external_file_id);
  end if;
end $$;