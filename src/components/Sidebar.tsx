import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Wallet,
  UserCircle,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../lib/auth';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  isCollapsed: boolean;
  isActive: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function SidebarItem({ icon: Icon, label, to, isCollapsed, isActive, onClick }: SidebarItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-300
        ${isActive 
          ? 'bg-blue-600/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
          : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
    >
      <Icon size={20} />
      <span className={`whitespace-nowrap transition-all duration-300 ${
        isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
      }`}>
        {label}
      </span>
      {isActive && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 animate-pulse" />
      )}
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: TrendingUp, label: 'Investments', path: '/investments' },
    { icon: Users, label: 'Referrals', path: '/referrals' },
    { icon: Wallet, label: 'Withdrawals', path: '/withdrawals' },
    { icon: UserCircle, label: 'Profile & KYC', path: '/profile' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const sidebarClasses = `fixed left-0 top-0 h-screen bg-gray-900/95 backdrop-blur-xl border-r border-gray-800
    transition-all duration-300 z-50 ${isCollapsed ? 'w-20' : 'w-64'} 
    md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    shadow-[5px_0_25px_rgba(0,0,0,0.3)]`;

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={sidebarClasses}>
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white md:hidden"
        >
          <X size={24} />
        </button>

        {/* Collapse Toggle (Desktop Only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 p-1.5 rounded-full bg-gray-800 border border-gray-700
            text-gray-400 hover:text-white transition-colors hidden md:block"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <TrendingUp size={24} className="text-blue-400" />
            </div>
            <h1 className={`font-bold text-xl transition-all duration-300 ${
              isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
            }`}>
              Invest
            </h1>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3 py-6 space-y-2">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              to={item.path}
              isCollapsed={isCollapsed}
              isActive={location.pathname === item.path}
              onClick={onClose}
            />
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={20} />
            <span className={`transition-all duration-300 ${
              isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
            }`}>
              Logout
            </span>
          </button>
        </div>
      </div>
    </>
  );
}