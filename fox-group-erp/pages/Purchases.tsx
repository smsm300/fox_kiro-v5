import React, { useState, useEffect, useMemo } from 'react';
import { History, ShoppingBag, Plus, Eye } from 'lucide-react';
import { Product, Supplier, CartItem, PaymentMethod, Transaction, TransactionType } from '../types';
import { ProductSelector } from '../components/purchases/ProductSelector';
import { PurchaseCart } from '../components/purchases/PurchaseCart';
import { Modal } from '../components/Modal';
import { productsAPI, suppliersAPI, transactionsAPI } from '../services/endpoints';
import { handleAPIError } from '../services/errorHandler';

interface PurchasesProps {
  onDataChange?: () => void;
}

const Purchases: React.FC<PurchasesProps> = ({ onDataChange }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'create' | 'history'>('create');
  const [purchaseHistory, setPurchaseHistory] = useState<Transaction[]>([]);

  // Create View State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<number>(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.DEFERRED);
  const [dueDate, setDueDate] = useState('');

  // Details Modal State
  const [detailsModal, setDetailsModal] = useState<{
    isOpen: boolean;
    transaction: Transaction | null;
  }>({ isOpen: false, transaction: null });

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to extract list data from potentially paginated response
  const getListData = (response: any) => {
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data && response.data.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsResponse, suppliersResponse, transactionsResponse] = await Promise.all([
        productsAPI.list(),
        suppliersAPI.list(),
        transactionsAPI.list({ type: TransactionType.PURCHASE })
      ]);
      // Handle both paginated and non-paginated responses
      const productsData = getListData(productsResponse);
      const suppliersData = getListData(suppliersResponse);
      const transactionsData = getListData(transactionsResponse);

      setProducts(Array.isArray(productsData) ? productsData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      setPurchaseHistory(Array.isArray(transactionsData) ? transactionsData : []);

      // Set default supplier
      if (Array.isArray(suppliersData) && suppliersData.length > 0) {
        setSelectedSupplier(suppliersData[0].id);
      }
    } catch (err: any) {
      alert(handleAPIError(err));
      setProducts([]);
      setSuppliers([]);
      setPurchaseHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter products for selection - memoized for performance
  const filteredProducts = useMemo(() => (products || []).filter(p =>
    p.name.includes(searchTerm) || p.sku.includes(searchTerm)
  ), [products, searchTerm]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev;
      return [...prev, { ...product, cartQuantity: 1, discount: 0 }];
    });
  };

  const updateCartItem = (id: number, field: keyof CartItem, value: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCompletePurchase = async () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + (item.costPrice * item.cartQuantity), 0);

    setLoading(true);
    try {
      await transactionsAPI.createPurchase({
        supplier_id: selectedSupplier,
        payment_method: paymentMethod,
        items: cart.map(item => ({
          id: item.id,
          quantity: item.cartQuantity,
          cost_price: item.costPrice
        })),
        total_amount: total
      });

      alert('تم حفظ فاتورة الشراء وتحديث المخزن ومتوسط التكلفة!');

      // Clear cart
      setCart([]);
      setSearchTerm('');
      setDueDate('');

      // Refresh data
      await fetchData();
      onDataChange?.();
    } catch (err: any) {
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setSearchTerm('');
  };

  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
    try {
      const response = await suppliersAPI.create({
        name: supplierData.name,
        phone: supplierData.phone || ''
      });
      const newSupplier = response.data;
      setSuppliers(prev => [...prev, newSupplier]);
      setSelectedSupplier(newSupplier.id);
      alert('تم إضافة المورد بنجاح');
    } catch (err: any) {
      alert(handleAPIError(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Header - Compact */}
      <div className="flex justify-between items-center bg-dark-950 p-3 rounded-xl border border-dark-800 mb-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShoppingBag className="text-fox-500" size={22} />
          المشتريات
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView('create')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${view === 'create'
                ? 'bg-fox-500 text-white'
                : 'bg-dark-900 text-gray-400 hover:bg-dark-800 border border-dark-700'
              }`}
          >
            <Plus size={16} />
            فاتورة جديدة
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${view === 'history'
                ? 'bg-fox-500 text-white'
                : 'bg-dark-900 text-gray-400 hover:bg-dark-800 border border-dark-700'
              }`}
          >
            <History size={16} />
            السجل
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Left: Product Selection */}
          <div className="lg:col-span-2 bg-dark-950 rounded-xl border border-dark-800 p-4 overflow-hidden">
            <ProductSelector
              products={filteredProducts}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onAddToCart={addToCart}
            />
          </div>

          {/* Right: Cart */}
          <div className="lg:col-span-1">
            <PurchaseCart
              cart={cart}
              selectedSupplier={selectedSupplier}
              suppliers={suppliers}
              paymentMethod={paymentMethod}
              dueDate={dueDate}
              onUpdateItem={updateCartItem}
              onRemoveItem={removeFromCart}
              onSupplierChange={setSelectedSupplier}
              onPaymentMethodChange={setPaymentMethod}
              onDueDateChange={setDueDate}
              onCompletePurchase={handleCompletePurchase}
              onClearCart={handleClearCart}
              onAddSupplier={handleAddSupplier}
            />
          </div>
        </div>
      ) : (
        <div className="bg-dark-950 rounded-xl border border-dark-800 p-4 flex-1 overflow-auto">
          <h2 className="text-lg font-bold text-white mb-4">سجل فواتير الشراء</h2>
          {purchaseHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History size={48} className="mx-auto mb-4 opacity-30" />
              <p>لا توجد فواتير شراء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-dark-900 text-gray-400">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المورد</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                  {purchaseHistory.map(transaction => {
                    const supplier = suppliers.find(s => s.id === transaction.relatedId);
                    const supplierName = transaction.supplierName || supplier?.name || '-';
                    return (
                      <tr key={transaction.id} className="hover:bg-dark-900/50 text-gray-300">
                        <td className="p-3 font-mono">#{transaction.id}</td>
                        <td className="p-3 text-xs">{new Date(transaction.date).toLocaleDateString('ar-EG')}</td>
                        <td className="p-3">{supplierName}</td>
                        <td className="p-3 font-bold text-white">{transaction.amount.toLocaleString()} ج.م</td>
                        <td className="p-3">{transaction.paymentMethod}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-xs">
                            {transaction.status || 'مكتمل'}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => setDetailsModal({ isOpen: true, transaction })}
                            className="p-1.5 bg-fox-500/10 hover:bg-fox-500/20 text-fox-400 rounded"
                            title="عرض التفاصيل"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Purchase Details Modal */}
      <Modal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal({ isOpen: false, transaction: null })}
        title="تفاصيل فاتورة الشراء"
      >
        {detailsModal.transaction && (
          <div className="space-y-4">
            {/* Invoice Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-dark-900 p-3 rounded-lg">
                <span className="text-gray-400 block text-xs">رقم الفاتورة</span>
                <span className="text-white font-mono">#{detailsModal.transaction.id}</span>
              </div>
              <div className="bg-dark-900 p-3 rounded-lg">
                <span className="text-gray-400 block text-xs">التاريخ</span>
                <span className="text-white">{new Date(detailsModal.transaction.date).toLocaleDateString('ar-EG')}</span>
              </div>
              <div className="bg-dark-900 p-3 rounded-lg">
                <span className="text-gray-400 block text-xs">المورد</span>
                <span className="text-white">
                  {detailsModal.transaction.supplierName ||
                    suppliers.find(s => s.id === detailsModal.transaction?.relatedId)?.name || '-'}
                </span>
              </div>
              <div className="bg-dark-900 p-3 rounded-lg">
                <span className="text-gray-400 block text-xs">طريقة الدفع</span>
                <span className="text-white">{detailsModal.transaction.paymentMethod}</span>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-sm font-bold text-white mb-2">العناصر المشتراة</h4>
              {detailsModal.transaction.items && detailsModal.transaction.items.length > 0 ? (
                <div className="bg-dark-900 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-800 text-gray-400">
                      <tr>
                        <th className="p-2 text-right">المنتج</th>
                        <th className="p-2 text-center">الكمية</th>
                        <th className="p-2 text-center">سعر الوحدة</th>
                        <th className="p-2 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {detailsModal.transaction.items.map((item, idx) => (
                        <tr key={idx} className="text-gray-300">
                          <td className="p-2">{item.name || `منتج #${item.id}`}</td>
                          <td className="p-2 text-center">{item.cartQuantity}</td>
                          <td className="p-2 text-center">{(item.costPrice || 0).toLocaleString()}</td>
                          <td className="p-2 text-left font-bold text-white">
                            {((item.costPrice || 0) * (item.cartQuantity || 1)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 bg-dark-900 rounded-lg">
                  لا توجد تفاصيل للعناصر
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center bg-fox-500/10 p-3 rounded-lg border border-fox-500/30">
              <span className="text-fox-400 font-bold">الإجمالي</span>
              <span className="text-fox-400 font-bold text-lg">
                {detailsModal.transaction.amount.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Purchases;
