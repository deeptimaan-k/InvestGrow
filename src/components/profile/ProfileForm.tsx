import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ProfileFormProps {
  onUpdate?: () => void;
}

export function ProfileForm({ onUpdate }: ProfileFormProps) {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
  });
  const [hasUpdated, setHasUpdated] = useState(false);

  useEffect(() => {
    if (profile?.profile_updated_at) {
      setHasUpdated(true);
    }
  }, [profile?.profile_updated_at]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasUpdated) {
      toast.error('Profile can only be updated once');
      return;
    }

    setLoading(true);
    
    try {
      const { success, error } = await updateProfile({
        full_name: formData.fullName,
      });

      if (!success) throw new Error(error);
      
      toast.success('Profile updated successfully');
      if (onUpdate) onUpdate();
      setHasUpdated(true);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Personal Information</h2>
        {hasUpdated && (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle size={20} />
            <span className="text-sm">Profile Updated</span>
          </div>
        )}
      </div>

      {hasUpdated && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-yellow-500 flex-shrink-0 mt-1" size={20} />
          <p className="text-sm text-yellow-500">
            Your profile information can only be updated once. Please ensure all details are correct
            before saving. Contact support if you need to make changes after saving.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-400 mb-2">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Enter your full name"
              required
              disabled={hasUpdated}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || hasUpdated}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
}