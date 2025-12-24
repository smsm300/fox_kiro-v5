import React from 'react';
import { Edit2, Trash2, AlertTriangle, Package, Barcode, Printer } from 'lucide-react';
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
            <th className="p-3">الباركود</th>
            <th className="p-3">الاسم</th>
            <th className="p-3">الفئة</th>
            <th className="p-3">الكمية</th>
            <th className="p-3">التكلفة</th>
            <th className="p-3">السعر</th>
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
                <td className="p-3">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="font-mono text-xs text-gray-400">{product.barcode || '---'}</span>
                    {product.barcode && (
                      <span className="font-libre-barcode text-2xl text-white leading-none" title={product.barcode}>
                        {product.barcode}
                      </span>
                    )}
                  </div>
                </td>
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
                    <span className={`font-bold ${qty === 0 ? 'text-red-400' :
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
                      onClick={() => {
                        const win = window.open('', '_blank');
                        if (win) {
                          win.document.write(`
                            <html>
                              <head>
                                <title>Print Barcode - ${product.name}</title>
                                <style>
                                  @font-face {
                                    font-family: 'Libre Barcode 39 Text';
                                    src: url('/fonts/librebarcode39text.woff2') format('woff2');
                                  }
                                  body { 
                                    font-family: 'Cairo', sans-serif;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                    height: 100vh;
                                    margin: 0;
                                  }
                                  .label {
                                    border: 1px solid #ccc;
                                    padding: 20px;
                                    text-align: center;
                                    width: 200px;
                                  }
                                  .barcode {
                                    font-family: 'Libre Barcode 39 Text';
                                    font-size: 60px;
                                    margin: 10px 0;
                                  }
                                  .name { font-weight: bold; font-size: 14px; }
                                  .price { font-size: 18px; font-weight: bold; margin-top: 5px; }
                                </style>
                              </head>
                              <body onload="window.print(); window.close();">
                                <div class="label">
                                  <div class="name">${product.name}</div>
                                  <div class="barcode">${product.barcode || product.sku}</div>
                                  <div class="price">${product.sellPrice.toLocaleString()} ج.م</div>
                                  <div style="font-size: 10px">${product.sku}</div>
                                </div>
                              </body>
                            </html>
                          `);
                        }
                      }}
                      className="p-1.5 bg-yellow-500/10 text-yellow-400 rounded hover:bg-yellow-500/20"
                      title="طباعة باركود"
                    >
                      <Printer size={16} />
                    </button>
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
