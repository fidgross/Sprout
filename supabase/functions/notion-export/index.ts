import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotionExportRequest {
  contentId: string;
  accessToken: string;
  databaseId: string;
}

interface ContentWithSummary {
  id: string;
  title: string;
  url: string;
  published_at: string;
  content_type: string;
  source: {
    name: string;
    type: string;
  };
  summary: {
    headline: string;
    takeaways: string[];
    deep_summary: string | null;
    quotes: string[];
  } | null;
  user_content?: {
    notes: string | null;
  };
}

interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: unknown;
}

/**
 * Creates Notion blocks from content data following the export format spec.
 */
function createNotionBlocks(content: ContentWithSummary): NotionBlock[] {
  const blocks: NotionBlock[] = [];

  // Key Takeaways section
  if (content.summary?.takeaways && content.summary.takeaways.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Key Takeaways' } }],
      },
    });

    for (const takeaway of content.summary.takeaways) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: takeaway } }],
        },
      });
    }
  }

  // Summary section
  if (content.summary?.deep_summary) {
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Summary' } }],
      },
    });

    // Split summary into paragraphs (Notion has a 2000 char limit per block)
    const paragraphs = content.summary.deep_summary.split('\n\n').filter(p => p.trim());
    for (const paragraph of paragraphs) {
      // Further split if paragraph exceeds 2000 chars
      const chunks = splitTextIntoChunks(paragraph, 2000);
      for (const chunk of chunks) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }],
          },
        });
      }
    }
  }

  // Notable Quotes section
  if (content.summary?.quotes && content.summary.quotes.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Notable Quotes' } }],
      },
    });

    for (const quote of content.summary.quotes) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: [{ type: 'text', text: { content: quote } }],
        },
      });
    }
  }

  // My Notes section (if user has notes)
  if (content.user_content?.notes) {
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'My Notes' } }],
      },
    });

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: content.user_content.notes } }],
      },
    });
  }

  return blocks;
}

/**
 * Splits text into chunks of maximum length, trying to break at word boundaries.
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    // Find the last space before maxLength
    let splitIndex = remaining.lastIndexOf(' ', maxLength);
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Creates a page in Notion with the content summary.
 */
async function createNotionPage(
  accessToken: string,
  databaseId: string,
  content: ContentWithSummary
): Promise<{ id: string; url: string }> {
  const title = content.summary?.headline || content.title;
  const topics = content.content_type ? [content.content_type] : [];

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: {
        database_id: databaseId,
      },
      properties: {
        // Title property (required for database pages)
        Name: {
          title: [
            {
              text: {
                content: title.slice(0, 2000), // Notion has a 2000 char limit
              },
            },
          ],
        },
        // Optional properties - these will be created if they exist in the database
        // If they don't exist, Notion will ignore them
        ...(content.url && {
          URL: {
            url: content.url,
          },
        }),
        ...(content.source?.name && {
          Source: {
            rich_text: [
              {
                text: {
                  content: content.source.name,
                },
              },
            ],
          },
        }),
        ...(content.content_type && {
          Type: {
            select: {
              name: content.content_type,
            },
          },
        }),
        ...(content.published_at && {
          Date: {
            date: {
              start: content.published_at.split('T')[0],
            },
          },
        }),
        ...(topics.length > 0 && {
          Topics: {
            multi_select: topics.map(topic => ({ name: topic })),
          },
        }),
      },
      children: createNotionBlocks(content),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Notion API error:', response.status, errorBody);
    throw new Error(`Notion API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    url: data.url,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { contentId, accessToken, databaseId }: NotionExportRequest = await req.json();

    // Validate required fields
    if (!contentId) {
      return new Response(
        JSON.stringify({ error: 'contentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'accessToken is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!databaseId) {
      return new Response(
        JSON.stringify({ error: 'databaseId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch content with summary from database
    const { data: content, error: fetchError } = await supabase
      .from('content')
      .select(`
        *,
        source:sources(*),
        summary:summaries(*),
        user_content:user_content(*)
      `)
      .eq('id', contentId)
      .single();

    if (fetchError) {
      console.error('Error fetching content:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch content' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create page in Notion
    const notionPage = await createNotionPage(
      accessToken,
      databaseId,
      content as ContentWithSummary
    );

    return new Response(
      JSON.stringify({
        success: true,
        pageId: notionPage.id,
        pageUrl: notionPage.url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Export failed: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
