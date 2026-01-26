# Curator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Curator, an AI-powered content discovery iOS app with Supabase backend and Trigger.dev content processing.

**Architecture:** Monorepo with Expo mobile app, Supabase for backend (PostgreSQL + Auth + Edge Functions), and Trigger.dev for background content ingestion jobs.

**Tech Stack:** React Native/Expo, TypeScript, Supabase, Trigger.dev, Claude API, Deepgram, OpenAI

---

## Phase 1: Foundation

### Task 1: Initialize Monorepo Structure

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `apps/.gitkeep`
- Create: `packages/.gitkeep`

**Step 1: Initialize package.json**

```json
{
  "name": "curator",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "trigger"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "db:migrate": "cd supabase && supabase db push",
    "db:reset": "cd supabase && supabase db reset"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  },
  "packageManager": "npm@10.0.0"
}
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
```

**Step 3: Create .gitignore**

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
.expo/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Supabase
supabase/.branches
supabase/.temp

# Turbo
.turbo

# Expo
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/

# Testing
coverage/
```

**Step 4: Install dependencies and commit**

Run: `npm install`
Expected: Creates node_modules and package-lock.json

```bash
git add package.json turbo.json .gitignore
git commit -m "chore: initialize monorepo with Turborepo"
```

---

### Task 2: Create Expo Mobile App

**Files:**
- Create: `apps/mobile/` (via expo init)
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

**Step 1: Create Expo app with Router**

Run from project root:
```bash
cd apps
npx create-expo-app@latest mobile --template tabs
cd ..
```

Expected: Creates `apps/mobile/` with Expo Router tab template

**Step 2: Update app.json with Curator branding**

File: `apps/mobile/app.json`

```json
{
  "expo": {
    "name": "Curator",
    "slug": "curator",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "curator",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.curator.app"
    },
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

**Step 3: Add required dependencies**

Run:
```bash
cd apps/mobile
npx expo install @supabase/supabase-js zustand @tanstack/react-query expo-secure-store expo-linking
npm install --save-dev @types/react
cd ../..
```

**Step 4: Verify app runs**

Run: `cd apps/mobile && npx expo start --ios`
Expected: App opens in iOS Simulator with default tab navigation

**Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat: scaffold Expo mobile app with Router"
```

---

### Task 3: Setup Supabase Project

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/00001_initial_schema.sql`
- Create: `supabase/seed.sql`

**Step 1: Initialize Supabase**

Run:
```bash
npx supabase init
```

Expected: Creates `supabase/` directory with `config.toml`

**Step 2: Create initial schema migration**

File: `supabase/migrations/00001_initial_schema.sql`

```sql
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
```

**Step 3: Create seed data**

File: `supabase/seed.sql`

```sql
-- Seed topics
insert into public.topics (name, slug, description, icon) values
  ('Technology', 'technology', 'Software, hardware, and tech industry', '💻'),
  ('Artificial Intelligence', 'ai', 'Machine learning, LLMs, and AI applications', '🤖'),
  ('Startups', 'startups', 'Entrepreneurship, fundraising, and building companies', '🚀'),
  ('Health', 'health', 'Medicine, fitness, nutrition, and longevity', '🏥'),
  ('Finance', 'finance', 'Investing, economics, and personal finance', '💰'),
  ('Science', 'science', 'Research, discoveries, and scientific thinking', '🔬'),
  ('Productivity', 'productivity', 'Time management, habits, and getting things done', '⚡'),
  ('Psychology', 'psychology', 'Human behavior, cognition, and mental health', '🧠'),
  ('Business', 'business', 'Strategy, management, and leadership', '📈'),
  ('Design', 'design', 'UX, product design, and visual design', '🎨');

-- Set parent relationships (AI is child of Technology)
update public.topics set parent_id = (select id from public.topics where slug = 'technology')
  where slug = 'ai';

-- Seed some example sources
insert into public.sources (name, type, url, feed_url, quality_score) values
  ('Lex Fridman Podcast', 'podcast', 'https://lexfridman.com/podcast', 'https://lexfridman.com/feed/podcast/', 85),
  ('The Knowledge Project', 'podcast', 'https://fs.blog/knowledge-project-podcast/', 'https://theknowledgeproject.libsyn.com/rss', 90),
  ('Stratechery', 'newsletter', 'https://stratechery.com', 'https://stratechery.com/feed/', 95),
  ('Paul Graham Essays', 'blog', 'https://paulgraham.com', 'http://www.aaronsw.com/2002/feeds/pgessays.rss', 95),
  ('3Blue1Brown', 'youtube', 'https://youtube.com/@3blue1brown', null, 95);

-- Link sources to topics
insert into public.source_topics (source_id, topic_id, relevance)
select s.id, t.id, 1.0 from public.sources s, public.topics t
where (s.name = 'Lex Fridman Podcast' and t.slug in ('technology', 'ai', 'science'))
   or (s.name = 'The Knowledge Project' and t.slug in ('productivity', 'psychology', 'business'))
   or (s.name = 'Stratechery' and t.slug in ('technology', 'business', 'startups'))
   or (s.name = 'Paul Graham Essays' and t.slug in ('startups', 'technology'))
   or (s.name = '3Blue1Brown' and t.slug in ('science'));
```

**Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema with topics, sources, content tables"
```

---

### Task 4: Create Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/types/database.ts`
- Create: `packages/shared/tsconfig.json`

**Step 1: Create package.json**

File: `packages/shared/package.json`

```json
{
  "name": "@curator/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create tsconfig.json**

File: `packages/shared/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create database types**

File: `packages/shared/src/types/database.ts`

```typescript
// Generated types matching Supabase schema

export type SourceType = 'podcast' | 'newsletter' | 'youtube' | 'blog';
export type ContentType = 'episode' | 'article' | 'video' | 'post';
export type ContentStatus = 'unread' | 'read' | 'saved' | 'dismissed';

export interface User {
  id: string;
  email: string;
  preferences: UserPreferences;
  onboarding_completed: boolean;
  created_at: string;
}

export interface UserPreferences {
  digest_time: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  icon: string | null;
  is_system: boolean;
  created_at: string;
}

export interface UserTopic {
  user_id: string;
  topic_id: string;
  weight: number;
  created_at: string;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  feed_url: string | null;
  image_url: string | null;
  quality_score: number;
  subscriber_count: number;
  last_crawled_at: string | null;
  created_at: string;
}

export interface Content {
  id: string;
  source_id: string;
  title: string;
  url: string;
  published_at: string;
  content_type: ContentType;
  raw_text: string | null;
  duration_seconds: number | null;
  audio_url: string | null;
  created_at: string;
}

export interface Summary {
  id: string;
  content_id: string;
  headline: string;
  takeaways: string[];
  deep_summary: string | null;
  quotes: string[];
  processed_at: string;
}

export interface UserContent {
  user_id: string;
  content_id: string;
  status: ContentStatus;
  read_at: string | null;
  saved_at: string | null;
  rating: number | null;
  notes: string | null;
}

export interface Highlight {
  id: string;
  user_id: string;
  content_id: string;
  text: string;
  note: string | null;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Digest {
  id: string;
  user_id: string;
  date: string;
  content_ids: string[];
  sent_at: string | null;
  opened_at: string | null;
}

// Joined types for API responses
export interface ContentWithSummary extends Content {
  source: Source;
  summary: Summary | null;
  user_content?: UserContent;
}

export interface TopicWithCount extends Topic {
  content_count?: number;
}
```

**Step 4: Create index export**

File: `packages/shared/src/index.ts`

```typescript
export * from './types/database';
```

**Step 5: Install and commit**

Run: `npm install`

```bash
git add packages/shared
git commit -m "feat: add shared types package"
```

---

### Task 5: Setup Supabase Client in Mobile App

**Files:**
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/lib/auth.ts`
- Create: `apps/mobile/hooks/useAuth.ts`
- Modify: `apps/mobile/package.json`

**Step 1: Create Supabase client**

File: `apps/mobile/lib/supabase.ts`

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Step 2: Create auth utilities**

File: `apps/mobile/lib/auth.ts`

```typescript
import { supabase } from './supabase';

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
```

**Step 3: Create auth hook**

File: `apps/mobile/hooks/useAuth.ts`

```typescript
import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
```

**Step 4: Create environment file template**

File: `apps/mobile/.env.example`

```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Step 5: Install polyfill dependency**

Run:
```bash
cd apps/mobile
npx expo install react-native-url-polyfill
cd ../..
```

**Step 6: Commit**

```bash
git add apps/mobile/lib apps/mobile/hooks apps/mobile/.env.example
git commit -m "feat: add Supabase client and auth hooks"
```

---

### Task 6: Create App Navigation Structure

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx` (Home/Feed)
- Create: `apps/mobile/app/(tabs)/explore.tsx`
- Create: `apps/mobile/app/(tabs)/library.tsx`
- Create: `apps/mobile/app/(tabs)/profile.tsx`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/app/(auth)/sign-up.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`

**Step 1: Create root layout with auth routing**

File: `apps/mobile/app/_layout.tsx`

```typescript
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
```

**Step 2: Create auth layout**

File: `apps/mobile/app/(auth)/_layout.tsx`

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
```

**Step 3: Create sign-in screen**

File: `apps/mobile/app/(auth)/sign-in.tsx`

```typescript
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { signInWithEmail } from '../../lib/auth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Curator</Text>
        <Text style={styles.subtitle}>Learn more in less time</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  linkBold: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
```

**Step 4: Create sign-up screen**

File: `apps/mobile/app/(auth)/sign-up.tsx`

```typescript
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { signUpWithEmail } from '../../lib/auth';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password);
      Alert.alert('Success', 'Check your email to confirm your account');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your learning journey</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  linkBold: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
