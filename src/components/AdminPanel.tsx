import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Download,
  Eye,
  Search,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Investment {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  user: {
    id: string;
    email: string;
    profile: {
      full_name: string;
    };
  };
  payment_proof: {
    id: string;
    file_path: string;
    status: string;
  };
}

export function AdminPanel() {
  const { profile, signOut } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    fetchInvestments();
  }, [filter]);

  async function fetchInvestments() {
    try {
      let query = supabase
        .from('investments')
        .select(`
          *,
          user:user_id (
            id,
            email,
            profile:profiles (
              full_name
            )
          ),
          payment_proof:payment_proofs (
            id,
            file_path,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'pending_approval');
      } else if (filter === 'approved') {
        query = query.eq('status', 'active');
      } else if (filter === 'rejected') {
        query = query.eq('status', 'rejected');
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvestments(data || []);
    } catch (error) {
      console.error('Error fetching investments:', error);
      toast.error('Failed to load investments');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(investmentId: string, approved: boolean, notes?: string) {
    try {
      const { error } = await supabase.rpc('approve_investment', {
        p_investment_id: investmentId,
        p_approved: approved,
        p_admin_notes: notes
      });

      if (error) throw error;

      toast.success(approved ? 'Investment approved' : 'Investment rejected');
      fetchInvestments();
    } catch (error) {
      console.error('Error updating investment:', error);
      toast.error('Failed to update investment');
    }
  }

  async function viewProof(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(filePath, 300); // 5 minutes expiry

      if (error) throw error;
      
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error viewing proof:', error);
      toast.error('Failed to view proof');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
            <p className="text-gray-400">Manage investment approvals and user accounts</p>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <AlertCircle size={18} />
            Pending
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              filter === 'approved'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <CheckCircle2 size={18} />
            Approved
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              filter === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <XCircle size={18} />
            Rejected
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Filter size={18} />
            All
          </button>
        </div>

        {/* Investments Table */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-700/50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">User</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Proof</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {investments.map(investment => (
                <tr key={investment.id} className="hover:bg-gray-700/30">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium">{investment.user?.profile?.full_name}</p>
                      <p className="text-sm text-gray-400">{investment.user?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium">₹{investment.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                      investment.status === 'active'
                        ? 'bg-emerald-400/10 text-emerald-400'
                        : investment.status === 'rejected'
                        ? 'bg-red-400/10 text-red-400'
                        : 'bg-blue-400/10 text-blue-400'
                    }`}>
                      {investment.status === 'active' && <CheckCircle2 size={14} />}
                      {investment.status === 'rejected' && <XCircle size={14} />}
                      {investment.status === 'pending_approval' && <AlertCircle size={14} />}
                      {investment.status.replace('_', ' ').charAt(0).toUpperCase() + 
                       investment.status.slice(1).replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(investment.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {investment.payment_proof && (
                      <button
                        onClick={() => viewProof(investment.payment_proof.file_path)}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                      >
                        <Eye size={16} />
                        View Proof
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {investment.status === 'pending_approval' && (
                      <>
                        <button
                          onClick={() => handleApproval(investment.id, true)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproval(investment.id, false)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}