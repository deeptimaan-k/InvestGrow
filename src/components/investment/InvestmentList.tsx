import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Investment } from './types';
import { StatusBadge } from './StatusBadge';

interface InvestmentListProps {
  investments: Investment[];
  getMonthlyROI: (amount: number) => number;
}

export function InvestmentList({ investments, getMonthlyROI }: InvestmentListProps) {
  if (!investments.length) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Your Investments</h2>
      <div className="space-y-4">
        {investments.map(investment => (
          <div
            key={investment.id}
            className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <TrendingUp size={24} className="text-blue-400" />
                </div>
                <div>
                  <p className="font-bold">₹{investment.amount.toLocaleString()}</p>
                  <p className="text-sm text-gray-400">
                    Monthly ROI: ₹{getMonthlyROI(investment.amount).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-2">
                <StatusBadge status={investment.status} />
                {investment.start_date && (
                  <p className="text-sm text-gray-400">
                    Started: {new Date(investment.start_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}