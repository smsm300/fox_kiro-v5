import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Trophy } from 'lucide-react';
import { SummaryCard } from './SummaryCard';
import { TransactionType } from '../../types';

interface SalesReportProps {
  netSales: number;
  totalReturns: number;
  filteredTransactions: any[];
  chartData: any[];
  topCustomers: Array<{ name: string, amount: number }>;
}

export const SalesReport: React.FC<SalesReportProps> = ({
  netSales,
  totalReturns,
  filteredTransactions,
  chartData,
  topCustomers
}) => {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="صافي المبيعات"
          value={`${netSales.toLocaleString()} ج.م`}
          color="text-emerald-400"
        />
        <SummaryCard
          title="إجمالي المرتجعات"
          value={`${totalReturns.toLocaleString()} ج.م`}
          color="text-red-400"
        />
        <SummaryCard
          title="عدد الفواتير"
          value={filteredTransactions.filter(t => t.type === TransactionType.SALE).length.toString()}
          color="text-blue-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 min-h-[320px] bg-dark-900/50 rounded-lg p-4 border border-dark-800">
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                cursor={{ fill: '#334155', opacity: 0.2 }}
              />
              <Legend />
              <Bar name="المبيعات" dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar name="المصروفات" dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Customers */}
        <div className="bg-dark-900/50 rounded-lg p-4 border border-dark-800 overflow-hidden">
          <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500" />
            كبار العملاء (Top Customers)
          </h3>
          <div className="space-y-3">
            {topCustomers.map((c, i) => (
              <div key={i} className="flex justify-between items-center text-sm border-b border-dark-800 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-dark-800 flex items-center justify-center text-xs text-gray-400">{i + 1}</span>
                  <span className="text-gray-200">{c.name}</span>
                </div>
                <span className="font-bold text-emerald-400">{c.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
