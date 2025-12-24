import React from 'react';
import { Edit, Trash2, Printer, Package, AlertTriangle } from 'lucide-react';
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
    onAdjustStock,
}) => {
    if (!products || products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-dark-900/50 rounded-xl border border-dark-800 text-gray-500">
                <Package size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-bold">لا يوجد منتجات</p>
                <p className="text-sm">قم بإضافة منتج جديد للبدء</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-dark-800">
            <table className="w-full text-right bg-dark-900/50">
                <thead className="bg-dark-900 text-gray-400">
                    <tr>
                        <th className="p-4 text-sm font-bold">صورة</th>
                        <th className="p-4 text-sm font-bold">كود (SKU)</th>
                        <th className="p-4 text-sm font-bold">المنتج</th>
                        <th className="p-4 text-sm font-bold text-center">المخزون</th>
                        <th className="p-4 text-sm font-bold">التكلفة</th>
                        <th className="p-4 text-sm font-bold">السعر</th>
                        <th className="p-4 text-sm font-bold">الربح</th>
                        <th className="p-4 text-sm font-bold text-center">إجراءات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                    {products.map((product) => {
                        const qty = product.quantity;
                        const minAlert = product.minStockAlert || 5;
                        const cost = product.costPrice || 0;
                        const sell = product.sellPrice || 0;
                        const profit = sell - cost;
                        const profitMargin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0.0';
                        const isLowStock = qty <= minAlert;

                        return (
                            <tr key={product.id} className="hover:bg-dark-900/50 text-gray-300 transition-colors">
                                <td className="p-3">
                                    <div className="w-10 h-10 bg-dark-800 rounded overflow-hidden border border-dark-700">
                                        <img
                                            src={product.image || '/fox-logo.png'}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                if (target.src.includes('fox-logo.png')) {
                                                    target.style.display = 'none';
                                                    if (target.parentElement) {
                                                        target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-dark-600"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>';
                                                    }
                                                } else {
                                                    target.src = '/fox-logo.png';
                                                }
                                            }}
                                        />
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-sm text-gray-400">{product.sku}</td>
                                <td className="p-4">
                                    <div>
                                        <div className="font-bold text-white">{product.name}</div>
                                        <div className="text-xs text-gray-500 bg-dark-800 px-2 py-0.5 rounded inline-block mt-1">
                                            {product.category}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${isLowStock ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                        {isLowStock && <AlertTriangle size={12} />}
                                        {qty} {product.unit}
                                    </div>
                                </td>
                                <td className="p-4 text-gray-400">{cost.toLocaleString()}</td>
                                <td className="p-4 text-white font-bold">{sell.toLocaleString()}</td>
                                <td className="p-4">
                                    <div className="flex flex-col text-xs">
                                        <span className={profit > 0 ? 'text-emerald-400' : 'text-gray-400'}>
                                            {profit.toLocaleString()}
                                        </span>
                                        <span className="text-gray-600">{profitMargin}%</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => {
                                                const fontUrl = window.location.origin + '/fonts/librebarcode39text.woff2';
                                                const win = window.open('', '', 'width=400,height=400');
                                                if (win) {
                                                    win.document.write(`
                            <html>
                              <head>
                                <title>Barcode - ${product.name}</title>
                                <style>
                                  @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39+Text&display=swap');
                                  body {
                                    font-family: system-ui, -apple-system, sans-serif;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    height: 100vh;
                                    margin: 0;
                                    background: white;
                                  }
                                  .label-card {
                                    width: 350px;
                                    padding: 15px;
                                    background: white;
                                    border-radius: 12px;
                                    box-shadow: none;
                                    text-align: center;
                                    border: 1px dashed #000;
                                    overflow: hidden;
                                  }
                                  .brand-name {
                                    color: #f97316;
                                    font-weight: bold;
                                    font-size: 14px;
                                    margin-bottom: 5px;
                                    letter-spacing: 2px;
                                  }
                                  .product-name {
                                    font-size: 16px;
                                    font-weight: 700;
                                    color: #000;
                                    margin-bottom: 5px;
                                    display: -webkit-box;
                                    -webkit-line-clamp: 2;
                                    -webkit-box-orient: vertical;
                                    overflow: hidden;
                                    line-height: 1.2;
                                  }
                                  .category {
                                    font-size: 10px;
                                    color: #444;
                                    background: #eee;
                                    padding: 2px 8px;
                                    border-radius: 4px;
                                    display: inline-block;
                                    margin-bottom: 5px;
                                  }
                                  .barcode-container {
                                    margin: 5px 0;
                                    padding: 5px;
                                    background: #fff;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                    width: 100%;
                                    overflow: hidden;
                                  }
                                  .barcode-font {
                                    font-family: 'Libre Barcode 39 Text';
                                    font-size: 55px;
                                    margin: 0;
                                    line-height: 1;
                                    color: #000;
                                    white-space: nowrap;
                                    max-width: 100%;
                                    overflow: hidden;
                                    text-overflow: clip; 
                                  }
                                  .price-tag {
                                    margin-top: 5px;
                                    padding-top: 5px;
                                    border-top: 2px solid #eee;
                                  }
                                  .price-value {
                                    font-size: 24px;
                                    font-weight: 900;
                                    color: #000;
                                  }
                                  .currency {
                                    font-size: 12px;
                                    margin-right: 4px;
                                    color: #666;
                                  }
                                  @media print {
                                    body { background: white; padding: 0; height: auto; }
                                    .label-card { border: 1px solid #000; margin: 0 auto; page-break-inside: avoid; }
                                  }
                                </style>
                              </head>
                              <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
                                <div class="label-card">
                                  <div class="brand-name">FOX GROUP</div>
                                  <div class="product-name">${product.name}</div>
                                  <div class="category">${product.category}</div>
                                  
                                  <div class="barcode-container">
                                    <div class="barcode-font">${product.barcode || product.sku}</div>
                                  </div>
                                  
                                  <div class="price-tag">
                                    <span class="price-value">${product.sellPrice.toLocaleString()}</span>
                                    <span class="currency">ج.م</span>
                                  </div>
                                  
                                  <div style="font-size: 10px; color: #999; margin-top: 5px;">SKU: ${product.sku}</div>
                                </div>
                              </body>
                            </html>
                          `);
                                                }
                                            }}
                                            className="p-1.5 bg-yellow-500/10 text-yellow-400 rounded hover:bg-yellow-500/20 transition-colors"
                                            title="طباعة باركود"
                                        >
                                            <Printer size={16} />
                                        </button>
                                        <button
                                            onClick={() => onAdjustStock(product)}
                                            className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
                                            title="تعديل المخزون"
                                        >
                                            <Package size={16} />
                                        </button>
                                        <button
                                            onClick={() => onEdit(product)}
                                            className="p-1.5 bg-fox-500/10 text-fox-400 rounded hover:bg-fox-500/20 transition-colors"
                                            title="تعديل"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(product.id)}
                                            className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
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
