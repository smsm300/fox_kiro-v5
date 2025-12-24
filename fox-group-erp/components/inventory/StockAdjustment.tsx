import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { Product } from '../../types';

interface StockAdjustmentProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onAdjust: (productId: number, quantity: number, reason: string) => void;
}

export const StockAdjustment: React.FC<StockAdjustmentProps> = ({
  isOpen,
  onClose,
  product,
  onAdjust
}) => {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    const finalQty = adjustmentType === 'add' ? qty : -qty;
    onAdjust(product.id, finalQty, reason);
    setQuantity('');
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-dark-950 rounded-xl border border-dark-800 w-full max-w-md">
        <div className="border-b border-dark-800 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">تعديل المخزون</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-dark-900 p-4 rounded-lg border border-dark-800">
            <h3 className="font-bold text-white mb-2">{product.name}</h3>
            <p className="text-sm text-gray-400">
              الكمية الحالية: <span className="font-bold text-fox-400">{Number(product.quantity)} {product.unit}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">نوع التعديل</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('add')}
                className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  adjustmentType === 'add'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-dark-900 text-gray-400 hover:bg-dark-800 border border-dark-700'
                }`}
              >
                <Plus size={16} />
                إضافة
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('subtract')}
                className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  adjustmentType === 'subtract'
                    ? 'bg-red-500 text-white'
                    : 'bg-dark-900 text-gray-400 hover:bg-dark-800 border border-dark-700'
                }`}
              >
                <Minus size={16} />
                خصم
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">الكمية *</label>
            <input
              type="number"
              required
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg focus:border-fox-500 outline-none"
              placeholder="أدخل الكمية"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">السبب *</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg focus:border-fox-500 outline-none resize-none"
              rows={3}
              placeholder="اذكر سبب التعديل..."
            />
          </div>

          {quantity && (
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-800">
              <p className="text-sm text-gray-400 mb-1">الكمية بعد التعديل:</p>
              <p className="text-2xl font-bold text-fox-400">
                {adjustmentType === 'add' 
                  ? Number(product.quantity) + Number(quantity)
                  : Number(product.quantity) - Number(quantity)
                } {product.unit}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-fox-500 text-white py-2 rounded-lg font-bold hover:bg-fox-600 transition-colors"
            >
              تأكيد التعديل
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-dark-900 text-gray-300 py-2 rounded-lg font-bold hover:bg-dark-800 border border-dark-700"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
