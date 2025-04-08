import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResultType {
  valid: boolean;
  message: string;
  debug?: any;
}

export function ReferralCodeTester() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ResultType | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!code) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      // Log the code being checked
      console.log('Checking referral code:', code.toUpperCase());
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, referral_code')
        .eq('referral_code', code.toUpperCase())
        .maybeSingle();
      
      // Log the response
      console.log('Supabase response:', { data, error });
      
      if (error) {
        throw error;
      }

      const isValid = !!data;
      
      setResult({
        valid: isValid,
        message: isValid 
          ? `Valid referral code! You can use ${code.toUpperCase()} during signup.` 
          : `Invalid referral code. Please check and try again.`,
        debug: { 
          queriedCode: code.toUpperCase(),
          response: { data, error }
        }
      });
    } catch (error) {
      console.error('Error:', error);
      setResult({
        valid: false,
        message: 'An error occurred while checking the referral code. Please try again.',
        debug: { error }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
            Referral Code Checker
          </h2>
          <p className="mt-2 text-gray-400">
            Enter a referral code to verify if it's valid
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700 p-6 space-y-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="Enter referral code"
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleCheck}
              disabled={loading || !code}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Search size={18} />
                  Check
                </>
              )}
            </button>
          </div>
          
          {result && (
            <>
              <div className={`p-4 rounded-lg ${
                result.valid 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {result.message}
              </div>
              
              {/* Debug Information */}
              <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Debug Information</h3>
                <pre className="text-xs text-gray-500 overflow-x-auto">
                  {JSON.stringify(result.debug, null, 2)}
                </pre>
              </div>
            </>
          )}

          <div className="text-center text-sm text-gray-400">
            Don't have a referral code?{' '}
            <a href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
              Sign up here
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}