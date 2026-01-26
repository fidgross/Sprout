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
