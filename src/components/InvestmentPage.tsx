import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, BadgeDollarSign, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Investment, InvestmentPlan } from './investment/types';
import { InvestmentCard } from './investment/InvestmentCard';
import { PaymentModal } from './investment/PaymentModal';
import { StatsCard } from './investment/StatsCard';
import { InvestmentList } from './investment/InvestmentList';

const INVESTMENT_PLANS: InvestmentPlan[] = [
  { amount: 1000, monthlyROI: 50, totalReturns: 2000, durationMonths: 40 },
  { amount: 2000, monthlyROI: 100, totalReturns: 4000, durationMonths: 40 },
  { amount: 5000, monthlyROI: 250, totalReturns: 10000, durationMonths: 40 },
  { amount: 10000, monthlyROI: 500, totalReturns: 20000, durationMonths: 40 },
  { amount: 50000, monthlyROI: 2500, totalReturns: 100000, durationMonths: 40 },
  { amount: 100000, monthlyROI: 5000, totalReturns: 200000, durationMonths: 40 },
];

export function InvestmentPage() {
  const { profile } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvestments = useCallback(async () => {
    if (!profile?.id) return;
    setError(null);

    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvestments(data || []);
    } catch (error) {
      console.error('Error fetching investments:', error);
      toast.error('Failed to load investments');
      setError('Failed to load your investments. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Add useEffect to fetch investments when component mounts
  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const handleInvestment = async () => {
    if (!selectedPlan || !profile?.id) return null;

    try {
      const { data, error } = await supabase
        .from('investments')
        .insert({
          user_id: profile.id,
          amount: selectedPlan.amount,
          status: 'pending_proof'
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchInvestments();
      return data.id;
    } catch (error) {
      console.error('Investment error:', error);
      toast.error('Failed to create investment');
      return null;
    }
  };

  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const activeInvestments = investments.filter(inv => inv.status === 'active');
  
  const getMonthlyROI = (amount: number) => {
    const plan = INVESTMENT_PLANS.find(p => p.amount === amount);
    return plan ? plan.monthlyROI : amount * 0.05;
  };
  
  const monthlyReturns = activeInvestments.reduce((sum, inv) => sum + getMonthlyROI(inv.amount), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchInvestments();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Investment Plans</h1>
            <p className="text-gray-400">
              Choose your investment plan and start earning 5% monthly returns
            </p>
          </div>
          <Link
            to="/dashboard"
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Investment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            icon={Wallet}
            title="Total Invested"
            value={`₹${totalInvested.toLocaleString()}`}
          />
          <StatsCard
            icon={BadgeDollarSign}
            title="Monthly Returns"
            value={`₹${monthlyReturns.toLocaleString()}`}
          />
          <StatsCard
            icon={Calendar}
            title="Active Investments"
            value={activeInvestments.length}
          />
        </div>

        {/* Investment Plans */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {INVESTMENT_PLANS.map(plan => (
              <InvestmentCard
                key={plan.amount}
                plan={plan}
                onSelect={() => setSelectedPlan(plan)}
              />
            ))}
          </div>
        </div>

        {/* Investment List */}
        <InvestmentList
          investments={investments}
          getMonthlyROI={getMonthlyROI}
        />
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        plan={selectedPlan}
        onConfirm={handleInvestment}
      />
    </div>
  );
}