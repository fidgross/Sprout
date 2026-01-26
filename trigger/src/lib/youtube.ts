import { google } from "googleapis";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number | null;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

/**
 * Extract channel ID from various YouTube URL formats
 * Supports:
 * - https://www.youtube.com/channel/UCxxxxxx
 * - https://www.youtube.com/c/ChannelName
 * - https://www.youtube.com/@handle
 * - https://youtube.com/user/username
 * - Direct channel ID
 */
export async function extractChannelId(
  urlOrId: string
): Promise<string | null> {
  // Already a channel ID (starts with UC and is 24 chars)
  if (/^UC[\w-]{22}$/.test(urlOrId)) {
    return urlOrId;
  }

  try {
    const url = new URL(urlOrId);

    // Direct channel URL: /channel/UCxxxxxx
    const channelMatch = url.pathname.match(/\/channel\/(UC[\w-]{22})/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // Handle URL: /@handle
    const handleMatch = url.pathname.match(/\/@([\w-]+)/);
    if (handleMatch) {
      return await resolveHandleToChannelId(handleMatch[1]);
    }

    // Custom URL: /c/ChannelName
    const customMatch = url.pathname.match(/\/c\/([\w-]+)/);
    if (customMatch) {
      return await resolveCustomUrlToChannelId(customMatch[1]);
    }

    // User URL: /user/username
    const userMatch = url.pathname.match(/\/user\/([\w-]+)/);
    if (userMatch) {
      return await resolveUsernameToChannelId(userMatch[1]);
    }
  } catch {
    // Not a valid URL, might be a handle or username
    if (urlOrId.startsWith("@")) {
      return await resolveHandleToChannelId(urlOrId.slice(1));
    }
  }

  return null;
}

async function resolveHandleToChannelId(handle: string): Promise<string | null> {
  try {
    const response = await youtube.channels.list({
      part: ["id"],
      forHandle: handle,
    });

    return response.data.items?.[0]?.id || null;
  } catch (error) {
    console.error(`Failed to resolve handle @${handle}:`, error);
    return null;
  }
}

async function resolveCustomUrlToChannelId(
  customUrl: string
): Promise<string | null> {
  try {
    // Search for the channel by custom URL
    const response = await youtube.search.list({
      part: ["snippet"],
      q: customUrl,
      type: ["channel"],
      maxResults: 1,
    });

    return response.data.items?.[0]?.snippet?.channelId || null;
  } catch (error) {
    console.error(`Failed to resolve custom URL ${customUrl}:`, error);
    return null;
  }
}

async function resolveUsernameToChannelId(
  username: string
): Promise<string | null> {
  try {
    const response = await youtube.channels.list({
      part: ["id"],
      forUsername: username,
    });

    return response.data.items?.[0]?.id || null;
  } catch (error) {
    console.error(`Failed to resolve username ${username}:`, error);
    return null;
  }
}

/**
 * Get videos from a channel published since a given date
 */
export async function getChannelVideos(
  channelId: string,
  since?: Date
): Promise<YouTubeVideo[]> {
  const videos: YouTubeVideo[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const searchResponse = await youtube.search.list({
        part: ["snippet"],
        channelId,
        type: ["video"],
        order: "date",
        maxResults: 50,
        publishedAfter: since?.toISOString(),
        pageToken,
      });

      const videoIds =
        searchResponse.data.items
          ?.map((item) => item.id?.videoId)
          .filter((id): id is string => !!id) || [];

      if (videoIds.length === 0) {
        break;
      }

      // Get video details including duration
      const videoResponse = await youtube.videos.list({
        part: ["contentDetails", "snippet"],
        id: videoIds,
      });

      for (const video of videoResponse.data.items || []) {
        if (!video.id || !video.snippet) continue;

        videos.push({
          videoId: video.id,
          title: video.snippet.title || "Untitled",
          description: video.snippet.description || "",
          publishedAt: video.snippet.publishedAt || new Date().toISOString(),
          durationSeconds: parseDuration(video.contentDetails?.duration),
        });
      }

      pageToken = searchResponse.data.nextPageToken || undefined;

      // Stop if we've gone past our date threshold
      const oldestVideo = videos[videos.length - 1];
      if (since && oldestVideo && new Date(oldestVideo.publishedAt) < since) {
        break;
      }

      // Limit to prevent excessive API usage
      if (videos.length >= 100) {
        break;
      }
    } while (pageToken);
  } catch (error: unknown) {
    const apiError = error as { code?: number; message?: string };
    if (apiError.code === 403) {
      console.error("YouTube API quota exceeded");
      throw new Error("YouTube API quota exceeded");
    }
    throw error;
  }

  return videos;
}

/**
 * Parse ISO 8601 duration (PT#H#M#S) to seconds
 */
function parseDuration(duration: string | undefined | null): number | null {
  if (!duration) return null;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get video transcript using youtube-transcript package
 */
export async function getVideoTranscript(
  videoId: string
): Promise<string | null> {
  try {
    // Dynamic import to handle the ES module
    const { YoutubeTranscript } = await import("youtube-transcript");

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      return null;
    }

    // Combine all text segments
    return transcript.map((segment) => segment.text).join(" ");
  } catch (error: unknown) {
    const err = error as { message?: string };
    // Transcript not available for this video
    console.log(
      `Transcript not available for video ${videoId}:`,
      err.message || "Unknown error"
    );
    return null;
  }
}

/**
 * Build YouTube video URL from video ID
 */
export function buildVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
