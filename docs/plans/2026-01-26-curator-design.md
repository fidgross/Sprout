# Curator - Technical Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered content discovery and learning platform for iOS that helps users stay informed without being overwhelmed.

**Architecture:** Backend-driven processing with Supabase + Trigger.dev handling content ingestion and AI summarization. iOS app (React Native/Expo) serves as a thin client fetching pre-computed summaries.

**Tech Stack:** React Native/Expo, Supabase (PostgreSQL + pgvector + Auth + Storage), Trigger.dev, Claude API, Deepgram, OpenAI Embeddings

---

## 1. Data Model

### Core Tables

```sql
-- Users and authentication
users
├── id (uuid, PK)
├── email (text, unique)
├── created_at (timestamptz)
├── preferences (jsonb: digest_time, theme, notifications)
└── onboarding_completed (boolean)

-- Topic hierarchy
topics
├── id (uuid, PK)
├── name (text)
├── slug (text, unique)
├── parent_id (uuid, FK → topics, nullable)
├── description (text)
├── icon (text)
└── is_system (boolean)

-- User's followed topics
user_topics
├── user_id (uuid, FK → users)
├── topic_id (uuid, FK → topics)
├── weight (float, default 1.0)
└── created_at (timestamptz)

-- Content sources (podcasts, channels, newsletters, blogs)
sources
├── id (uuid, PK)
├── name (text)
├── type (enum: podcast, newsletter, youtube, blog)
├── url (text)
├── feed_url (text)
├── image_url (text)
├── quality_score (int, 0-100)
├── subscriber_count (int)
├── last_crawled_at (timestamptz)
└── created_at (timestamptz)

-- Source to topic mapping
source_topics
├── source_id (uuid, FK → sources)
├── topic_id (uuid, FK → topics)
└── relevance (float)

-- Individual content items
content
├── id (uuid, PK)
├── source_id (uuid, FK → sources)
├── title (text)
├── url (text, unique)
├── published_at (timestamptz)
├── content_type (enum: episode, article, video, post)
├── raw_text (text)
├── duration_seconds (int, nullable)
├── audio_url (text, nullable)
├── embedding (vector(1536))
└── created_at (timestamptz)

-- AI-generated summaries
summaries
├── id (uuid, PK)
├── content_id (uuid, FK → content, unique)
├── headline (text)
├── takeaways (jsonb: array of strings)
├── deep_summary (text)
├── quotes (jsonb: array of strings)
└── processed_at (timestamptz)

-- User's interaction with content
user_content
├── user_id (uuid, FK → users)
├── content_id (uuid, FK → content)
├── status (enum: unread, read, saved, dismissed)
├── read_at (timestamptz)
├── saved_at (timestamptz)
├── rating (int, 1-5, nullable)
└── notes (text)

-- User's highlights within content
highlights
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── content_id (uuid, FK → content)
├── text (text)
├── note (text, nullable)
└── created_at (timestamptz)

-- User-created collections
collections
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── name (text)
├── description (text)
└── created_at (timestamptz)

-- Collection membership
collection_items
├── collection_id (uuid, FK → collections)
├── content_id (uuid, FK → content)
└── added_at (timestamptz)

-- Daily digests
digests
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── date (date)
├── content_ids (jsonb: array of uuids)
├── sent_at (timestamptz)
└── opened_at (timestamptz, nullable)
```

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        iOS App (Expo)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Onboard  │ │   Feed   │ │  Reader  │ │ Library  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Feed API │ │Search API│ │ User API │ │Export API│          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Platform                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Postgres │ │   Auth   │ │ Storage  │ │ Realtime │          │
│  │+pgvector │ │          │ │ (audio)  │ │          │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Trigger.dev Workers                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Podcast  │ │Newsletter│ │ YouTube  │ │   Blog   │          │
│  │ Crawler  │ │ Crawler  │ │ Crawler  │ │ Crawler  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────────┐          │
│  │            Summarization Pipeline                 │          │
│  │   Deepgram (transcribe) → Claude (summarize)     │          │
│  │         → OpenAI (embed) → Store                 │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. iOS App Structure

