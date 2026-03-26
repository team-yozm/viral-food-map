import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

export function createServerSupabaseClient(
  revalidateSeconds = 300
): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => {
        const nextInit = init as NextFetchInit | undefined;

        return fetch(input, {
          ...(init ?? {}),
          next: {
            ...nextInit?.next,
            revalidate: nextInit?.next?.revalidate ?? revalidateSeconds,
          },
        });
      },
    },
  });
}
