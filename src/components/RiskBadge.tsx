import React from 'react';
import { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showStripe?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  size = 'md',
  showStripe = true,
}) => {
  const getColors = () => {
    switch (level) {
      case 'high':
        return {
          bg: 'bg-[#B5432A]',
          text: 'text-white',
          border: 'border-[#8F2E19]',
          label: 'HIGH RISK',
          accentBg: 'bg-[#8F2E19]',
        };
      case 'medium':
        return {
          bg: 'bg-[#D9A441]',
          text: 'text-[#23241F]',
          border: 'border-[#B88528]',
          label: 'MEDIUM RISK',
          accentBg: 'bg-[#B88528]',
        };
      case 'low':
      default:
        return {
          bg: 'bg-[#4C8C6B]',
          text: 'text-white',
          border: 'border-[#386B51]',
          label: 'LOW RISK',
          accentBg: 'bg-[#386B51]',
        };
    }
  };

  const config = getColors();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-semibold tracking-wider',
    md: 'px-2.5 py-1 text-sm font-bold tracking-wider',
    lg: 'px-4 py-2 text-base font-extrabold tracking-wider',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-sm border ${config.border} ${config.bg} ${config.text} ${sizeClasses[size]} font-heading shadow-xs relative overflow-hidden`}
    >
      {showStripe && (
        <span
          className="w-2.5 h-full absolute left-0 top-0 opacity-40 aedes-stripe-accent-light"
          aria-hidden="true"
        />
      )}
      <span className={showStripe ? 'pl-1.5' : ''}>{config.label}</span>
      {score !== undefined && (
        <span className="font-mono-data opacity-90 border-l border-current/30 pl-2">
          {score}/100
        </span>
      )}
    </div>
  );
};
