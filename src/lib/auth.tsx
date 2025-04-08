import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import type { User, AuthError } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'agent';
  referral_code?: string;
  last_login?: string;
  login_attempts?: number;
  two_factor_enabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  enableTwoFactor: () => Promise<{ success: boolean; secret?: string; error?: string }>;
  verifyTwoFactor: (token: string) => Promise<{ success: boolean; error?: string }>;
  sendTwoFactorCode: (email: string) => Promise<{ success: boolean; error?: string }>;
  isTwoFactorRequired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_PROFILE_FETCH_RETRIES = 3;
const PROFILE_FETCH_RETRY_DELAY = 1000; // 1 second

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);
  const [isTwoFactorRequired, setIsTwoFactorRequired] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function fetchProfile(userId: string, retryCount = 0): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.message.includes('no rows') && retryCount < MAX_PROFILE_FETCH_RETRIES) {
          await sleep(PROFILE_FETCH_RETRY_DELAY);
          return fetchProfile(userId, retryCount + 1);
        }
        throw error;
      }

      const userProfile = data as UserProfile;
      setProfile(userProfile);

      if (userProfile.two_factor_enabled) {
        setIsTwoFactorRequired(true);
      }
      
      return userProfile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  async function updateLoginStats(userId: string): Promise<void> {
    try {
      await supabase
        .from('profiles')
        .update({
          last_login: new Date().toISOString(),
          login_attempts: 0
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating login stats:', error);
    }
  }

  async function updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
    try {
      if (!user?.id) {
        return { success: false, error: 'User not authenticated' };
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      
      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      
      return { success: true };
    } catch (error) {
      const authError = error as AuthError;
      return { 
        success: false, 
        error: authError.message || 'Failed to update profile' 
      };
    }
  }

  async function signIn(
    email: string, 
    password: string, 
    rememberMe = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('login_attempts, last_login')
        .eq('email', email)
        .single();
      
      if (profileData && !profileError) {
        const lastLoginTime = new Date(profileData.last_login || 0).getTime();
        const currentTime = Date.now();
        
        if (
          profileData.login_attempts >= MAX_LOGIN_ATTEMPTS && 
          (currentTime - lastLoginTime) < LOCKOUT_DURATION
        ) {
          const minutesLeft = Math.ceil((LOCKOUT_DURATION - (currentTime - lastLoginTime)) / 60000);
          return { 
            success: false, 
            error: `Account temporarily locked. Try again in ${minutesLeft} minutes.` 
          };
        }
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        if (!profileError) {
          await supabase
            .from('profiles')
            .update({
              login_attempts: (profileData?.login_attempts || 0) + 1,
              last_login: new Date().toISOString()
            })
            .eq('email', email);
        }
        
        throw error;
      }
      
      if (data.user) {
        if (rememberMe && data.session) {
          localStorage.setItem('authSession', JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: new Date(Date.now() + data.session.expires_in * 1000).toISOString()
          }));
        }
        
        setUser(data.user);
        const userProfile = await fetchProfile(data.user.id);
        
        if (userProfile?.two_factor_enabled) {
          setPendingEmail(email);
          setIsTwoFactorRequired(true);
          return { success: true };
        }
        
        await updateLoginStats(data.user.id);

        if (userProfile) {
          navigate(userProfile.role === 'admin' ? '/admin' : '/dashboard');
        }
        
        return { success: true };
      }
      
      return { success: false, error: 'Login failed' };
    } catch (error) {
      const authError = error as AuthError;
      return { 
        success: false, 
        error: authError.message || 'Authentication failed' 
      };
    }
  }

  async function signOut(): Promise<void> {
    try {
      // First clear all auth data
      const clearAuthData = () => {
        localStorage.removeItem('authSession');
        localStorage.removeItem('supabase.auth.token');
        setUser(null);
        setProfile(null);
        setIsTwoFactorRequired(false);
        setPendingEmail(null);
      };

      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      // Clear data regardless of sign out success
      clearAuthData();

      // Log any errors but don't throw them
      if (error) {
        console.warn('Error during sign out:', error);
      }

      // Always redirect to home page
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local data and redirect
      localStorage.removeItem('authSession');
      localStorage.removeItem('supabase.auth.token');
      setUser(null);
      setProfile(null);
      setIsTwoFactorRequired(false);
      setPendingEmail(null);
      navigate('/', { replace: true });
    }
  }

  async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      const authError = error as AuthError;
      return { 
        success: false, 
        error: authError.message || 'Failed to send password reset email' 
      };
    }
  }

  async function enableTwoFactor(): Promise<{ success: boolean; secret?: string; error?: string }> {
    try {
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }
      
      const secret = 'EXAMPLESECRETKEY';
      
      await supabase
        .from('profiles')
        .update({
          two_factor_secret: secret,
          two_factor_enabled: false,
          two_factor_pending: true
        })
        .eq('id', user.id);
      
      return { 
        success: true,
        secret 
      };
    } catch (error) {
      const authError = error as AuthError;
      return { 
        success: false, 
        error: authError.message || 'Failed to enable two-factor authentication' 
      };
    }
  }

  async function verifyTwoFactor(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!user && !pendingEmail) {
        return { success: false, error: 'No active login attempt' };
      }
      
      const isValid = token.length === 6 && !isNaN(Number(token));
      
      if (!isValid) {
        return { success: false, error: 'Invalid authentication code' };
      }
      
      if (user) {
        await supabase
          .from('profiles')
          .update({
            two_factor_enabled: true,
            two_factor_pending: false
          })
          .eq('id', user.id);
        
        setProfile(prev => prev ? { 
          ...prev, 
          two_factor_enabled: true,
          two_factor_pending: false
        } : null);
      } else if (pendingEmail) {
        setIsTwoFactorRequired(false);
        setPendingEmail(null);
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('email', pendingEmail)
          .single();
        
        if (profileData?.role) {
          navigate(profileData.role === 'admin' ? '/admin' : '/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
      
      return { success: true };
    } catch (error) {
      const authError = error as AuthError;
      return { 
        success: false, 
        error: authError.message || 'Failed to verify authentication code' 
      };
    }
  }

  async function sendTwoFactorCode(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      setPendingEmail(email);
      return { success: true };
    } catch (error) {
      const authError = error as AuthError;
      return { 
        success: false, 
        error: authError.message || 'Failed to send authentication code' 
      };
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;

          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
        });

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialAuthCheckDone(true);
        }
      }
    }

    initializeAuth();
  }, []);

  useEffect(() => {
    if (!initialAuthCheckDone) return;

    if (!loading) {
      if (!user) {
        const authPaths = ['/signin', '/signup', '/test-referral', '/'];
        if (!authPaths.includes(window.location.pathname)) {
          navigate('/signin');
        }
      } else if (profile && !isTwoFactorRequired) {
        const currentPath = window.location.pathname;
        const authPaths = ['/signin', '/signup'];
        
        if (authPaths.includes(currentPath)) {
          navigate(profile.role === 'admin' ? '/admin' : '/dashboard');
        }
      }
    }
  }, [user, profile, loading, initialAuthCheckDone, isTwoFactorRequired, navigate]);

  const authContextValue: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    enableTwoFactor,
    verifyTwoFactor,
    sendTwoFactorCode,
    isTwoFactorRequired
  };

  if (!initialAuthCheckDone) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function RequireAuth({ 
  children, 
  adminOnly = false 
}: { 
  children: React.ReactNode; 
  adminOnly?: boolean 
}): JSX.Element | null {
  const { user, profile, loading, isTwoFactorRequired } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/signin');
      } else if (isTwoFactorRequired) {
        navigate('/verify-2fa');
      } else if (adminOnly && profile?.role !== 'admin') {
        navigate('/dashboard');
      }
    }
  }, [user, profile, loading, isTwoFactorRequired, navigate, adminOnly]);
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (isTwoFactorRequired) {
    return null;
  }
  
  return user ? <>{children}</> : null;
}