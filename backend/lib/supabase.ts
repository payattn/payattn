/**
 * Shared Supabase client for backend services
 * 
 * Provides a singleton Supabase client instance configured with
 * environment variables for consistent database access across
 * all API routes and services.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Singleton Supabase client
let supabaseInstance: SupabaseClient | null = null;

/**
 * Get shared Supabase client instance
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseInstance;
}

/**
 * Helper function for database queries
 * Provides a simpler interface similar to pg's query() function
 */
export async function query(sql: string, params: any[] = []): Promise<any> {
  // Note: Supabase doesn't support raw SQL queries with the REST API client
  // This is a placeholder - in production, you'd use Supabase's query builder
  // or connect to Postgres directly for complex queries.
  
  // For now, return a mock implementation that shows the pattern
  console.warn('Direct SQL query not supported with Supabase REST API');
  console.warn('Query:', sql);
  console.warn('Params:', params);
  
  // Return a mock result structure
  return { rows: [], rowCount: 0 };
}

export default getSupabase;