```

**Step 5: Create tabs layout**

File: `apps/mobile/app/(tabs)/_layout.tsx`

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
        },
        headerStyle: {
          backgroundColor: '#0f172a',
        },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

**Step 6: Create placeholder tab screens**

File: `apps/mobile/app/(tabs)/index.tsx`

```typescript
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Feed</Text>
      <Text style={styles.subtitle}>Content will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
});
```

File: `apps/mobile/app/(tabs)/explore.tsx`

```typescript
import { View, Text, StyleSheet } from 'react-native';

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore Topics</Text>
      <Text style={styles.subtitle}>Discover new content</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
});
```

File: `apps/mobile/app/(tabs)/library.tsx`

```typescript
import { View, Text, StyleSheet } from 'react-native';

export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Library</Text>
      <Text style={styles.subtitle}>Saved content and notes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
});
```

File: `apps/mobile/app/(tabs)/profile.tsx`

```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from '../../lib/auth';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**Step 7: Install icons**

Run:
```bash
cd apps/mobile
npx expo install @expo/vector-icons
cd ../..
```

**Step 8: Commit**

```bash
git add apps/mobile/app
git commit -m "feat: add navigation structure with auth flow and tab screens"
```

---

### Task 7: Setup Trigger.dev Project

**Files:**
- Create: `trigger/package.json`
- Create: `trigger/trigger.config.ts`
- Create: `trigger/src/client.ts`
- Create: `trigger/src/lib/supabase.ts`
- Create: `trigger/tsconfig.json`

