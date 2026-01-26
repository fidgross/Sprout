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
