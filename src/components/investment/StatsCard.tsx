import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  description?: string;
}

export function StatsCard({ icon: Icon, title, value, description }: StatsCardProps) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <Icon size={24} className="text-blue-400" />
        </div>
        <div>
          <p className="text-gray-400">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {description && <p className="text-sm text-gray-400">{description}</p>}
        </div>
      </div>
    </div>
  );
}