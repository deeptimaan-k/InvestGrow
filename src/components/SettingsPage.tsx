import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Bell,
  Lock,
  Mail,
  Shield,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface SecuritySettings {
  two_factor_enabled: boolean;
  two_factor_pending: boolean;
  last_login: string;
  login_attempts: number;
}

interface NotificationSettings {
  email_notifications: boolean;
  withdrawal_alerts: boolean;
  investment_updates: boolean;
  referral_alerts: boolean;
  marketing_emails: boolean;
}

export function SettingsPage() {
  const { profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    two_factor_enabled: false,
    two_factor_pending: false,
    last_login: '',
    login_attempts: 0
  });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: true,
    withdrawal_alerts: true,
    investment_updates: true,
    referral_alerts: true,
    marketing_emails: false
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchSettings();
  }, [profile?.id]);

  const fetchSettings = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      // Fetch security settings
      const { data: securityData } = await supabase
        .from('profiles')
        .select(`
          two_factor_enabled,
          two_factor_pending,
          last_login,
          login_attempts
        `)
        .eq('id', profile.id)
        .single();

      if (securityData) {
        setSecuritySettings(securityData);
      }

      // Fetch notification settings
      const { data: notificationData } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (notificationData) {
        setNotificationSettings(notificationData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationSettingsChange = async (
    setting: keyof NotificationSettings
  ) => {
    try {
      const newSettings = {
        ...notificationSettings,
        [setting]: !notificationSettings[setting]
      };

      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: profile?.id,
          ...newSettings
        });

      if (error) throw error;

      setNotificationSettings(newSettings);
      toast.success('Notification settings updated');
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error('Failed to update notification settings');
    }
  };

  const handleTwoFactorToggle = async () => {
    try {
      setSaving(true);

      if (!securitySettings.two_factor_enabled) {
        const { success, secret, error } = await updateProfile({
          two_factor_pending: true
        });

        if (!success) throw new Error(error);

        // Here you would typically show a QR code with the secret
        // and guide the user through 2FA setup
        console.log('2FA Secret:', secret);
      } else {
        const { success, error } = await updateProfile({
          two_factor_enabled: false,
          two_factor_pending: false
        });

        if (!success) throw new Error(error);
      }

      await fetchSettings();
      toast.success(
        securitySettings.two_factor_enabled
          ? '2FA disabled successfully'
          : 'Please complete 2FA setup'
      );
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      toast.error('Failed to update 2FA settings');
    } finally {
      setSaving(false);
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
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-gray-400">
              Manage your account settings and preferences
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

        {/* Security Settings */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield size={24} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-bold">Security</h2>
          </div>

          <div className="space-y-6">
            {/* Password Change */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))}
                      className="w-full pl-4 pr-10 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      className="w-full pl-4 pr-10 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({
                      ...prev,
                      confirmPassword: e.target.value
                    }))}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handlePasswordChange}
                disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    Update Password
                  </>
                )}
              </button>
            </div>

            {/* Two-Factor Authentication */}
            <div className="pt-6 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <button
                  onClick={handleTwoFactorToggle}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    securitySettings.two_factor_enabled
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {securitySettings.two_factor_enabled ? (
                    <>
                      <Shield size={18} />
                      Disable 2FA
                    </>
                  ) : (
                    <>
                      <Shield size={18} />
                      Enable 2FA
                    </>
                  )}
                </button>
              </div>

              {securitySettings.two_factor_enabled && (
                <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-400 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-emerald-400 font-medium">2FA is enabled</p>
                    <p className="text-sm text-emerald-400/80 mt-1">
                      Your account is protected with two-factor authentication
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Login History */}
            <div className="pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Login History</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p>
                  Last login: {new Date(securitySettings.last_login).toLocaleString()}
                </p>
                <p>
                  Login attempts: {securitySettings.login_attempts}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Bell size={24} className="text-purple-400" />
            </div>
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>

          <div className="space-y-6">
            {/* Email Notifications */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Email Notifications</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <Mail size={20} className="text-gray-400" />
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-gray-400">
                        Receive important updates via email
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={notificationSettings.email_notifications}
                      onChange={() => handleNotificationSettingsChange('email_notifications')}
                    />
                    <div className={`w-14 h-7 rounded-full transition-colors ${
                      notificationSettings.email_notifications ? 'bg-blue-600' : 'bg-gray-700'
                    }`}>
                      <div className={`absolute w-5 h-5 rounded-full bg-white top-1 transition-transform ${
                        notificationSettings.email_notifications ? 'right-1' : 'left-1'
                      }`} />
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <Wallet size={20} className="text-gray-400" />
                    <div>
                      <p className="font-medium">Withdrawal Alerts</p>
                      <p className="text-sm text-gray-400">
                        Get notified about withdrawal status changes
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={notificationSettings.withdrawal_alerts}
                      onChange={() => handleNotificationSettingsChange('withdrawal_alerts')}
                    />
                    <div className={`w-14 h-7 rounded-full transition-colors ${
                      notificationSettings.withdrawal_alerts ? 'bg-blue-600' : 'bg-gray-700'
                    }`}>
                      <div className={`absolute w-5 h-5 rounded-full bg-white top-1 transition-transform ${
                        notificationSettings.withdrawal_alerts ? 'right-1' : 'left-1'
                      }`} />
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={20} className="text-gray-400" />
                    <div>
                      <p className="font-medium">Investment Updates</p>
                      <p className="text-sm text-gray-400">
                        Receive updates about your investments
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={notificationSettings.investment_updates}
                      onChange={() => handleNotificationSettingsChange('investment_updates')}
                    />
                    <div className={`w-14 h-7 rounded-full transition-colors ${
                      notificationSettings.investment_updates ? 'bg-blue-600' : 'bg-gray-700'
                    }`}>
                      <div className={`absolute w-5 h-5 rounded-full bg-white top-1 transition-transform ${
                        notificationSettings.investment_updates ? 'right-1' : 'left-1'
                      }`} />
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <Users size={20} className="text-gray-400" />
                    <div>
                      <p className="font-medium">Referral Alerts</p>
                      <p className="text-sm text-gray-400">
                        Get notified about new referrals and commissions
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={notificationSettings.referral_alerts}
                      onChange={() => handleNotificationSettingsChange('referral_alerts')}
                    />
                    <div className={`w-14 h-7 rounded-full transition-colors ${
                      notificationSettings.referral_alerts ? 'bg-blue-600' : 'bg-gray-700'
                    }`}>
                      <div className={`absolute w-5 h-5 rounded-full bg-white top-1 transition-transform ${
                        notificationSettings.referral_alerts ? 'right-1' : 'left-1'
                      }`} />
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <Mail size={20} className="text-gray-400" />
                    <div>
                      <p className="font-medium">Marketing Emails</p>
                      <p className="text-sm text-gray-400">
                        Receive promotional offers and updates
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={notificationSettings.marketing_emails}
                      onChange={() => handleNotificationSettingsChange('marketing_emails')}
                    />
                    <div className={`w-14 h-7 rounded-full transition-colors ${
                      notificationSettings.marketing_emails ? 'bg-blue-600' : 'bg-gray-700'
                    }`}>
                      <div className={`absolute w-5 h-5 rounded-full bg-white top-1 transition-transform ${
                        notificationSettings.marketing_emails ? 'right-1' : 'left-1'
                      }`} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Device Management */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Smartphone size={24} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Device Management</h2>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-1" size={20} />
            <div>
              <p className="text-yellow-500 font-medium">Coming Soon</p>
              <p className="text-sm text-yellow-500/80 mt-1">
                Device management features will be available in a future update
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}