### Navigation

```
Tab Bar (4 tabs)
├── Home (Feed)
│   ├── Daily Digest (top section, collapsible)
│   ├── Content Cards (scrollable feed)
│   │   └── Card → Expanded View → Full Content
│   └── Filter bar (All | Podcasts | Articles | Videos)
│
├── Explore
│   ├── Browse Topics (grid of topic cards)
│   ├── Topic Detail (content for specific topic)
│   └── Add Source (paste URL to add new source)
│
├── Library
│   ├── Saved (bookmarked content)
│   ├── History (recently viewed)
│   ├── Notes (highlights & annotations)
│   └── Collections (user-created groups)
│
└── Profile
    ├── My Topics (manage followed topics)
    ├── Preferences (digest time, notifications)
    ├── Integrations (Notion, Obsidian)
    └── Account (subscription, sign out)
```

### Key Components

- **ContentCard**: Collapsed/expanded states, shows headline → takeaways
- **ContentReader**: Full summary view with quotes, related content
- **AudioPlayer**: Built-in player for podcasts with speed controls
- **SearchBar**: Hybrid keyword + semantic search
- **TopicPicker**: Onboarding and topic management

---

## 4. Content Processing Pipeline

### Podcast Ingestion
1. Fetch RSS feed → detect new episodes
2. Download audio file → store in Supabase Storage
3. Send to Deepgram → receive transcript
4. Claude: generate headline, takeaways, deep summary, quotes
5. OpenAI: generate embedding from full transcript
6. Store all in database, mark source as crawled

### YouTube Ingestion
1. Fetch channel via YouTube Data API → detect new videos
2. Fetch transcript (YouTube captions API, fallback to Deepgram)
3. Claude: summarize
4. OpenAI: embed
5. Store (video URL for playback, no file storage needed)

### Newsletter/Blog Ingestion
1. Fetch RSS feed → detect new posts
2. Fetch full article HTML → extract clean text (Mozilla Readability)
3. Claude: summarize
4. OpenAI: embed
5. Store

### Scheduling
- RSS-based sources: Check every hour
- YouTube channels: Check every 6 hours (API quota management)
- Full reprocessing: Weekly

### Claude Prompt Structure

```
You are summarizing content for busy professionals who want key insights fast.

Content Type: {podcast|video|article}
Source: {source_name}
Title: {title}

Content:
{full_text}

Generate a JSON response with:
- headline: One sentence capturing the core thesis (max 150 chars)
- takeaways: Array of 3-5 non-obvious, actionable insights
- deep_summary: 500-1000 word comprehensive summary
- quotes: Array of 2-3 memorable direct quotes

Focus on:
- Non-obvious insights over common knowledge
- Actionable implications
- Preserving nuance and caveats
```

---

## 5. Personalization & Recommendations

### Feed Scoring Formula

```
base_score = source_quality_score (0-100)

topic_match = weighted average of:
  - user's topic weights × content's topic relevance

recency_boost =
  - fresh content (< 24h): +20
  - recent (< 7d): +10
  - older: 0

engagement_signals =
  - similar users saved/read this: +5 per
  - user read similar content before: +10

final_score = base_score + topic_match + recency_boost + engagement_signals
```

### Implicit Learning

Track behavior to adjust topic weights:
- Read full summary → boost topic +1
- Saved item → boost topic +2, boost source +1
- Dismissed → reduce topic -1
- Time spent reading → proportional boost

### Theme Detection (Weekly Job)

1. Cluster recent content by embedding similarity
2. Identify emerging themes (multiple sources on same topic)
3. Create "Trending in [Topic]" cards

---

## 6. Knowledge Base & Search

### Search Implementation

**Keyword Search**: PostgreSQL full-text search on titles, summaries, content

**Semantic Search**:
- Query → OpenAI embedding → pgvector similarity search
- Returns conceptually related content even without keyword match

**Hybrid (Default)**:
- Run both searches
- Merge and deduplicate results
- Rank by relevance + user engagement history

