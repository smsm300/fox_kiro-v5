import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SummaryCard } from './SummaryCard';
import { Product } from '../../types';

interface InventoryReportProps {
  totalInventoryCost: number;
  totalInventoryValue: number;
  potentialProfit: number;
  topSelling: Array<{ name: string, qty: number, revenue: number }>;
  products: Product[];
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6'];

export const InventoryReport: React.FC<InventoryReportProps> = ({
  totalInventoryCost,
  totalInventoryValue,
  potentialProfit,
  topSelling,
  products
}) => {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="تكلفة المخزون الحالية"
          value={`${totalInventoryCost.toLocaleString()} ج.م`}
          color="text-blue-400"
        />
        <SummaryCard
          title="القيمة البيعية المتوقعة"
          value={`${totalInventoryValue.toLocaleString()} ج.م`}
          color="text-emerald-400"
        />
        <SummaryCard
          title="الربح المتوقع"
          value={`${potentialProfit.toLocaleString()} ج.م`}
          color="text-fox-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-dark-900 rounded-lg p-5 border border-dark-800">
          <h3 className="font-bold text-gray-200 mb-4 border-b border-dark-700 pb-2">
            أعلى 5 منتجات مبيعاً (كمية)
          </h3>
          <div className="space-y-3">
            {topSelling.length === 0 ? (
              <p className="text-gray-500 text-center">لا توجد مبيعات حتى الآن</p>
            ) : (
              topSelling.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                          'bg-orange-700 text-white'
                      }`}>{index + 1}</span>
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-fox-400">{item.qty} قطعة</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg p-5 border border-dark-800">
          <h3 className="font-bold text-gray-200 mb-4 border-b border-dark-700 pb-2">
            توزيع المخزون
          </h3>
          <div className="h-64 flex items-center justify-center">
            {products.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <PieChart>
                  <Pie
                    data={products.slice(0, 5).map(p => ({ name: p.name, value: p.quantity }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label
                  >
                    {products.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">لا توجد منتجات</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
