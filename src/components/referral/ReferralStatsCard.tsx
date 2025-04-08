import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ReferralStatsCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
}

export function ReferralStatsCard({ 
  icon: Icon, 
  title, 
  value, 
  subtitle,
  trend 
}: ReferralStatsCardProps) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <Icon size={24} className="text-blue-400" />
        </div>
        <div>
          <p className="text-gray-400">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <p className="flex items-center gap-1 text-sm text-emerald-400 mt-1">
              <ArrowUpRight size={16} />
              {trend}% this month
            </p>
          )}
        </div>
      </div>
    </div>
  );
}