import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { ProfileForm } from './ProfileForm';
import { BankDetailsForm } from './BankDetailsForm';
import { KYCForm } from './KYCForm';

export function KYCPage() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Profile & KYC</h1>
            <p className="text-gray-400">
              Complete your profile and verify your identity
            </p>
          </div>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </Link>
        </div>

        {/* KYC Status */}
        <div className={`p-4 rounded-lg border ${
          profile?.kyc_status === 'verified'
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : 'bg-yellow-500/10 border-yellow-500/20'
        }`}>
          <div className="flex items-start gap-3">
            {profile?.kyc_status === 'verified' ? (
              <ShieldCheck className="text-emerald-400 flex-shrink-0" size={24} />
            ) : (
              <AlertTriangle className="text-yellow-400 flex-shrink-0" size={24} />
            )}
            <div>
              <h3 className={`font-semibold ${
                profile?.kyc_status === 'verified' ? 'text-emerald-400' : 'text-yellow-400'
              }`}>
                {profile?.kyc_status === 'verified'
                  ? 'KYC Verified'
                  : 'KYC Verification Required'}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {profile?.kyc_status === 'verified'
                  ? 'Your identity has been verified. You can now make investments.'
                  : 'Please complete your KYC verification to start investing.'}
              </p>
            </div>
          </div>
        </div>

        {/* Forms */}
        <div className="space-y-8">
          <ProfileForm />
          <BankDetailsForm />
          <KYCForm />
        </div>
      </div>
    </div>
  );
}