**Step 1: Create package.json**

File: `trigger/package.json`

```json
{
  "name": "@curator/trigger",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "npx trigger.dev@latest dev",
    "deploy": "npx trigger.dev@latest deploy"
  },
  "dependencies": {
    "@trigger.dev/sdk": "^3.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "@anthropic-ai/sdk": "^0.14.0",
    "openai": "^4.24.0",
    "rss-parser": "^3.13.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create tsconfig.json**

File: `trigger/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create trigger config**

File: `trigger/trigger.config.ts`

```typescript
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "curator",
  runtime: "node",
  logLevel: "log",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ["./src/jobs"],
});
```

**Step 4: Create Supabase client**

File: `trigger/src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role key for backend operations (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

**Step 5: Create env template**

File: `trigger/.env.example`

```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
DEEPGRAM_API_KEY=your-deepgram-key
TRIGGER_SECRET_KEY=your-trigger-secret
```

**Step 6: Install dependencies and commit**

Run:
```bash
cd trigger
npm install
cd ..
```

```bash
git add trigger/
git commit -m "feat: setup Trigger.dev project structure"
```

---

### Task 8: Create RSS Crawl Job

**Files:**
- Create: `trigger/src/jobs/crawl-rss.ts`
- Create: `trigger/src/lib/rss.ts`

**Step 1: Create RSS parsing utility**

File: `trigger/src/lib/rss.ts`

```typescript
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['enclosure', 'enclosure'],
    ],
  },
});

