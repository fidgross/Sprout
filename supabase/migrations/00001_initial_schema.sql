-- Enable pgvector extension
create extension if not exists vector;

-- Enums
create type source_type as enum ('podcast', 'newsletter', 'youtube', 'blog');
create type content_type as enum ('episode', 'article', 'video', 'post');
create type content_status as enum ('unread', 'read', 'saved', 'dismissed');

-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  preferences jsonb default '{"digest_time": "07:00", "theme": "system", "notifications": true}'::jsonb,
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);

-- Topics
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  parent_id uuid references public.topics(id),
  description text,
  icon text,
  is_system boolean default true,
  created_at timestamptz default now()
);

-- User's followed topics
create table public.user_topics (
  user_id uuid references public.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  weight float default 1.0,
  created_at timestamptz default now(),
  primary key (user_id, topic_id)
);

-- Content sources
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type source_type not null,
  url text not null,
  feed_url text,
  image_url text,
  quality_score int default 50 check (quality_score >= 0 and quality_score <= 100),
  subscriber_count int default 0,
  last_crawled_at timestamptz,
  created_at timestamptz default now()
);

-- Source to topic mapping
create table public.source_topics (
  source_id uuid references public.sources(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  relevance float default 1.0,
  primary key (source_id, topic_id)
);

-- Content items
create table public.content (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete cascade not null,
  title text not null,
  url text unique not null,
  published_at timestamptz not null,
  content_type content_type not null,
  raw_text text,
  duration_seconds int,
  audio_url text,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Summaries
create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.content(id) on delete cascade unique not null,
  headline text not null,
  takeaways jsonb not null default '[]'::jsonb,
  deep_summary text,
  quotes jsonb default '[]'::jsonb,
  processed_at timestamptz default now()
);

-- User content interactions
create table public.user_content (
  user_id uuid references public.users(id) on delete cascade,
  content_id uuid references public.content(id) on delete cascade,
  status content_status default 'unread',
  read_at timestamptz,
  saved_at timestamptz,
  rating int check (rating >= 1 and rating <= 5),
  notes text,
  primary key (user_id, content_id)
);

-- Highlights
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  content_id uuid references public.content(id) on delete cascade not null,
  text text not null,
  note text,
  created_at timestamptz default now()
);

-- Collections
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Collection items
create table public.collection_items (
  collection_id uuid references public.collections(id) on delete cascade,
  content_id uuid references public.content(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (collection_id, content_id)
);

-- Digests
create table public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  date date not null,
  content_ids jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  opened_at timestamptz,
  unique (user_id, date)
);

-- Indexes for performance
create index idx_content_source on public.content(source_id);
create index idx_content_published on public.content(published_at desc);
create index idx_content_embedding on public.content using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index idx_user_content_status on public.user_content(user_id, status);
create index idx_summaries_content on public.summaries(content_id);

-- Full-text search index
alter table public.content add column fts tsvector
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(raw_text, ''))) stored;
create index idx_content_fts on public.content using gin(fts);

-- Row Level Security
alter table public.users enable row level security;
alter table public.user_topics enable row level security;
alter table public.user_content enable row level security;
alter table public.highlights enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.digests enable row level security;

-- Users can only see/edit their own data
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

create policy "Users can manage own topics" on public.user_topics for all using (auth.uid() = user_id);
create policy "Users can manage own content state" on public.user_content for all using (auth.uid() = user_id);
create policy "Users can manage own highlights" on public.highlights for all using (auth.uid() = user_id);
create policy "Users can manage own collections" on public.collections for all using (auth.uid() = user_id);
create policy "Users can manage own collection items" on public.collection_items for all
  using (collection_id in (select id from public.collections where user_id = auth.uid()));
create policy "Users can view own collection items" on public.collection_items for select using (collection_id in (select id from public.collections where user_id = auth.uid()));
create policy "Users can view own digests" on public.digests for select using (auth.uid() = user_id);

-- Public read access for content
create policy "Anyone can view topics" on public.topics for select to authenticated using (true);
create policy "Anyone can view sources" on public.sources for select to authenticated using (true);
create policy "Anyone can view content" on public.content for select to authenticated using (true);
create policy "Anyone can view summaries" on public.summaries for select to authenticated using (true);

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to auto-create user profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
