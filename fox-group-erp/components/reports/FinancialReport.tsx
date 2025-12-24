import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface FinancialReportProps {
  netIncome: number;
  totalSales: number;
  totalReturns: number;
  cogs: number;
  grossProfit: number;
  expenseBreakdown: { [key: string]: number };
  totalCapital: number;
  totalWithdrawals: number;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6'];

export const FinancialReport: React.FC<FinancialReportProps> = ({
  netIncome,
  totalSales,
  totalReturns,
  cogs,
  grossProfit,
  expenseBreakdown,
  totalCapital,
  totalWithdrawals
}) => {
  const expensePieData = Object.keys(expenseBreakdown).map(key => ({
    name: key,
    value: expenseBreakdown[key]
  }));

  return (
    <div className="animate-in fade-in">
      <div className="bg-gradient-to-r from-dark-900 to-dark-900/50 border border-dark-800 rounded-lg p-8 text-center mb-6">
        <p className="text-gray-400 mb-2">صافي الربح الفعلي (Net Income)</p>
        <h1 className="text-5xl font-bold text-white neon-text mb-4">
          {netIncome.toLocaleString()} <span className="text-2xl text-gray-500">ج.م</span>
        </h1>
        <p className={`text-sm ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {netIncome >= 0 ? 'ربح صافي' : 'خسارة'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-dark-800 rounded-lg p-4">
          <h4 className="text-gray-400 text-sm border-b border-dark-800 pb-2 mb-2">
            قائمة الدخل المختصرة
          </h4>
          <div className="flex justify-between mb-2 text-sm text-gray-300">
            <span>إجمالي المبيعات</span>
            <span className="font-mono">{totalSales.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-2 text-sm text-red-400">
            <span>- مرتجعات مبيعات</span>
            <span className="font-mono">{totalReturns.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-2 text-sm text-red-400">
            <span>- تكلفة البضاعة (COGS)</span>
            <span className="font-mono">{cogs.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-dark-800 text-sm font-bold text-white">
            <span>= مجمل الربح</span>
            <span className="font-mono">{grossProfit.toLocaleString()}</span>
          </div>
        </div>

        <div className="border border-dark-800 rounded-lg p-4">
          <h4 className="text-gray-400 text-sm border-b border-dark-800 pb-2 mb-2">
            تفاصيل المصروفات
          </h4>
          <div className="flex gap-4">
            <div className="w-32 h-32 relative">
              <ResponsiveContainer width="100%" height="100%" minHeight={128} minWidth={128}>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto max-h-32 custom-scrollbar">
              {expensePieData.map((entry, index) => (
                <div key={index} className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></span>
                    <span className="text-gray-300">{entry.name}</span>
                  </div>
                  <span className="font-mono text-gray-400">{entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-dark-800 flex justify-between font-bold text-sm text-red-400">
            <span>إجمالي المصروفات</span>
            <span>{Object.values(expenseBreakdown).reduce((a: number, b: number) => a + b, 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="border border-dark-800 rounded-lg p-4 col-span-1 md:col-span-2">
          <h4 className="text-gray-400 text-sm border-b border-dark-800 pb-2 mb-2">
            ملخص حركة الخزينة (رأس المال والمسحوبات)
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dark-900 p-3 rounded">
              <p className="text-xs text-gray-500 mb-1">إيداع رأس مال (Capital In)</p>
              <p className="text-lg font-bold text-emerald-400">{totalCapital.toLocaleString()}</p>
            </div>
            <div className="bg-dark-900 p-3 rounded">
              <p className="text-xs text-gray-500 mb-1">مسحوبات شخصية (Withdrawals)</p>
              <p className="text-lg font-bold text-orange-400">{totalWithdrawals.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