### What's Indexed
- All content from followed topics
- Saved items (higher weight)
- User highlights and notes
- Collections

---

## 7. Integrations

### Notion Export
- OAuth connection
- Export single item or collection
- Creates page with: title, metadata, summary, takeaways, quotes, notes

### Obsidian Export
- Generate markdown with YAML frontmatter
- Share sheet → "Open in Obsidian"
- Or use Obsidian URI scheme

### Export Format

```markdown
---
title: "{title}"
source: "{source_name}"
date: {published_at}
type: {content_type}
topics: [{topics}]
url: {url}
---

## Key Takeaways
{takeaways as bullets}

## Summary
{deep_summary}

## Notable Quotes
{quotes as blockquotes}

## My Notes
{user_notes}
```

---

## 8. Daily Digest & Notifications

### Digest Generation (Trigger.dev scheduled job)

1. Run at each user's preferred time (grouped by timezone)
2. Query top 5-10 items from past 24h matching user's topics
3. Rank by personalization score + diversity
4. Store as digest record
5. Send push notification via Expo Push

### Notification Types

1. **Daily digest** (user's chosen time): "Your Tuesday digest: 7 new items"
2. **High-priority** (optional): "Trending: 5 sources covered [topic]"
3. **Saved reminder** (weekly): "You have 12 saved items"

---

## 9. Project Structure

```
curator/
├── apps/
│   └── mobile/                 # Expo React Native app
│       ├── app/                # Expo Router screens
│       ├── components/         # Reusable UI components
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities, API client
│       └── store/              # State management (Zustand)
│
├── packages/
│   └── shared/                 # Shared types and utilities
│       ├── types/              # TypeScript types
│       └── constants/          # Shared constants
│
├── supabase/
│   ├── migrations/             # Database migrations
│   ├── functions/              # Edge Functions
│   └── seed.sql                # Seed data (topics, sources)
│
├── trigger/                    # Trigger.dev jobs
│   ├── src/
│   │   ├── jobs/
│   │   │   ├── crawl-podcasts.ts
│   │   │   ├── crawl-youtube.ts
│   │   │   ├── crawl-newsletters.ts
│   │   │   ├── crawl-blogs.ts
│   │   │   ├── summarize-content.ts
│   │   │   ├── generate-embeddings.ts
│   │   │   └── send-digests.ts
│   │   └── lib/
│   │       ├── claude.ts
│   │       ├── deepgram.ts
│   │       ├── openai.ts
│   │       └── supabase.ts
│   └── trigger.config.ts
│
└── docs/
    └── plans/
```

---

## 10. External Services Required

| Service | Purpose | Estimated Cost |
|---------|---------|----------------|
| Supabase | Database, Auth, Storage, Edge Functions | Free tier → $25/mo |
| Trigger.dev | Job scheduling and execution | Free tier → $29/mo |
| Claude API | Content summarization | ~$0.003 per summary |
| Deepgram | Audio transcription | ~$0.01 per minute |
| OpenAI | Embeddings | ~$0.0001 per embedding |
| Expo | Push notifications, builds | Free tier → $29/mo |
| Apple Developer | App Store distribution | $99/year |

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
- Supabase setup (schema, auth, RLS policies)
- Expo app scaffold with navigation
- Basic UI components (ContentCard, TopicPicker)
- Trigger.dev setup with one crawler (podcasts)
- Summarization pipeline (Claude + OpenAI)

### Phase 2: Core App (Weeks 5-8)
- Complete all screens (Feed, Explore, Library, Profile)
- All content crawlers (YouTube, newsletters, blogs)
- Search implementation (keyword + semantic)
- User content state (read, saved, dismissed)

### Phase 3: Intelligence (Weeks 9-12)
- Personalization scoring and implicit learning
- Theme detection
- Daily digest generation and push notifications
- Notion/Obsidian integrations

### Phase 4: Polish (Weeks 13-14)
- Performance optimization
- Offline support
- Error handling and edge cases
- TestFlight beta
