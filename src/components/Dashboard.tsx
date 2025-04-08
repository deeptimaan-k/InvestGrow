import React, { useEffect, useState } from 'react';
import { format, addMonths } from 'date-fns';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { 
  TrendingUp, 
  Users, 
  Wallet, 
  Calendar,
  ArrowUpRight,
  Clock,
  BadgeDollarSign,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Investment {
  id: string;
  amount: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface Earning {
  amount: number;
  payout_date: string;
  status: string;
}

interface ReferralEarning {
  amount: number;
  level: number;
  created_at: string;
}

interface ReferralData {
  referrer_id: string;
  referred_id: string;
  level: number;
  full_name: string;
  investment_amount: number;
  monthly_roi: number;
  commission: number;
  created_at: string;
}

function DashboardCard({ 
  title, 
  value, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  trend?: number;
}) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 mb-1">{title}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-white">{value}</h3>
          {trend && (
            <p className="flex items-center mt-2 text-emerald-400">
              <ArrowUpRight size={16} className="mr-1" />
              {trend}%
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <Icon size={24} className="text-blue-400" />
        </div>
      </div>
    </div>
  );
}

function InvestmentCard({ investment }: { investment: Investment }) {
  const startDate = new Date(investment.start_date);
  const endDate = new Date(investment.end_date);
  const totalMonths = 40;
  const monthsPassed = Math.min(
    Math.floor((Date.now() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)),
    totalMonths
  );
  const progress = (monthsPassed / totalMonths) * 100;
  const monthlyROI = investment.amount * 0.05;
  const nextPayout = addMonths(startDate, monthsPassed + 1);

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg sm:text-xl font-semibold">₹{investment.amount.toLocaleString()}</h3>
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-sm">
          Active
        </span>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Monthly ROI</p>
            <p className="text-white font-medium">₹{monthlyROI.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-400">Next Payout</p>
            <p className="text-white font-medium">{format(nextPayout, 'MMM dd, yyyy')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { profile } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [referralTree, setReferralTree] = useState<ReferralData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!profile?.id) return;

      try {
        const [
          { data: investmentsData },
          { data: earningsData },
          { data: referralData }
        ] = await Promise.all([
          supabase
            .from('investments')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('earnings')
            .select('*')
            .eq('user_id', profile.id)
            .order('payout_date', { ascending: false }),
          supabase
            .rpc('get_referral_tree', {
              p_user_id: profile.id
            })
        ]);

        setInvestments(investmentsData || []);
        setEarnings(earningsData || []);

        if (referralData) {
          const formattedReferrals: ReferralData[] = referralData.map(ref => ({
            referrer_id: ref.referrer_id,
            referred_id: ref.referred_id,
            level: ref.level,
            full_name: ref.referred_name || 'Unknown User',
            investment_amount: ref.investment_amount || 0,
            monthly_roi: (ref.investment_amount || 0) * 0.05,
            commission: calculateCommission(ref.level, ref.investment_amount || 0),
            created_at: new Date().toISOString()
          }));
          setReferralTree(formattedReferrals);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [profile?.id]);

  const calculateCommission = (level: number, amount: number): number => {
    const monthlyROI = amount * 0.05;
    if (level === 1) return monthlyROI * 0.10; // 10%
    if (level <= 5) return monthlyROI * 0.05; // 5%
    return monthlyROI * 0.02; // 2%
  };

  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalEarnings = earnings.reduce((sum, earn) => sum + earn.amount, 0);
  const totalReferralEarnings = referralTree.reduce((sum, ref) => sum + ref.commission, 0);

  // Prepare data for earnings chart
  const earningsChartData = {
    labels: earnings.slice(0, 12).map(e => format(new Date(e.payout_date), 'MMM yyyy')).reverse(),
    datasets: [{
      label: 'Monthly Earnings',
      data: earnings.slice(0, 12).map(e => e.amount).reverse(),
      fill: true,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 1)',
      tension: 0.4
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: 'rgba(156, 163, 175, 1)',
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        grid: {
          color: 'rgba(55, 65, 81, 0.5)'
        },
        ticks: {
          color: 'rgba(156, 163, 175, 1)'
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {profile?.full_name}
            </h1>
            <p className="text-gray-400">
              Here's what's happening with your investments today.
            </p>
          </div>
          <div className="flex gap-2 md:gap-4 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-4 md:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              Invest More <ArrowRight size={18} className="hidden md:inline" />
            </button>
            <button className="flex-1 md:flex-none px-4 md:px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
              Withdraw
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <DashboardCard
            title="Total Invested"
            value={`₹${totalInvested.toLocaleString()}`}
            icon={Wallet}
          />
          <DashboardCard
            title="Total Earnings"
            value={`₹${totalEarnings.toLocaleString()}`}
            icon={TrendingUp}
            trend={5}
          />
          <DashboardCard
            title="Referral Earnings"
            value={`₹${totalReferralEarnings.toLocaleString()}`}
            icon={Users}
          />
          <DashboardCard
            title="Next Payout"
            value={format(addMonths(new Date(), 1), 'MMM dd, yyyy')}
            icon={Calendar}
          />
        </div>

        {/* Active Investments */}
        <div>
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Active Investments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {investments.map(investment => (
              <InvestmentCard key={investment.id} investment={investment} />
            ))}
          </div>
        </div>

        {/* Earnings Chart */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-4 md:p-6 border border-gray-700">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Earnings Overview</h2>
          <div className="h-[300px] md:h-[400px]">
            <Line data={earningsChartData} options={chartOptions} />
          </div>
        </div>

        {/* Referral Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl md:text-2xl font-bold mb-6">Referral Network</h2>
            <div className="space-y-4">
              {[1, 2, 3].map(level => {
                const levelReferrals = referralTree.filter(r => r.level === level);
                const levelCommission = levelReferrals.reduce((sum, r) => sum + r.commission, 0);
                
                return (
                  <div key={level} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Users size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium">Level {level}</p>
                        <p className="text-sm text-gray-400">
                          {levelReferrals.length} referrals
                        </p>
                      </div>
                    </div>
                    <p className="text-base md:text-lg font-semibold">
                      ₹{levelCommission.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl md:text-2xl font-bold mb-6">Upcoming Payouts</h2>
            <div className="space-y-4">
              {earnings
                .filter(e => e.status === 'pending')
                .slice(0, 3)
                .map((earning, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <BadgeDollarSign size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-medium">₹{earning.amount.toLocaleString()}</p>
                        <p className="text-sm text-gray-400">ROI Payment</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock size={16} />
                      <span>{format(new Date(earning.payout_date), 'MMM dd')}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}