export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  content: string;
  duration?: string;
  audioUrl?: string;
}

export async function parseRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  const feed = await parser.parseURL(feedUrl);

  return feed.items.map((item) => ({
    title: item.title || 'Untitled',
    link: item.link || '',
    pubDate: item.pubDate || new Date().toISOString(),
    content: item.contentSnippet || item.content || '',
    duration: item.duration,
    audioUrl: item.enclosure?.url,
  }));
}

export function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;

  // Handle HH:MM:SS or MM:SS format
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  // Handle seconds only
  const seconds = parseInt(duration, 10);
  return isNaN(seconds) ? null : seconds;
}
```

**Step 2: Create RSS crawl job**

File: `trigger/src/jobs/crawl-rss.ts`

```typescript
import { task, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "../lib/supabase";
import { parseRSSFeed, parseDuration } from "../lib/rss";

// Scheduled job to crawl all RSS sources every hour
export const crawlAllRSSSources = schedules.task({
  id: "crawl-all-rss-sources",
  cron: "0 * * * *", // Every hour
  run: async () => {
    // Get all RSS-based sources (podcasts, newsletters, blogs)
    const { data: sources, error } = await supabase
      .from("sources")
      .select("*")
      .in("type", ["podcast", "newsletter", "blog"])
      .not("feed_url", "is", null);

    if (error) {
      console.error("Failed to fetch sources:", error);
      throw error;
    }

    console.log(`Found ${sources.length} RSS sources to crawl`);

    // Crawl each source
    for (const source of sources) {
      await crawlSingleSource.trigger({ sourceId: source.id });
    }

    return { sourcesQueued: sources.length };
  },
});

// Task to crawl a single source
export const crawlSingleSource = task({
  id: "crawl-single-source",
  retry: {
    maxAttempts: 3,
  },
  run: async ({ sourceId }: { sourceId: string }) => {
    // Get source details
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      console.error("Source not found:", sourceId);
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (!source.feed_url) {
      console.log("No feed URL for source:", source.name);
      return { skipped: true };
    }

    console.log(`Crawling ${source.name}: ${source.feed_url}`);

    // Parse RSS feed
    const items = await parseRSSFeed(source.feed_url);
    console.log(`Found ${items.length} items in feed`);

    let newItems = 0;

    for (const item of items) {
      // Check if content already exists
      const { data: existing } = await supabase
        .from("content")
        .select("id")
        .eq("url", item.link)
        .single();

      if (existing) {
        continue; // Skip existing content
      }

      // Determine content type based on source type
      const contentType = source.type === "podcast" ? "episode" : "article";

      // Insert new content
      const { error: insertError } = await supabase.from("content").insert({
        source_id: source.id,
        title: item.title,
        url: item.link,
        published_at: new Date(item.pubDate).toISOString(),
        content_type: contentType,
        raw_text: item.content,
        duration_seconds: parseDuration(item.duration),
        audio_url: item.audioUrl,
      });

      if (insertError) {
        console.error("Failed to insert content:", insertError);
        continue;
      }

      newItems++;
    }

    // Update last_crawled_at
    await supabase
      .from("sources")
      .update({ last_crawled_at: new Date().toISOString() })
      .eq("id", sourceId);

    console.log(`Added ${newItems} new items from ${source.name}`);

    return { source: source.name, newItems };
  },
});
```

**Step 3: Commit**

```bash
git add trigger/src/
git commit -m "feat: add RSS crawl job for podcasts, newsletters, blogs"
```

---

### Task 9: Create Summarization Job

**Files:**
- Create: `trigger/src/lib/claude.ts`
- Create: `trigger/src/lib/openai.ts`
- Create: `trigger/src/jobs/summarize-content.ts`

**Step 1: Create Claude client**

File: `trigger/src/lib/claude.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SummaryResult {
  headline: string;
  takeaways: string[];
  deep_summary: string;
  quotes: string[];
}

export async function generateSummary(
  title: string,
  content: string,
  contentType: string,
  sourceName: string
): Promise<SummaryResult> {
  const prompt = `You are summarizing content for busy professionals who want key insights fast.

Content Type: ${contentType}
Source: ${sourceName}
Title: ${title}

Content:
${content.slice(0, 100000)} // Limit to ~100k chars

Generate a JSON response with:
- headline: One sentence capturing the core thesis (max 150 chars)
- takeaways: Array of 3-5 non-obvious, actionable insights
- deep_summary: 500-1000 word comprehensive summary
- quotes: Array of 2-3 memorable direct quotes from the content

Focus on:
- Non-obvious insights over common knowledge
- Actionable implications
- Preserving nuance and caveats

Respond with valid JSON only, no markdown code blocks.`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    return JSON.parse(text) as SummaryResult;
  } catch (e) {
    console.error("Failed to parse Claude response:", text);
    throw new Error("Invalid JSON response from Claude");
  }
}
```

**Step 2: Create OpenAI client for embeddings**

File: `trigger/src/lib/openai.ts`

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  // Limit text to ~8000 tokens (~32000 chars)
  const truncatedText = text.slice(0, 32000);

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: truncatedText,
  });

  return response.data[0].embedding;
}
```

