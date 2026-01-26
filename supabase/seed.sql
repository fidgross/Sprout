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
