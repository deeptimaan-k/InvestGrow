import React, { useState, useEffect } from 'react';
import { Building2, User, Ban as Bank, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import toast from 'react-hot-toast';

interface BankDetails {
  id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch_name: string;
  verified: boolean;
}

export function BankDetailsForm() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [formData, setFormData] = useState({
    accountHolderName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
  });

  useEffect(() => {
    fetchBankDetails();
  }, [profile?.id]);

  const fetchBankDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_details')
        .select('*')
        .eq('user_id', profile?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setBankDetails(data);
        setFormData({
          accountHolderName: data.account_holder_name,
          accountNumber: data.account_number,
          confirmAccountNumber: data.account_number,
          ifscCode: data.ifsc_code,
          bankName: data.bank_name,
          branchName: data.branch_name,
        });
      }
    } catch (error) {
      console.error('Error fetching bank details:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.accountNumber !== formData.confirmAccountNumber) {
      toast.error('Account numbers do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('bank_details')
        .upsert({
          user_id: profile?.id,
          account_holder_name: formData.accountHolderName,
          account_number: formData.accountNumber,
          ifsc_code: formData.ifscCode.toUpperCase(),
          bank_name: formData.bankName,
          branch_name: formData.branchName,
          verified: false,
        });

      if (error) throw error;

      toast.success('Bank details saved successfully');
      fetchBankDetails();
    } catch (error) {
      console.error('Error saving bank details:', error);
      toast.error('Failed to save bank details');
    } finally {
      setLoading(false);
    }
  };

  const isVerified = bankDetails?.verified;

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
      <h2 className="text-xl font-bold mb-6">Bank Account Details</h2>

      {isVerified && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-emerald-400">
            Your bank details have been verified. Contact support if you need to make any changes.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-400 mb-2">
              Account Holder Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                id="accountHolderName"
                type="text"
                value={formData.accountHolderName}
                onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Enter account holder name"
                required
                disabled={isVerified}
              />
            </div>
          </div>

          <div>
            <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-400 mb-2">
              Account Number
            </label>
            <div className="relative">
              <Bank className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                id="accountNumber"
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Enter account number"
                required
                disabled={isVerified}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmAccountNumber" className="block text-sm font-medium text-gray-400 mb-2">
              Confirm Account Number
            </label>
            <div className="relative">
              <Bank className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                id="confirmAccountNumber"
                type="text"
                value={formData.confirmAccountNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmAccountNumber: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Confirm account number"
                required
                disabled={isVerified}
              />
            </div>
          </div>

          <div>
            <label htmlFor="ifscCode" className="block text-sm font-medium text-gray-400 mb-2">
              IFSC Code
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                id="ifscCode"
                type="text"
                value={formData.ifscCode}
                onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Enter IFSC code"
                pattern="^[A-Za-z]{4}0[A-Z0-9]{6}$"
                title="Please enter a valid IFSC code"
                required
                disabled={isVerified}
              />
            </div>
          </div>

          <div>
            <label htmlFor="bankName" className="block text-sm font-medium text-gray-400 mb-2">
              Bank Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                id="bankName"
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Enter bank name"
                required
                disabled={isVerified}
              />
            </div>
          </div>

          <div>
            <label htmlFor="branchName" className="block text-sm font-medium text-gray-400 mb-2">
              Branch Name
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                id="branchName"
                type="text"
                value={formData.branchName}
                onChange={(e) => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Enter branch name"
                required
                disabled={isVerified}
              />
            </div>
          </div>
        </div>

        {!isVerified && (
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving...' : 'Save Bank Details'}
          </button>
        )}
      </form>
    </div>
  );
}