**Step 3: Create summarization job**

File: `trigger/src/jobs/summarize-content.ts`

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { supabase } from "../lib/supabase";
import { generateSummary } from "../lib/claude";
import { generateEmbedding } from "../lib/openai";

// Task to summarize a single piece of content
export const summarizeContent = task({
  id: "summarize-content",
  retry: {
    maxAttempts: 3,
  },
  run: async ({ contentId }: { contentId: string }) => {
    // Get content with source
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("*, source:sources(*)")
      .eq("id", contentId)
      .single();

    if (contentError || !content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Check if already summarized
    const { data: existingSummary } = await supabase
      .from("summaries")
      .select("id")
      .eq("content_id", contentId)
      .single();

    if (existingSummary) {
      console.log("Content already summarized:", contentId);
      return { skipped: true };
    }

    // Need text content to summarize
    if (!content.raw_text) {
      console.log("No raw text for content:", contentId);
      return { skipped: true, reason: "no_text" };
    }

    console.log(`Summarizing: ${content.title}`);

    // Generate summary with Claude
    const summary = await generateSummary(
      content.title,
      content.raw_text,
      content.content_type,
      content.source.name
    );

    // Insert summary
    const { error: summaryError } = await supabase.from("summaries").insert({
      content_id: contentId,
      headline: summary.headline,
      takeaways: summary.takeaways,
      deep_summary: summary.deep_summary,
      quotes: summary.quotes,
    });

    if (summaryError) {
      throw new Error(`Failed to insert summary: ${summaryError.message}`);
    }

    // Generate embedding
    const textForEmbedding = `${content.title}\n\n${summary.headline}\n\n${summary.takeaways.join("\n")}\n\n${content.raw_text}`;
    const embedding = await generateEmbedding(textForEmbedding);

    // Update content with embedding
    const { error: embeddingError } = await supabase
      .from("content")
      .update({ embedding })
      .eq("id", contentId);

    if (embeddingError) {
      console.error("Failed to store embedding:", embeddingError);
      // Don't throw - summary was saved successfully
    }

    console.log(`Summarized: ${content.title}`);

    return {
      contentId,
      headline: summary.headline,
      takeawaysCount: summary.takeaways.length,
    };
  },
});

// Task to process all unsummarized content
export const summarizeAllPending = task({
  id: "summarize-all-pending",
  run: async () => {
    // Get content without summaries
    const { data: pendingContent, error } = await supabase
      .from("content")
      .select("id")
      .is("embedding", null) // No embedding means not processed
      .not("raw_text", "is", null) // Has text to summarize
      .order("published_at", { ascending: false })
      .limit(50); // Process in batches

    if (error) {
      throw error;
    }

    console.log(`Found ${pendingContent.length} items to summarize`);

    for (const content of pendingContent) {
      await summarizeContent.trigger({ contentId: content.id });
    }

    return { queued: pendingContent.length };
  },
});
```

**Step 4: Commit**

```bash
git add trigger/src/lib/claude.ts trigger/src/lib/openai.ts trigger/src/jobs/summarize-content.ts
git commit -m "feat: add content summarization job with Claude and embeddings"
```

---

## Phase 2: Core App Features

### Task 10: Create ContentCard Component

**Files:**
- Create: `apps/mobile/components/ContentCard.tsx`
- Create: `apps/mobile/components/ContentCard.styles.ts`

**Step 1: Create ContentCard component**

File: `apps/mobile/components/ContentCard.tsx`

```typescript
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContentWithSummary } from '@curator/shared';

