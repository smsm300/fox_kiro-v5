import React, { useState, useRef, useEffect } from 'react';
import { Product, Customer, CartItem, PaymentMethod, AppSettings, Transaction, User as AppUser, Shift } from '../types';
import { ShiftManager } from '../components/sales/ShiftManager';
import { ProductSelector } from '../components/sales/ProductSelector';
import { Cart } from '../components/sales/Cart';
import { shiftsAPI, settingsAPI } from '../services/endpoints';
import { handleAPIError } from '../services/errorHandler';
import { Modal } from '../components/Modal';

interface SalesProps {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  onCompleteSale: (items: CartItem[], customerId: number, paymentMethod: PaymentMethod, paidAmount: number, invoiceId: string, isDirectSale: boolean, dueDate?: string) => void;
  onReturnTransaction?: (transaction: Transaction) => void;
  settings: AppSettings;
  currentUser: AppUser;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => Customer;
}

const Sales: React.FC<SalesProps> = ({
  products,
  customers,
  transactions,
  onCompleteSale,
  settings: initialSettings,
  currentUser,
  onAddCustomer
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);

  // Fetch current user's open shift
  useEffect(() => {
    fetchCurrentShift();
  }, []);

  const fetchCurrentShift = async () => {
    try {
      const response = await shiftsAPI.list();
      const shifts = (response.data as any).results || response.data;
      // Find the current user's open shift
      const openShift = Array.isArray(shifts)
        ? shifts.find((s: Shift) => s.status === 'open' && s.userId === currentUser.id)
        : null;
      setCurrentShift(openShift || null);
    } catch (err: any) {
      console.error('Error fetching shift:', err);
    }
  };

  const handleOpenShift = async (startCash: number) => {
    setLoading(true);
    try {
      const response = await shiftsAPI.open(startCash);
      setCurrentShift(response.data);
      alert('تم فتح الوردية بنجاح');
    } catch (err: any) {
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (endCash: number) => {
    if (!currentShift) return;

    setLoading(true);
    try {
      const response = await shiftsAPI.close(currentShift.id, endCash);
      const closedShift = response.data;

      // Display Z-Report
      alert(`تم إغلاق الوردية\n\nالنقدية المتوقعة: ${closedShift.expectedCash}\nالنقدية الفعلية: ${closedShift.endCash}\nالفرق: ${closedShift.endCash! - closedShift.expectedCash!}`);

      setCurrentShift(null);
      return closedShift;
    } catch (err: any) {
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };
  // POS State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  // Find cash customer as default - look for "عميل نقدي" first
  const getCashCustomerId = () => {
    const cashCustomer = customers.find(c => c.name === 'عميل نقدي');
    if (cashCustomer) return cashCustomer.id;
    const firstCustomer = customers[0];
    return firstCustomer?.id || 1;
  };
  const [selectedCustomer, setSelectedCustomer] = useState<number>(getCashCustomerId());

  // Update selected customer when customers list loads
  useEffect(() => {
    if (customers.length > 0) {
      setSelectedCustomer(getCashCustomerId());
    }
  }, [customers]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isDirectSale, setIsDirectSale] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Discount Modal State
  const [discountModalItem, setDiscountModalItem] = useState<{ id: number, price: number, currentDiscount: number } | null>(null);
  const [discountValue, setDiscountValue] = useState<string>('');

  // Check if current user has an open shift
  // Admins can work without a shift, but cashiers must have one
  const requiresShift = currentUser.role !== 'admin';

  // Close shift modal state
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [endCash, setEndCash] = useState('');

  if (!currentShift && requiresShift) {
    return <ShiftManager onOpenShift={handleOpenShift} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">جاري التحميل...</div>
      </div>
    );
  }

  // Add product to cart
  const handleAddToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, cartQuantity: item.cartQuantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        ...product,
        cartQuantity: 1,
        discount: 0
      }]);
    }

    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  // Update cart item quantity
  const handleUpdateQuantity = (id: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.cartQuantity + delta;
        return newQty > 0 ? { ...item, cartQuantity: newQty } : item;
      }
      return item;
    }).filter(item => item.cartQuantity > 0));
  };

  // Remove item from cart
  const handleRemoveItem = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Open discount modal
  const handleOpenDiscountModal = (item: CartItem) => {
    setDiscountModalItem({
      id: item.id,
      price: item.sellPrice,
      currentDiscount: item.discount || 0
    });
    setDiscountValue((item.discount || 0).toString());
  };

  // Apply discount
  const handleApplyDiscount = () => {
    if (!discountModalItem) return;

    const discount = Number(discountValue) || 0;
    if (discount < 0 || discount > discountModalItem.price) {
      alert('قيمة الخصم غير صحيحة');
      return;
    }

    setCart(cart.map(item =>
      item.id === discountModalItem.id
        ? { ...item, discount }
        : item
    ));
    setDiscountModalItem(null);
    setDiscountValue('');
  };

  // Complete sale
  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) =>
      sum + ((item.sellPrice - (item.discount || 0)) * item.cartQuantity), 0
    );

    const invoiceId = `INV-${Date.now()}`;

    onCompleteSale(
      cart,
      selectedCustomer,
      paymentMethod,
      total,
      invoiceId,
      isDirectSale,
      paymentMethod === PaymentMethod.DEFERRED ? dueDate : undefined
    );

    // Clear cart
    setCart([]);
    setSearchTerm('');
    setIsDirectSale(false);
    setDueDate('');
    searchInputRef.current?.focus();
  };

  // Hold cart - save to localStorage for later
  const handleHoldCart = () => {
    if (cart.length === 0) return;

    const heldCarts = JSON.parse(localStorage.getItem('fox_erp_held_carts') || '[]');
    const newHeldCart = {
      id: Date.now(),
      items: cart,
      customerId: selectedCustomer,
      date: new Date().toISOString()
    };
    heldCarts.push(newHeldCart);
    localStorage.setItem('fox_erp_held_carts', JSON.stringify(heldCarts));

    setCart([]);
    setSearchTerm('');
    alert('تم تعليق السلة بنجاح. يمكنك استرجاعها لاحقاً.');
  };

  // Clear cart
  const handleClearCart = () => {
    setCart([]);
    setSearchTerm('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-140px)]">
      {/* Shift Info Bar for Cashier */}
      {currentShift && (
        <div className="lg:col-span-3 bg-dark-950 rounded-xl border border-dark-800 p-3 flex justify-between items-center">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">الوردية: <span className="text-fox-400 font-bold">#{currentShift.id}</span></span>
            <span className="text-gray-400">بداية: <span className="text-white">{new Date(currentShift.startTime).toLocaleTimeString('ar-EG')}</span></span>
            <span className="text-gray-400">رصيد البداية: <span className="text-emerald-400">{currentShift.startCash?.toLocaleString()} ج.م</span></span>
          </div>
          <button
            onClick={() => setIsCloseShiftModalOpen(true)}
            className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg font-bold hover:bg-red-500/20 border border-red-500/30 text-sm"
          >
            إنهاء الوردية
          </button>
        </div>
      )}

      {/* Left: Product Selection */}
      <div className="lg:col-span-2 bg-dark-950 rounded-xl border border-dark-800 p-4 overflow-hidden">
        <ProductSelector
          products={products}
          searchTerm={searchTerm}
          selectedCategory={selectedCategory}
          onSearchChange={setSearchTerm}
          onCategoryChange={setSelectedCategory}
          onAddToCart={handleAddToCart}
          searchInputRef={searchInputRef}
        />
      </div>

      {/* Right: Cart */}
      <div className="lg:col-span-1">
        <Cart
          cart={cart}
          selectedCustomer={selectedCustomer}
          customers={customers}
          paymentMethod={paymentMethod}
          isDirectSale={isDirectSale}
          dueDate={dueDate}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onOpenDiscountModal={handleOpenDiscountModal}
          onCustomerChange={setSelectedCustomer}
          onPaymentMethodChange={setPaymentMethod}
          onDirectSaleChange={setIsDirectSale}
          onDueDateChange={setDueDate}
          onCompleteSale={handleCompleteSale}
          onHoldCart={handleHoldCart}
          onClearCart={handleClearCart}
          onAddCustomer={onAddCustomer}
        />
      </div>

      {/* Discount Modal */}
      <Modal
        isOpen={!!discountModalItem}
        onClose={() => {
          setDiscountModalItem(null);
          setDiscountValue('');
        }}
        title="إضافة خصم"
      >
        {discountModalItem && (
          <div className="space-y-4">
            <div>
              <p className="text-gray-400 text-sm mb-2">سعر المنتج: {discountModalItem.price.toLocaleString()} ج.م</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">قيمة الخصم (ج.م)</label>
              <input
                type="number"
                min="0"
                max={discountModalItem.price}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg focus:border-fox-500 outline-none"
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="text-sm text-gray-400">
              السعر بعد الخصم: <span className="text-fox-400 font-bold">{(discountModalItem.price - (Number(discountValue) || 0)).toLocaleString()} ج.م</span>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleApplyDiscount}
                className="flex-1 bg-fox-500 text-white py-2 rounded-lg font-bold hover:bg-fox-600"
              >
                تطبيق الخصم
              </button>
              <button
                onClick={() => {
                  setDiscountModalItem(null);
                  setDiscountValue('');
                }}
                className="flex-1 bg-dark-800 text-gray-300 py-2 rounded-lg hover:bg-dark-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Close Shift Modal */}
      <Modal
        isOpen={isCloseShiftModalOpen}
        onClose={() => {
          setIsCloseShiftModalOpen(false);
          setEndCash('');
        }}
        title="إنهاء الوردية"
      >
        <div className="space-y-4">
          <div className="bg-dark-900 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">رصيد بداية الوردية</p>
            <p className="text-emerald-400 font-bold text-xl">{currentShift?.startCash?.toLocaleString()} ج.م</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">رصيد نهاية الدرج (النقدية الفعلية)</label>
            <input
              type="number"
              min="0"
              value={endCash}
              onChange={(e) => setEndCash(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg focus:border-fox-500 outline-none text-xl font-bold"
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={async () => {
                await handleCloseShift(Number(endCash) || 0);
                setIsCloseShiftModalOpen(false);
                setEndCash('');
              }}
              className="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold hover:bg-red-600"
            >
              إنهاء الوردية
            </button>
            <button
              onClick={() => {
                setIsCloseShiftModalOpen(false);
                setEndCash('');
              }}
              className="flex-1 bg-dark-800 text-gray-300 py-2 rounded-lg hover:bg-dark-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Sales;
