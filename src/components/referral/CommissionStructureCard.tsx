import React from 'react';

interface CommissionLevel {
  level: number;
  commission_rate: number;
}

interface CommissionStructureCardProps {
  levels: CommissionLevel[];
}

export function CommissionStructureCard({ levels }: CommissionStructureCardProps) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-300">
      <h2 className="text-xl font-bold mb-4">Commission Structure</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {levels.slice(0, 4).map(level => (
            <div key={level.level} className="bg-gray-700/30 rounded-lg p-4">
              <p className="text-sm text-gray-400">Level {level.level}</p>
              <p className="text-xl font-bold text-blue-400">{level.commission_rate}%</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-700/30 rounded-lg p-4">
          <p className="text-sm text-gray-400">Levels 5-10</p>
          <p className="text-xl font-bold text-blue-400">2%</p>
        </div>
      </div>
    </div>
  );
}