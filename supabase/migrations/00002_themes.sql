-- Themes table for storing detected trending themes
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade not null,
  title text not null,
  content_ids jsonb not null default '[]'::jsonb,
  detected_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Indexes for performance
create index idx_themes_topic on public.themes(topic_id);
create index idx_themes_expires on public.themes(expires_at);
create index idx_themes_detected on public.themes(detected_at desc);

-- Public read access for themes (authenticated users can view)
create policy "Anyone can view themes" on public.themes for select to authenticated using (true);

-- Enable RLS
alter table public.themes enable row level security;