interface ContentCardProps {
  content: ContentWithSummary;
  onPress: () => void;
  onSave: () => void;
  onDismiss: () => void;
}

const SOURCE_ICONS: Record<string, string> = {
  podcast: 'mic',
  newsletter: 'mail',
  youtube: 'logo-youtube',
  blog: 'document-text',
};

export function ContentCard({
  content,
  onPress,
  onSave,
  onDismiss,
}: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const isSaved = content.user_content?.status === 'saved';
  const sourceIcon = SOURCE_ICONS[content.source.type] || 'document';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.sourceInfo}>
          <Ionicons name={sourceIcon as any} size={16} color="#64748b" />
          <Text style={styles.sourceName}>{content.source.name}</Text>
        </View>
        {content.duration_seconds && (
          <Text style={styles.duration}>
            {formatDuration(content.duration_seconds)}
          </Text>
        )}
      </View>

      {/* Headline */}
      <Text style={styles.headline}>
        {content.summary?.headline || content.title}
      </Text>

      {/* Expanded: Takeaways */}
      {expanded && content.summary?.takeaways && (
        <View style={styles.takeaways}>
          {content.summary.takeaways.map((takeaway, index) => (
            <View key={index} style={styles.takeawayRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.takeawayText}>{takeaway}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            onSave();
          }}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isSaved ? '#3b82f6' : '#64748b'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onPress}>
          <Text style={styles.readMore}>
            {expanded ? 'Read full summary' : 'See more'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <Ionicons name="close-circle-outline" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceName: {
    fontSize: 14,
    color: '#64748b',
  },
  duration: {
    fontSize: 12,
    color: '#64748b',
  },
  headline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  takeaways: {
    marginTop: 16,
    gap: 8,
  },
  takeawayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    color: '#3b82f6',
    fontSize: 16,
  },
  takeawayText: {
    flex: 1,
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  readMore: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
});
```

**Step 2: Commit**

```bash
git add apps/mobile/components/
git commit -m "feat: add ContentCard component with expandable takeaways"
```

---

This plan continues with additional tasks for:
- Task 11: Feed API and data fetching
- Task 12: Topic picker component
- Task 13: Onboarding flow
- Task 14: Content reader screen
- Task 15: Search implementation
- Task 16: Library screens (Saved, History, Notes)
- Task 17: Collections feature
- Task 18: YouTube crawler
- Task 19: Daily digest job
- Task 20: Push notifications
- Task 21: Notion integration
- Task 22: Obsidian export
- Task 23: Personalization scoring
- Task 24: Theme detection

---

## Summary

**Phase 1 (Tasks 1-9):** Foundation
- Monorepo setup, Expo app, Supabase schema, Trigger.dev, RSS crawler, summarization

**Phase 2 (Tasks 10-18):** Core App
- ContentCard, Feed, Topics, Onboarding, Reader, Search, Library, YouTube crawler

**Phase 3 (Tasks 19-24):** Intelligence
- Digest, Push notifications, Integrations, Personalization, Theme detection

Each task is designed to be completed in 15-30 minutes and results in a working, committable increment.
