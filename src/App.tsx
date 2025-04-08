import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, RequireAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { AuthForm } from './components/AuthForm';
import { HomePage } from './components/HomePage';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { ReferralSystem } from './components/ReferralSystem';
import { ReferralCodeTester } from './components/ReferralCodeTester';
import { InvestmentPage } from './components/InvestmentPage';
import { WithdrawalsPage } from './components/WithdrawalsPage';
import { SettingsPage } from './components/SettingsPage';
import { MobileUploadTest } from './components/MobileUploadTest';
import { KYCPage } from './components/profile/KYCPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signin" element={<AuthForm view="sign-in" />} />
          <Route path="/signup" element={<AuthForm view="sign-up" />} />
          <Route path="/test-referral" element={<ReferralCodeTester />} />
          <Route path="/upload" element={<MobileUploadTest />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Layout>
                  <Dashboard />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/investments"
            element={
              <RequireAuth>
                <Layout>
                  <InvestmentPage />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/withdrawals"
            element={
              <RequireAuth>
                <Layout>
                  <WithdrawalsPage />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Layout>
                  <SettingsPage />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/referrals"
            element={
              <RequireAuth>
                <Layout>
                  <ReferralSystem />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Layout>
                  <KYCPage />
                </Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth adminOnly>
                <Layout>
                  <AdminPanel />
                </Layout>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;