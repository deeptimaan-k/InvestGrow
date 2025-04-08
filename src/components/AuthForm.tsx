import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AuthFormProps {
  view: 'sign-in' | 'sign-up';
}

export function AuthForm({ view }: AuthFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [referralCodeValid, setReferralCodeValid] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    referralCode: searchParams.get('ref') || '',
    acceptTerms: false,
  });

  useEffect(() => {
    async function validateReferralCode() {
      if (!formData.referralCode) {
        setReferralCodeValid(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, direct_referrals')
          .eq('referral_code', formData.referralCode.toUpperCase())
          .maybeSingle();

        if (error) throw error;

        // Check if referrer exists and hasn't exceeded max referrals
        const isValid = data && data.direct_referrals < 10;
        setReferralCodeValid(!!isValid);

        if (!isValid) {
          if (!data) {
            toast.error('Invalid referral code');
          } else if (data.direct_referrals >= 10) {
            toast.error('This referral code has reached its maximum limit');
          }
        }
      } catch (error) {
        console.error('Error validating referral code:', error);
        setReferralCodeValid(false);
      }
    }

    if (view === 'sign-up' && formData.referralCode) {
      validateReferralCode();
    }
  }, [formData.referralCode, view]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === 'sign-up') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (!formData.acceptTerms) {
          throw new Error('Please accept the terms and conditions');
        }

        if (formData.referralCode && !referralCodeValid) {
          throw new Error('Invalid referral code');
        }

        // Create the user with metadata
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: 'agent',
              referrer_code: formData.referralCode ? formData.referralCode.toUpperCase() : null,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });

        if (signUpError) throw signUpError;

        // Verify the signup was successful
        if (!data.user) {
          throw new Error('Registration failed');
        }

        toast.success('Registration successful! Please check your email.');
        
        // Clear form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          fullName: '',
          referralCode: '',
          acceptTerms: false,
        });

      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) throw signInError;

        const { data: { user } } = await supabase.auth.getUser();
        const role = user?.user_metadata?.role;

        navigate(role === 'admin' ? '/admin' : '/dashboard');
        toast.success('Welcome back!');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg filter blur-xl"></div>
        <div className="relative bg-gray-800 p-8 rounded-lg border border-gray-700 shadow-xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
              {view === 'sign-in' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              {view === 'sign-in' ? "Don't have an account? " : "Already have an account? "}
              <a href={view === 'sign-in' ? '/signup' : '/signin'} className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                {view === 'sign-in' ? 'Sign up' : 'Sign in'}
              </a>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {view === 'sign-up' && (
              <div>
                <label htmlFor="fullName" className="sr-only">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="appearance-none w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    placeholder="Full Name"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="appearance-none w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="appearance-none w-full pl-10 pr-10 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {view === 'sign-up' && (
              <>
                <div>
                  <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="appearance-none w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                      placeholder="Confirm Password"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="referralCode" className="sr-only">Referral Code</label>
                  <div className="relative">
                    <input
                      id="referralCode"
                      name="referralCode"
                      type="text"
                      value={formData.referralCode}
                      onChange={handleInputChange}
                      className={`appearance-none w-full pl-3 pr-10 py-2 border rounded-md bg-gray-900 text-gray-300 placeholder-gray-500 focus:ring-2 ${
                        referralCodeValid === false
                          ? 'border-red-500 focus:ring-red-500'
                          : referralCodeValid === true
                          ? 'border-green-500 focus:ring-green-500'
                          : 'border-gray-700 focus:ring-blue-500'
                      } sm:text-sm`}
                      placeholder="Referral Code (optional)"
                    />
                    {formData.referralCode && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {referralCodeValid ? (
                          <CheckCircle2 size={20} className="text-green-500" />
                        ) : (
                          <XCircle size={20} className="text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {formData.referralCode && (
                    <p className={`mt-1 text-sm ${
                      referralCodeValid ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {referralCodeValid 
                        ? 'Valid referral code' 
                        : 'Invalid referral code'}
                    </p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    id="acceptTerms"
                    name="acceptTerms"
                    type="checkbox"
                    checked={formData.acceptTerms}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-400">
                    I agree to the{' '}
                    <a href="/terms" className="text-blue-400 hover:text-blue-300 underline">
                      terms and conditions
                    </a>
                  </label>
                </div>
              </>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {loading ? 'Loading...' : view === 'sign-in' ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}