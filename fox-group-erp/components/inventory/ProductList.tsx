import React from 'react';
import { Edit2, Trash2, AlertTriangle, Package } from 'lucide-react';
import { Product } from '../../types';

interface ProductListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onAdjustStock: (product: Product) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  onEdit,
  onDelete,
  onAdjustStock
}) => {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Package size={48} className="mx-auto mb-4 opacity-30" />
        <p>لا توجد منتجات</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-sm">
        <thead className="bg-dark-900 text-gray-400">
          <tr>
            <th className="p-3">SKU</th>
            <th className="p-3">الاسم</th>
            <th className="p-3">الفئة</th>
            <th className="p-3">الكمية</th>
            <th className="p-3">التكلفة</th>
            <th className="p-3">السعر</th>
            <th className="p-3">الربح</th>
            <th className="p-3 text-center">الإجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-800">
          {products.map(product => {
            // Convert string values from API to numbers
            const qty = Number(product.quantity) || 0;
            const cost = Number(product.costPrice) || 0;
            const sell = Number(product.sellPrice) || 0;
            const minAlert = Number(product.minStockAlert) || 0;
            
            const profit = sell - cost;
            const profitMargin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0.0';
            const isLowStock = qty <= minAlert;

            return (
              <tr key={product.id} className="hover:bg-dark-900/50 text-gray-300">
                <td className="p-3 font-mono text-gray-500">{product.sku}</td>
                <td className="p-3 font-bold text-white">{product.name}</td>
                <td className="p-3">
                  <span className="px-2 py-1 bg-dark-800 rounded text-xs">
                    {product.category}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {isLowStock && (
                      <AlertTriangle size={16} className="text-yellow-500" />
                    )}
                    <span className={`font-bold ${
                      qty === 0 ? 'text-red-400' :
                      isLowStock ? 'text-yellow-400' :
                      'text-emerald-400'
                    }`}>
                      {qty} {product.unit}
                    </span>
                  </div>
                </td>
                <td className="p-3 font-mono">{cost.toLocaleString()}</td>
                <td className="p-3 font-mono font-bold text-fox-400">
                  {sell.toLocaleString()}
                </td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-emerald-400">
                      {profit.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {profitMargin}%
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onAdjustStock(product)}
                      className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20"
                      title="تعديل المخزون"
                    >
                      <Package size={16} />
                    </button>
                    <button
                      onClick={() => onEdit(product)}
                      className="p-1.5 bg-fox-500/10 text-fox-400 rounded hover:bg-fox-500/20"
                      title="تعديل"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(product.id)}
                      className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
