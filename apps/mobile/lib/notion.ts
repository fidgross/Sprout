import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const NOTION_TOKEN_KEY = 'notion_integration_token';
const NOTION_DATABASE_ID_KEY = 'notion_database_id';

export interface NotionCredentials {
  accessToken: string;
  databaseId: string;
}

export interface NotionExportResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
}

/**
 * Saves Notion credentials to SecureStore.
 * For MVP, users manually enter their integration token and database ID.
 */
export async function saveNotionCredentials(credentials: NotionCredentials): Promise<void> {
  await SecureStore.setItemAsync(NOTION_TOKEN_KEY, credentials.accessToken);
  await SecureStore.setItemAsync(NOTION_DATABASE_ID_KEY, credentials.databaseId);
}

/**
 * Retrieves stored Notion credentials from SecureStore.
 */
export async function getNotionCredentials(): Promise<NotionCredentials | null> {
  const accessToken = await SecureStore.getItemAsync(NOTION_TOKEN_KEY);
  const databaseId = await SecureStore.getItemAsync(NOTION_DATABASE_ID_KEY);

  if (!accessToken || !databaseId) {
    return null;
  }

  return { accessToken, databaseId };
}

/**
 * Clears stored Notion credentials.
 */
export async function clearNotionCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(NOTION_TOKEN_KEY);
  await SecureStore.deleteItemAsync(NOTION_DATABASE_ID_KEY);
}

/**
 * Checks if Notion is connected (credentials are stored).
 */
export async function isNotionConnected(): Promise<boolean> {
  const credentials = await getNotionCredentials();
  return credentials !== null;
}

/**
 * Validates that the Notion credentials work by attempting to query the database.
 */
export async function validateNotionCredentials(credentials: NotionCredentials): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${credentials.databaseId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Exports content to Notion via the Supabase Edge Function.
 */
export async function exportToNotion(contentId: string): Promise<NotionExportResult> {
  const credentials = await getNotionCredentials();

  if (!credentials) {
    return {
      success: false,
      error: 'Notion is not connected. Please connect your Notion account in Settings.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('notion-export', {
      body: {
        contentId,
        accessToken: credentials.accessToken,
        databaseId: credentials.databaseId,
      },
    });

    if (error) {
      console.error('Notion export error:', error);
      return {
        success: false,
        error: error.message || 'Failed to export to Notion',
      };
    }

    if (data.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      pageId: data.pageId,
      pageUrl: data.pageUrl,
    };
  } catch (error) {
    console.error('Notion export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Helper to extract database ID from a Notion URL.
 * Supports formats:
 * - https://www.notion.so/workspace/database_id
 * - https://www.notion.so/database_id
 * - https://www.notion.so/workspace/database_id?v=...
 * - Plain database ID
 */
export function extractDatabaseId(input: string): string | null {
  // If it's already a valid database ID format (32 chars, alphanumeric with hyphens)
  const cleanInput = input.trim();
  if (/^[a-f0-9]{32}$/i.test(cleanInput.replace(/-/g, ''))) {
    // Return in hyphenated format
    const id = cleanInput.replace(/-/g, '');
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }

  // Try to extract from URL
  try {
    const url = new URL(cleanInput);
    if (!url.hostname.includes('notion.so')) {
      return null;
    }

    // Get the last path segment (before any query params)
    const pathParts = url.pathname.split('/').filter(p => p);
    const lastPart = pathParts[pathParts.length - 1];

    if (!lastPart) {
      return null;
    }

    // Extract the database ID (last 32 characters before any query params)
    const match = lastPart.match(/([a-f0-9]{32})/i);
    if (match) {
      const id = match[1];
      return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    }
  } catch {
    // Not a valid URL, return null
  }

  return null;
}
