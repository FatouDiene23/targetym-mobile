import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

export default function StatCard({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon: Icon,
  iconColor = 'text-primary-500',
  iconBg = 'bg-primary-50'
}: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50'
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${changeColors[changeType]}`}>
              {change}
            </span>
          )}
        </div>
        <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
