import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Wallet,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface WithdrawalSettings {
  min_withdrawal_amount: number;
  max_withdrawal_amount: number;
  processing_time_hours: number;
  withdrawal_fee_percent: number;
  min_balance_required: number;
}

interface BankDetails {
  id: string;
  account_holder_name: string;
  account_number: string;
  bank_name: string;
  verified: boolean;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  created_at: string;
  bank_details: BankDetails;
  admin_notes?: string;
}

interface WithdrawalStats {
  total_withdrawn: number;
  pending_amount: number;
  available_balance: number;
}

function WithdrawalCard({ withdrawal }: { withdrawal: Withdrawal }) {
  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-yellow-400 bg-yellow-400/10',
      text: 'Pending'
    },
    processing: {
      icon: RefreshCw,
      color: 'text-blue-400 bg-blue-400/10',
      text: 'Processing'
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-400/10',
      text: 'Completed'
    },
    rejected: {
      icon: XCircle,
      color: 'text-red-400 bg-red-400/10',
      text: 'Rejected'
    },
    cancelled: {
      icon: XCircle,
      color: 'text-gray-400 bg-gray-400/10',
      text: 'Cancelled'
    }
  };

  const config = statusConfig[withdrawal.status];
  const Icon = config.icon;

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold">₹{withdrawal.amount.toLocaleString()}</h3>
          <p className="text-sm text-gray-400">
            {new Date(withdrawal.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.color}`}>
          <Icon size={14} />
          <span className="text-sm font-medium">{config.text}</span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Bank Account</span>
          <span>{withdrawal.bank_details.account_number}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Bank Name</span>
          <span>{withdrawal.bank_details.bank_name}</span>
        </div>
      </div>

      {withdrawal.admin_notes && (
        <div className="mt-4 p-3 bg-gray-700/30 rounded-lg text-sm">
          <p className="text-gray-400">{withdrawal.admin_notes}</p>
        </div>
      )}
    </div>
  );
}

export function WithdrawalsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [settings, setSettings] = useState<WithdrawalSettings | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<WithdrawalStats>({
    total_withdrawn: 0,
    pending_amount: 0,
    available_balance: 0
  });
  const [amount, setAmount] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      // Fetch withdrawal settings
      const { data: settingsData } = await supabase
        .from('withdrawal_settings')
        .select('*')
        .single();

      if (settingsData) {
        setSettings(settingsData);
      }

      // Fetch bank details
      const { data: bankData } = await supabase
        .from('bank_details')
        .select('*')
        .eq('user_id', profile.id)
        .eq('verified', true)
        .single();

      if (bankData) {
        setBankDetails(bankData);
      }

      // Fetch withdrawals
      const { data: withdrawalsData } = await supabase
        .from('withdrawals')
        .select(`
          *,
          bank_details (
            id,
            account_holder_name,
            account_number,
            bank_name,
            verified
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (withdrawalsData) {
        setWithdrawals(withdrawalsData);
      }

      // Calculate stats
      const totalWithdrawn = withdrawalsData
        ?.filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + w.amount, 0) || 0;

      const pendingAmount = withdrawalsData
        ?.filter(w => ['pending', 'processing'].includes(w.status))
        .reduce((sum, w) => sum + w.amount, 0) || 0;

      // Fetch total earnings
      const { data: earningsData } = await supabase
        .from('earnings')
        .select('amount')
        .eq('user_id', profile.id)
        .eq('status', 'paid');

      const totalEarnings = earningsData?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const availableBalance = totalEarnings - totalWithdrawn - pendingAmount;

      setStats({
        total_withdrawn: totalWithdrawn,
        pending_amount: pendingAmount,
        available_balance: availableBalance
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load withdrawal data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!profile?.id || !bankDetails || !amount) return;

    try {
      setWithdrawing(true);
      const withdrawalAmount = parseFloat(amount);

      // Check eligibility
      const { data: eligibility, error: eligibilityError } = await supabase
        .rpc('check_withdrawal_eligibility', {
          p_user_id: profile.id,
          p_amount: withdrawalAmount
        });

      if (eligibilityError) throw eligibilityError;

      if (!eligibility?.[0]?.eligible) {
        toast.error(eligibility?.[0]?.message || 'Withdrawal not eligible');
        return;
      }

      // Create withdrawal request
      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: profile.id,
          amount: withdrawalAmount,
          bank_details_id: bankDetails.id,
          status: 'pending'
        });

      if (withdrawalError) throw withdrawalError;

      toast.success('Withdrawal request submitted successfully');
      setAmount('');
      fetchData();
    } catch (error) {
      console.error('Error creating withdrawal:', error);
      toast.error('Failed to create withdrawal request');
    } finally {
      setWithdrawing(false);
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
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Withdrawals</h1>
            <p className="text-gray-400">
              Manage your withdrawal requests and track your balance
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <Wallet size={24} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-gray-400">Available Balance</p>
                <p className="text-2xl font-bold">₹{stats.available_balance.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Clock size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400">Pending Amount</p>
                <p className="text-2xl font-bold">₹{stats.pending_amount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Wallet size={24} className="text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400">Total Withdrawn</p>
                <p className="text-2xl font-bold">₹{stats.total_withdrawn.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Withdrawal Form */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-6">Request Withdrawal</h2>

          {!bankDetails?.verified ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-yellow-500 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-yellow-500 font-medium">Bank Account Required</p>
                <p className="text-sm text-yellow-500/80 mt-1">
                  Please add and verify your bank account details before requesting a withdrawal.
                </p>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300 mt-2"
                >
                  Add Bank Account <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={settings?.min_withdrawal_amount}
                    max={settings?.max_withdrawal_amount}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    placeholder="Enter amount"
                  />
                  <p className="mt-2 text-sm text-gray-400">
                    Min: ₹{settings?.min_withdrawal_amount.toLocaleString()}, 
                    Max: ₹{settings?.max_withdrawal_amount.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Bank Account
                  </label>
                  <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
                    <p className="font-medium">{bankDetails.account_holder_name}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {bankDetails.bank_name} - {bankDetails.account_number}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleWithdrawal}
                disabled={withdrawing || !amount || parseFloat(amount) < (settings?.min_withdrawal_amount || 0)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {withdrawing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wallet size={20} />
                    Request Withdrawal
                  </>
                )}
              </button>

              <div className="p-4 bg-gray-900/50 rounded-lg text-sm text-gray-400">
                <p>
                  • Withdrawals are processed within {settings?.processing_time_hours} hours
                </p>
                {settings?.withdrawal_fee_percent > 0 && (
                  <p>
                    • A {settings.withdrawal_fee_percent}% processing fee will be charged
                  </p>
                )}
                <p>
                  • Minimum balance required: ₹{settings?.min_balance_required.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Withdrawal History */}
        <div>
          <h2 className="text-xl font-bold mb-6">Withdrawal History</h2>
          <div className="space-y-4">
            {withdrawals.length > 0 ? (
              withdrawals.map(withdrawal => (
                <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} />
              ))
            ) : (
              <div className="text-center py-12 bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700">
                <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-400">No withdrawal history found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}