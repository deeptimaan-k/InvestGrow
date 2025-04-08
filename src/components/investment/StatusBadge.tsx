import React from 'react';
import { AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Investment } from './types';

interface StatusBadgeProps {
  status: Investment['status'];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    pending_proof: {
      icon: AlertCircle,
      text: 'Pending Proof',
      color: 'text-yellow-400 bg-yellow-400/10'
    },
    pending_approval: {
      icon: Clock,
      text: 'Pending Approval',
      color: 'text-blue-400 bg-blue-400/10'
    },
    active: {
      icon: CheckCircle2,
      text: 'Active',
      color: 'text-emerald-400 bg-emerald-400/10'
    },
    completed: {
      icon: CheckCircle2,
      text: 'Completed',
      color: 'text-purple-400 bg-purple-400/10'
    },
    rejected: {
      icon: XCircle,
      text: 'Rejected',
      color: 'text-red-400 bg-red-400/10'
    },
    cancelled: {
      icon: XCircle,
      text: 'Cancelled',
      color: 'text-gray-400 bg-gray-400/10'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.color} text-sm font-medium`}>
      <Icon size={14} />
      {config.text}
    </div>
  );
}