import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  iconColor?: string;
  onClick?: () => void;
}

export function QuickActionCard({ 
  icon: Icon, 
  title, 
  subtitle, 
  iconColor = 'text-blue-400', 
  onClick 
}: QuickActionCardProps) {
  return (
    <button 
      onClick={onClick}
      className="w-full bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 ${iconColor.replace('text-', 'bg-').replace('400', '500/10')} rounded-lg`}>
            <Icon size={24} className={iconColor} />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-gray-400">{subtitle}</p>
          </div>
        </div>
        <ArrowRight size={20} className="text-gray-400" />
      </div>
    </button>
  );
}