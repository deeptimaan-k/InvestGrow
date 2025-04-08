import React from 'react';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { InvestmentPlan } from './types';

interface InvestmentCardProps {
  plan: InvestmentPlan;
  onSelect: () => void;
}

export function InvestmentCard({ plan, onSelect }: InvestmentCardProps) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700 p-6 hover:border-blue-500/50 transition-all duration-300 group relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold">₹{plan.amount.toLocaleString()}</h3>
          <p className="text-gray-400">Fixed Investment</p>
        </div>
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <TrendingUp size={24} className="text-blue-400" />
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Monthly ROI</span>
          <span className="text-emerald-400">₹{plan.monthlyROI.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Duration</span>
          <span>{plan.durationMonths} Months</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Returns</span>
          <span className="text-emerald-400">₹{plan.totalReturns.toLocaleString()}</span>
        </div>
      </div>

      <button
        onClick={onSelect}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        Invest Now
        <ArrowRight size={18} />
      </button>
    </div>
  );
}