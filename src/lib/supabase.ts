// import { createClient } from '@supabase/supabase-js';

// // Initialize Supabase client with custom settings
// export const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY,
//   {
//     auth: {
//       autoRefreshToken: true,
//       persistSession: true,
//       detectSessionInUrl: true,
//       storage: localStorage,
//       storageKey: 'supabase.auth.token',
//       flowType: 'pkce'
//     },
//     global: {
//       headers: {
//         'x-application-name': 'investment-platform',
//       },
//     },
//     realtime: {
//       params: {
//         eventsPerSecond: 10,
//       },
//     },
//     db: {
//       schema: 'public'
//     }
//   }
// );

// // Helper function to check if session is valid
// export async function isSessionValid(): Promise<boolean> {
//   try {
//     const { data: { session }, error } = await supabase.auth.getSession();
//     if (error) throw error;
//     return !!session;
//   } catch (error) {
//     console.error('Session validation error:', error);
//     return false;
//   }
// }

// // Helper function to refresh session
// export async function refreshSession(): Promise<void> {
//   try {
//     const { data: { session }, error } = await supabase.auth.refreshSession();
//     if (error) throw error;
//     if (!session) {
//       throw new Error('No session found');
//     }
//   } catch (error) {
//     console.error('Session refresh error:', error);
//     throw error;
//   }
// }

// // API request wrapper with automatic token refresh
// export async function apiRequest<T>(
//   callback: () => Promise<T>,
//   maxRetries = 1
// ): Promise<T> {
//   try {
//     return await callback();
//   } catch (error: any) {
//     if (error?.status === 401 && maxRetries > 0) {
//       try {
//         await refreshSession();
//         return apiRequest(callback, maxRetries - 1);
//       } catch (refreshError) {
//         throw new Error('Session refresh failed');
//       }
//     }
//     throw error;
//   }
// }

// // Helper to clear all auth data
// export function clearAuthData(): void {
//   localStorage.removeItem('supabase.auth.token');
//   localStorage.removeItem('supabase.auth.expires_at');
//   localStorage.removeItem('supabase.auth.refresh_token');
// }

// // Debug helper
// export async function checkAuthState(): Promise<void> {
//   const session = await supabase.auth.getSession();
//   console.log('Current session:', session);

//   const user = await supabase.auth.getUser();
//   console.log('Current user:', user);

//   if (user.data.user) {
//     const profile = await supabase
//       .from('profiles')
//       .select('*')
//       .eq('id', user.data.user.id)
//       .single();
//     console.log('User profile:', profile);
//   }
// }

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);