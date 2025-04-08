import React, { useState } from 'react';
import { Layers, ChevronDown, AlertCircle } from 'lucide-react';

interface ReferralData {
  referred_name: string;
  investment_amount: number;
  commission: number;
  created_at: string;
}

interface ReferralLevelCardProps {
  level: number;
  stats: {
    referrals: number;
    earnings: number;
  };
  commissionRate: number;
  referrals: ReferralData[];
}

export function ReferralLevelCard({ 
  level, 
  stats, 
  commissionRate, 
  referrals 
}: ReferralLevelCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const levelReferrals = referrals.filter(r => r.level === level);

  const totalMonthlyCommission = levelReferrals.reduce((sum, ref) => sum + (ref.commission ?? 0), 0);

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700 overflow-hidden hover:border-blue-500/50 transition-all duration-300">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Layers size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold">Level {level}</h3>
            <p className="text-sm text-gray-400">{commissionRate}% Commission</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-medium">₹{totalMonthlyCommission.toLocaleString()}</p>
            <p className="text-sm text-gray-400">{stats.referrals} Referrals</p>
          </div>
          <ChevronDown 
            size={20} 
            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-700 p-4">
          {levelReferrals.length > 0 ? (
            <div className="space-y-4">
              {levelReferrals.map((referral, index) => (
                <div key={index} className="bg-gray-700/30 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{referral.referred_name || 'Anonymous User'}</p>
                      <p className="text-sm text-gray-400">
                        Joined {new Date(referral.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400">₹{(referral.commission ?? 0).toLocaleString()}</p>
                      <p className="text-sm text-gray-400">Monthly Commission</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Investment</span>
                    <span>₹{(referral.investment_amount ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <AlertCircle size={24} className="mx-auto mb-2" />
              <p>No referrals at this level yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}