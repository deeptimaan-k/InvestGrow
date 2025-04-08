import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  UserPlus, 
  TrendingUp, 
  Gift, 
  Users,
  RefreshCw,
  Layers,
  Shield,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ReferralCodeCard } from './referral/ReferralCodeCard';
import { CommissionStructureCard } from './referral/CommissionStructureCard';
import { ReferralStatsCard } from './referral/ReferralStatsCard';
import { QuickActionCard } from './referral/QuickActionCard';
import { ReferralLevelCard } from './referral/ReferralLevelCard';

interface ReferralStats {
  total_referrals: number;
  direct_referrals: number;
  total_earnings: number;
  earnings_by_level: {
    [key: number]: {
      referrals: number;
      earnings: number;
    }
  };
}

interface ReferralLevel {
  level: number;
  commission_rate: number;
}

interface ReferralData {
  referrer_id: string;
  referred_id: string;
  level: number;
  referred_name: string;
  investment_amount: number;
  monthly_roi: number;
  commission: number;
  created_at: string;
}

export function ReferralSystem() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [levels, setLevels] = useState<ReferralLevel[]>([]);
  const [referralTree, setReferralTree] = useState<ReferralData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReferralData = async () => {
    if (!profile?.id) return;

    try {
      setRefreshing(true);
      
      const [statsResponse, levelsResponse, treeResponse] = await Promise.all([
        supabase.rpc('get_referral_stats', {
          p_user_id: profile.id
        }),
        supabase
          .from('referral_levels')
          .select('*')
          .order('level'),
        supabase.rpc('get_referral_tree', {
          p_user_id: profile.id
        })
      ]);

      if (statsResponse.error) throw new Error(`Stats error: ${statsResponse.error.message}`);
      if (levelsResponse.error) throw new Error(`Levels error: ${levelsResponse.error.message}`);
      if (treeResponse.error) throw new Error(`Tree error: ${treeResponse.error.message}`);

      setStats(statsResponse.data[0]);
      setLevels(levelsResponse.data);
      setReferralTree(treeResponse.data);

    } catch (error) {
      console.error('Error fetching referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Referral System</h1>
            <p className="text-gray-400">
              Earn up to 10% commission on your referrals' investments
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={fetchReferralData}
              disabled={refreshing}
              className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Link
              to="/dashboard"
              className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Referral Code and Commission Structure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ReferralCodeCard referralCode={profile?.referral_code || ''} />
          <CommissionStructureCard levels={levels} />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <ReferralStatsCard
            icon={UserPlus}
            title="Total Referrals"
            value={stats?.total_referrals || 0}
            subtitle="Across all levels"
            trend={5}
          />
          <ReferralStatsCard
            icon={Users}
            title="Direct Referrals"
            value={`${stats?.direct_referrals || 0}/10`}
            subtitle="Level 1 referrals"
          />
          <ReferralStatsCard
            icon={TrendingUp}
            title="Total Earnings"
            value={`₹${(stats?.total_earnings || 0).toLocaleString()}`}
            trend={8}
          />
          <ReferralStatsCard
            icon={Gift}
            title="Rewards Status"
            value={stats?.direct_referrals >= 10 ? 'Maxed Out' : `${10 - (stats?.direct_referrals || 0)} More`}
            subtitle={stats?.direct_referrals >= 10 ? 'Congratulations!' : 'Until next reward'}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActionCard
            icon={Gift}
            title="Referral Rewards"
            subtitle="View your rewards"
            iconColor="text-emerald-400"
          />
          <QuickActionCard
            icon={TrendingUp}
            title="Performance"
            subtitle="View analytics"
            iconColor="text-blue-400"
          />
          <QuickActionCard
            icon={Users}
            title="Team Overview"
            subtitle="View your team"
            iconColor="text-purple-400"
          />
        </div>

        {/* Referral Levels */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Your Referral Network</h2>
          <div className="space-y-4">
            {levels.map(level => (
              <ReferralLevelCard
                key={level.level}
                level={level.level}
                stats={stats?.earnings_by_level?.[level.level] || { referrals: 0, earnings: 0 }}
                commissionRate={level.commission_rate}
                referrals={referralTree}
              />
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 rounded-lg w-fit">
                <UserPlus size={24} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold">1. Invite Friends</h3>
              <p className="text-gray-400">
                Share your referral code with friends and earn commissions when they invest
              </p>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg w-fit">
                <TrendingUp size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold">2. Earn Commissions</h3>
              <p className="text-gray-400">
                Get up to 10% commission on your referrals' monthly ROI payments
              </p>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-purple-500/10 rounded-lg w-fit">
                <Layers size={24} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold">3. Build Your Network</h3>
              <p className="text-gray-400">
                Earn from up to 10 levels deep in your referral network
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}