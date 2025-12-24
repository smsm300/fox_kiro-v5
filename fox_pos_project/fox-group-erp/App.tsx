
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Quotations from './pages/Quotations';
import Inventory from './pages/Inventory';
import Treasury from './pages/Treasury';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import { APP_SECTIONS, INITIAL_CUSTOMERS, INITIAL_PRODUCTS, INITIAL_SUPPLIERS, INITIAL_TRANSACTIONS, INITIAL_SETTINGS, INITIAL_USERS } from './constants';
import { Product, Transaction, Customer, Supplier, CartItem, PaymentMethod, TransactionType, Quotation, AppSettings, User, ActivityLogEntry, Shift } from './types';

// Helper to load from localStorage
const loadState = <T,>(key: string, fallback: T): T => {
  const stored = localStorage.getItem(`fox_erp_${key}`);
  return stored ? JSON.parse(stored) : fallback;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentSection, setCurrentSection] = useState(APP_SECTIONS.DASHBOARD);

  // Current logged in user
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);

  // Global State with Persistence
  const [products, setProducts] = useState<Product[]>(() => loadState('products', INITIAL_PRODUCTS));
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadState('transactions', INITIAL_TRANSACTIONS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadState('customers', INITIAL_CUSTOMERS));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadState('suppliers', INITIAL_SUPPLIERS));
  const [quotations, setQuotations] = useState<Quotation[]>(() => loadState('quotations', []));
  const [settings, setSettings] = useState<AppSettings>(() => loadState('settings', INITIAL_SETTINGS));
  const [users, setUsers] = useState<User[]>(() => loadState('users', INITIAL_USERS));
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() => loadState('logs', []));
  const [shifts, setShifts] = useState<Shift[]>(() => loadState('shifts', []));

  // Save to LocalStorage effects
  useEffect(() => localStorage.setItem('fox_erp_products', JSON.stringify(products)), [products]);
  useEffect(() => localStorage.setItem('fox_erp_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('fox_erp_customers', JSON.stringify(customers)), [customers]);
  useEffect(() => localStorage.setItem('fox_erp_suppliers', JSON.stringify(suppliers)), [suppliers]);
  useEffect(() => localStorage.setItem('fox_erp_quotations', JSON.stringify(quotations)), [quotations]);
  useEffect(() => localStorage.setItem('fox_erp_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('fox_erp_users', JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem('fox_erp_logs', JSON.stringify(activityLogs)), [activityLogs]);
  useEffect(() => localStorage.setItem('fox_erp_shifts', JSON.stringify(shifts)), [shifts]);

  // Helper to log activities
  const logActivity = (action: string, details: string) => {
    const newLog: ActivityLogEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action,
      details
    };
    setActivityLogs(prev => [...prev, newLog]);
  };

  // --- Shift Handlers ---

  const handleOpenShift = (startCash: number) => {
    if (settings.currentShiftId) {
      alert('هناك وردية مفتوحة بالفعل!');
      return;
    }
    const newShift: Shift = {
      id: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      startTime: new Date().toISOString(),
      startCash: startCash,
      status: 'open'
    };
    setShifts(prev => [...prev, newShift]);
    setSettings(prev => ({ ...prev, currentShiftId: newShift.id }));
    logActivity('وردية', `فتح وردية جديدة بواسطة ${currentUser.name} برصيد ${startCash}`);
  };

  const handleCloseShift = (endCash: number) => {
    if (!settings.currentShiftId) return;

    // Calculate expected cash
    // Start Cash + Sales (Cash) - Returns (Cash) - Expenses (Cash)
    const currentShift = shifts.find(s => s.id === settings.currentShiftId);
    if (!currentShift) return;

    const shiftTransactions = transactions.filter(t =>
      t.date >= currentShift.startTime &&
      t.status !== 'pending' && t.status !== 'rejected'
    );

    let cashMovement = 0;
    let salesTotal = 0;

    // Detailed Breakdown
    const salesByMethod = {
      [PaymentMethod.CASH]: 0,
      [PaymentMethod.WALLET]: 0,
      [PaymentMethod.INSTAPAY]: 0,
      [PaymentMethod.DEFERRED]: 0,
    };

    shiftTransactions.forEach(t => {
      if (t.type === TransactionType.SALE) {
        if (salesByMethod[t.paymentMethod] !== undefined) {
          salesByMethod[t.paymentMethod]! += t.amount;
        }
        salesTotal += t.amount;

        if (t.paymentMethod === PaymentMethod.CASH) {
          cashMovement += t.amount;
        }
      } else if (t.type === TransactionType.RETURN) {
        // Determine if customer return (money out) or purchase return (money in)
        const isCustomerReturn = customers.some(c => c.id === t.relatedId);
        if (isCustomerReturn && t.paymentMethod === PaymentMethod.CASH) cashMovement -= t.amount;
        else if (!isCustomerReturn && t.paymentMethod === PaymentMethod.CASH) cashMovement += t.amount;
      } else if ((t.type === TransactionType.PURCHASE || t.type === TransactionType.EXPENSE || t.type === TransactionType.WITHDRAWAL) && t.paymentMethod === PaymentMethod.CASH) {
        cashMovement -= t.amount;
      } else if (t.type === TransactionType.CAPITAL && t.paymentMethod === PaymentMethod.CASH) {
        cashMovement += t.amount;
      }
    });

    const expectedCash = currentShift.startCash + cashMovement;

    const updatedShift: Shift = {
      ...currentShift,
      endTime: new Date().toISOString(),
      endCash: endCash,
      expectedCash: expectedCash,
      totalSales: salesTotal,
      salesByMethod,
      status: 'closed'
    };

    setShifts(prev => prev.map(s => s.id === settings.currentShiftId ? updatedShift : s));
    setSettings(prev => ({ ...prev, currentShiftId: undefined }));
    logActivity('وردية', `إغلاق الوردية. المتوقع: ${expectedCash}، الفعلي: ${endCash}`);
    return updatedShift; // Return for printing Z-Report
  };

  // --- Handlers ---

  const handleSaleComplete = (cartItems: CartItem[], customerId: number, paymentMethod: PaymentMethod, totalAmount: number, invoiceId?: string, isDirectSale: boolean = false, dueDate?: string) => {
    // Check if shift is open
    if (!settings.currentShiftId) {
      alert('يجب فتح الوردية (Shift) أولاً قبل إجراء أي عملية بيع.');
      return;
    }

    // Determine Invoice ID: use provided one or next sequential number
    const finalInvoiceId = invoiceId || settings.nextInvoiceNumber.toString();

    // 1. Create Sale Transaction
    const newTransaction: Transaction = {
      id: finalInvoiceId,
      type: TransactionType.SALE,
      date: new Date().toISOString(),
      amount: totalAmount,
      paymentMethod: paymentMethod,
      description: isDirectSale ? `فاتورة بيع مباشر (خارجي) لعميل #${customerId}` : `فاتورة بيع لعميل #${customerId}`,
      relatedId: customerId,
      items: cartItems,
      status: 'completed',
      dueDate: paymentMethod === PaymentMethod.DEFERRED ? dueDate : undefined,
      isDirectSale: isDirectSale, // Save flag
      shiftId: settings.currentShiftId // Link to Shift
    };
    setTransactions(prev => [...prev, newTransaction]);

    // 2. Handle Inventory & Expenses
    if (isDirectSale) {
      // Direct Sale: Do NOT reduce stock. Instead, create an Expense transaction for COGS
      const cogs = cartItems.reduce((sum, item) => sum + (item.costPrice * item.cartQuantity), 0);
      const expenseTransaction: Transaction = {
        id: `EXP-DS-${finalInvoiceId}`,
        type: TransactionType.EXPENSE,
        date: new Date().toISOString(),
        amount: cogs,
        paymentMethod: PaymentMethod.CASH, // Assume we paid cash to buy these items
        category: 'تكلفة بضاعة مباعة (Direct)',
        description: `تكلفة تشغيل (بضاعة بيع مباشر) لفاتورة #${finalInvoiceId}`,
        status: 'completed',
        shiftId: settings.currentShiftId
      };
      setTransactions(prev => [...prev, expenseTransaction]);
    } else {
      // Normal Sale: Reduce Inventory
      const updatedProducts = products.map(p => {
        const soldItem = cartItems.find(item => item.id === p.id);
        if (soldItem) {
          return { ...p, quantity: Math.max(0, p.quantity - soldItem.cartQuantity) };
        }
        return p;
      });
      setProducts(updatedProducts);
    }

    // 3. Handle Customer Balance (Debt)
    if (paymentMethod === PaymentMethod.DEFERRED) {
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, balance: c.balance - totalAmount } : c
      ));
    }

    // 4. Update Settings (Invoice Number)
    if (!invoiceId || invoiceId === settings.nextInvoiceNumber.toString()) {
      setSettings(prev => ({ ...prev, nextInvoiceNumber: prev.nextInvoiceNumber + 1 }));
    }

    logActivity('عملية بيع', `إضافة فاتورة بيع رقم ${newTransaction.id} بقيمة ${totalAmount}`);
  };

  const handlePurchaseComplete = (cartItems: CartItem[], supplierId: number, paymentMethod: PaymentMethod, totalAmount: number, dueDate?: string) => {
    const newTransaction: Transaction = {
      id: `PUR-${Date.now()}`,
      type: TransactionType.PURCHASE,
      date: new Date().toISOString(),
      amount: totalAmount,
      paymentMethod: paymentMethod,
      description: `فاتورة شراء من مورد #${supplierId}`,
      relatedId: supplierId,
      items: cartItems,
      status: 'completed',
      dueDate: paymentMethod === PaymentMethod.DEFERRED ? dueDate : undefined,
      shiftId: settings.currentShiftId
    };
    setTransactions(prev => [...prev, newTransaction]);

    const updatedProducts = products.map(p => {
      const purchasedItem = cartItems.find(item => item.id === p.id);
      if (purchasedItem) {
        // Calculate Weighted Average Cost
        const oldTotalValue = p.quantity * p.costPrice;
        const newTotalValue = purchasedItem.cartQuantity * purchasedItem.costPrice;
        const newQuantity = p.quantity + purchasedItem.cartQuantity;

        // Avoid division by zero
        const newAvgCost = newQuantity > 0
          ? (oldTotalValue + newTotalValue) / newQuantity
          : purchasedItem.costPrice;

        return {
          ...p,
          quantity: newQuantity,
          costPrice: parseFloat(newAvgCost.toFixed(2)) // Store with 2 decimals
        };
      }
      return p;
    });
    setProducts(updatedProducts);

    if (paymentMethod === PaymentMethod.DEFERRED) {
      setSuppliers(prev => prev.map(s =>
        s.id === supplierId ? { ...s, balance: s.balance + totalAmount } : s
      ));
    }

    logActivity('عملية شراء', `إضافة فاتورة شراء من مورد #${supplierId}`);
    alert('تم حفظ فاتورة الشراء وتحديث المخزن ومتوسط التكلفة!');
  };

  const handleReturnTransaction = (originalTransaction: Transaction) => {
    if (originalTransaction.type !== TransactionType.SALE && originalTransaction.type !== TransactionType.PURCHASE) return;

    const isSale = originalTransaction.type === TransactionType.SALE;
    const returnType = TransactionType.RETURN;
    const items = originalTransaction.items || [];

    // Check if Direct Sale - Do NOT return stock
    const isDirect = originalTransaction.isDirectSale;

    const returnTransaction: Transaction = {
      id: `RET-${Date.now()}`,
      type: returnType,
      date: new Date().toISOString(),
      amount: originalTransaction.amount,
      paymentMethod: originalTransaction.paymentMethod,
      description: `مرتجع للفاتورة رقم ${originalTransaction.id}`,
      relatedId: originalTransaction.relatedId,
      items: items,
      status: 'completed',
      isDirectSale: isDirect,
      shiftId: settings.currentShiftId
    };
    setTransactions(prev => [...prev, returnTransaction]);

    if (!isDirect) {
      const updatedProducts = products.map(p => {
        const item = items.find(i => i.id === p.id);
        if (item) {
          return {
            ...p,
            quantity: isSale
              ? p.quantity + item.cartQuantity // Sales return: Increase stock
              : Math.max(0, p.quantity - item.cartQuantity) // Purchase return: Decrease stock
          };
        }
        return p;
      });
      setProducts(updatedProducts);
    }

    if (originalTransaction.paymentMethod === PaymentMethod.DEFERRED) {
      if (isSale) {
        setCustomers(prev => prev.map(c =>
          c.id === originalTransaction.relatedId ? { ...c, balance: c.balance + originalTransaction.amount } : c
        ));
      } else {
        setSuppliers(prev => prev.map(s =>
          s.id === originalTransaction.relatedId ? { ...s, balance: s.balance - originalTransaction.amount } : s
        ));
      }
    }

    logActivity('مرتجع', `تسجيل مرتجع للفاتورة ${originalTransaction.id}`);
    alert('تم تسجيل المرتجع وتحديث الحسابات.');
  };

  const handleAddExpense = (amount: number, description: string, category: string) => {
    const threshold = 2000;
    const isPending = amount > threshold && currentUser.role !== 'admin';

    const newTransaction: Transaction = {
      id: `EXP-${Date.now()}`,
      type: TransactionType.EXPENSE,
      date: new Date().toISOString(),
      amount: amount,
      paymentMethod: PaymentMethod.CASH,
      description: description,
      category: category,
      status: isPending ? 'pending' : 'completed',
      shiftId: settings.currentShiftId
    };

    setTransactions(prev => [...prev, newTransaction]);

    if (isPending) {
      logActivity('مصروفات', `طلب موافقة على مصروف بقيمة ${amount}`);
      alert('تم تسجيل الطلب، بانتظار موافقة المدير (المبلغ يتجاوز الحد المسموح).');
    } else {
      logActivity('مصروفات', `تسجيل مصروف (${category}) بقيمة ${amount}`);
      alert('تم تسجيل المصروف بنجاح');
    }
  };

  const handleCapitalTransaction = (type: 'deposit' | 'withdrawal', amount: number, description: string) => {
    const newTransaction: Transaction = {
      id: `CAP-${Date.now()}`,
      type: type === 'deposit' ? TransactionType.CAPITAL : TransactionType.WITHDRAWAL,
      date: new Date().toISOString(),
      amount: amount,
      paymentMethod: PaymentMethod.CASH,
      description: description,
      status: 'completed',
      shiftId: settings.currentShiftId
    };
    setTransactions(prev => [...prev, newTransaction]);
    logActivity('رأس مال', `${type === 'deposit' ? 'إيداع رأس مال' : 'مسحوبات شخصية'} بقيمة ${amount}`);
    alert('تم تسجيل العملية بنجاح');
  };

  const handleApproveTransaction = (id: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'completed' } : t
    ));
    logActivity('موافقة', `تمت الموافقة على المعاملة ${id}`);
  };

  const handleRejectTransaction = (id: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'rejected' } : t
    ));
    logActivity('رفض', `تم رفض المعاملة ${id}`);
  };

  const handleDebtSettlement = (type: 'customer' | 'supplier', id: number, amount: number, notes: string) => {
    const isCustomer = type === 'customer';
    const transType = isCustomer ? TransactionType.SALE : TransactionType.PURCHASE;

    const newTransaction: Transaction = {
      id: `SETTLE-${Date.now()}`,
      type: transType,
      date: new Date().toISOString(),
      amount: amount,
      paymentMethod: PaymentMethod.CASH,
      description: isCustomer
        ? `تحصيل دفعة من حساب العميل (سداد مديونية): ${notes}`
        : `سداد دفعة للمورد (سداد مديونية): ${notes}`,
      category: 'تسوية مديونية',
      relatedId: id,
      status: 'completed',
      shiftId: settings.currentShiftId
    };

    setTransactions(prev => [...prev, newTransaction]);

    if (isCustomer) {
      setCustomers(prev => prev.map(c =>
        c.id === id ? { ...c, balance: c.balance + amount } : c
      ));
      logActivity('تحصيل', `استلام مبلغ ${amount} من العميل ID: ${id}`);
    } else {
      setSuppliers(prev => prev.map(s =>
        s.id === id ? { ...s, balance: s.balance - amount } : s
      ));
      logActivity('سداد', `دفع مبلغ ${amount} للمورد ID: ${id}`);
    }

    alert('تم تسجيل العملية وتحديث الرصيد بنجاح');
  };

  const handleStockAdjustment = (productId: number, quantityDiff: number, reason: string) => {
    // 1. Update Product
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newQty = product.quantity + quantityDiff;
    if (newQty < 0) {
      alert('لا يمكن أن يصبح المخزون بالسالب');
      return;
    }

    setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: newQty } : p));

    // 2. Create Adjustment Transaction (Invisible mostly, but good for logs)
    const newTransaction: Transaction = {
      id: `ADJ-${Date.now()}`,
      type: TransactionType.ADJUSTMENT,
      date: new Date().toISOString(),
      amount: 0, // Zero value transaction for now, or could calculate cost loss/gain
      paymentMethod: PaymentMethod.CASH,
      description: `تسوية مخزون لـ ${product.name}: ${quantityDiff > 0 ? '+' : ''}${quantityDiff} ${product.unit}. السبب: ${reason}`,
      items: [{ ...product, cartQuantity: Math.abs(quantityDiff), discount: 0 }],
      status: 'completed',
      shiftId: settings.currentShiftId
    };
    setTransactions(prev => [...prev, newTransaction]);
    logActivity('تسوية مخزون', `تعديل كمية ${product.name} بمقدار ${quantityDiff}. السبب: ${reason}`);
    alert('تم تحديث المخزون وتسجيل التسوية');
  };

  const handleCreateQuotation = (customerId: number, items: CartItem[]) => {
    const customer = customers.find(c => c.id === customerId);
    const newQuote: Quotation = {
      id: `QT-${Date.now()}`,
      date: new Date().toISOString(),
      customerId,
      customerName: customer?.name || 'Unknown',
      items,
      totalAmount: items.reduce((sum, item) => sum + (item.sellPrice * item.cartQuantity), 0),
      status: 'pending'
    };
    setQuotations(prev => [newQuote, ...prev]);
    logActivity('عرض سعر', `إنشاء عرض سعر للعميل ${customer?.name}`);
  };

  const handleConvertQuoteToInvoice = (quotationId: string) => {
    const quote = quotations.find(q => q.id === quotationId);
    if (!quote) return;

    const stockIssues = quote.items.filter(item => {
      const product = products.find(p => p.id === item.id);
      return !product || product.quantity < item.cartQuantity;
    });

    if (stockIssues.length > 0) {
      alert(`تنبيه: بعض المنتجات في العرض غير متوفرة بالكمية المطلوبة في المخزن: ${stockIssues.map(i => i.name).join(', ')}`);
      if (!window.confirm('هل تريد المتابعة رغم نقص المخزون؟ (سيصبح المخزون بالسالب)')) return;
    }

    handleSaleComplete(quote.items, quote.customerId, PaymentMethod.CASH, quote.totalAmount);
    setQuotations(prev => prev.map(q => q.id === quotationId ? { ...q, status: 'converted' } : q));
    logActivity('تحويل عرض سعر', `تحويل العرض ${quotationId} لفاتورة`);
    alert('تم تحويل العرض لفاتورة بيع بنجاح');
  };

  // --- CRUD Handlers with Safety Checks ---

  const handleAddCustomer = (customerData: Omit<Customer, 'id'>) => {
    const newCustomer: Customer = { id: Date.now(), ...customerData };
    setCustomers(prev => [...prev, newCustomer]);
    logActivity('إضافة عميل', `إضافة العميل ${customerData.name}`);
    return newCustomer;
  };

  const handleUpdateCustomer = (customer: Customer) => {
    setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
    logActivity('تعديل عميل', `تعديل بيانات العميل ${customer.name}`);
  };

  const handleDeleteCustomer = (id: number) => {
    const hasTransactions = transactions.some(t => t.relatedId === id);
    const customer = customers.find(c => c.id === id);
    if (hasTransactions || (customer && customer.balance !== 0)) {
      alert('لا يمكن حذف هذا العميل لوجود معاملات سابقة أو رصيد غير صفري. يرجى تصفية الحساب أولاً.');
      return;
    }
    if (window.confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      logActivity('حذف عميل', `حذف العميل ID: ${id}`);
    }
  };

  const handleAddSupplier = (supplierData: Omit<Supplier, 'id'>) => {
    const newSupplier: Supplier = { id: Date.now(), ...supplierData };
    setSuppliers(prev => [...prev, newSupplier]);
    logActivity('إضافة مورد', `إضافة المورد ${supplierData.name}`);
  };

  const handleUpdateSupplier = (supplier: Supplier) => {
    setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s));
    logActivity('تعديل مورد', `تعديل بيانات المورد ${supplier.name}`);
  };

  const handleDeleteSupplier = (id: number) => {
    const hasTransactions = transactions.some(t => t.relatedId === id);
    const supplier = suppliers.find(s => s.id === id);
    if (hasTransactions || (supplier && supplier.balance !== 0)) {
      alert('لا يمكن حذف هذا المورد لوجود معاملات سابقة أو رصيد غير صفري.');
      return;
    }
    if (window.confirm('هل أنت متأكد من حذف هذا المورد؟')) {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      logActivity('حذف مورد', `حذف المورد ID: ${id}`);
    }
  };

  const handleAddProduct = (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = { ...productData, id: Date.now() };
    setProducts(prev => [...prev, newProduct]);
    logActivity('إضافة منتج', `إضافة المنتج ${productData.name}`);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    logActivity('تعديل منتج', `تعديل المنتج ${updatedProduct.name}`);
  };

  const handleDeleteProduct = (id: number) => {
    const hasTransactions = transactions.some(t => t.items?.some(i => i.id === id));
    if (hasTransactions) {
      alert('لا يمكن حذف المنتج لأنه موجود في فواتير سابقة. يمكنك تعديل كميته لصفر بدلاً من ذلك.');
      return;
    }
    if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      logActivity('حذف منتج', `حذف المنتج ID: ${id}`);
    }
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    logActivity('إعدادات', 'تحديث إعدادات النظام');
    alert('تم حفظ الإعدادات بنجاح');
  };

  const handleAddUser = (userData: Omit<User, 'id'>) => {
    const newUser: User = { id: Date.now(), ...userData };
    setUsers(prev => [...prev, newUser]);
    logActivity('مستخدمين', `إضافة مستخدم جديد: ${userData.username}`);
  };

  const handleDeleteUser = (userId: number) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    logActivity('مستخدمين', `حذف مستخدم ID: ${userId}`);
  };

  const handleChangePassword = (newPassword: string) => {
    setUsers(prev => prev.map(u =>
      u.id === currentUser.id ? { ...u, password: newPassword } : u
    ));
    setCurrentUser(prev => ({ ...prev, password: newPassword }));
    logActivity('حسابي', 'تم تغيير كلمة المرور');
  };

  // --- System Management Handlers ---

  const handleBackup = () => {
    const data = {
      products, transactions, customers, suppliers, quotations, settings, users, activityLogs, shifts,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fox_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    logActivity('نسخ احتياطي', 'تنزيل نسخة احتياطية من البيانات');
  };

  const handleRestore = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.version && data.products) {
          setProducts(data.products || []);
          setTransactions(data.transactions || []);
          setCustomers(data.customers || []);
          setSuppliers(data.suppliers || []);
          setQuotations(data.quotations || []);
          setSettings(data.settings || INITIAL_SETTINGS);
          setUsers(data.users || INITIAL_USERS);
          setActivityLogs(data.activityLogs || []);
          setShifts(data.shifts || []);
          logActivity('استعادة نسخة', 'تم استعادة البيانات من ملف نسخة احتياطية');
          alert('تم استعادة البيانات بنجاح!');
        } else {
          alert('ملف غير صالح');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف');
      }
    };
    reader.readAsText(file);
  };

  const handleClearTransactions = () => {
    setTransactions([]);
    setActivityLogs([]);
    setQuotations([]);
    setShifts([]);
    setSettings(prev => ({ ...prev, currentShiftId: undefined }));
    // Reset Balances
    setCustomers(prev => prev.map(c => ({ ...c, balance: 0 })));
    setSuppliers(prev => prev.map(s => ({ ...s, balance: 0 })));
    logActivity('مسح معاملات', 'تم مسح سجل المعاملات وتصفية الحسابات');
    alert('تم مسح جميع المعاملات وتصفية أرصدة العملاء والموردين بنجاح. المخزون والمنتجات كما هي.');
  };

  const handleFactoryReset = () => {
    localStorage.clear();
    setProducts(INITIAL_PRODUCTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCustomers(INITIAL_CUSTOMERS);
    setSuppliers(INITIAL_SUPPLIERS);
    setQuotations([]);
    setSettings(INITIAL_SETTINGS);
    setUsers(INITIAL_USERS);
    setActivityLogs([]);
    setShifts([]);
    alert('تمت إعادة ضبط المصنع بنجاح!');
    window.location.reload();
  };

  // Notifications
  const lowStockProducts = products.filter(p => p.quantity <= p.minStockAlert);

  const renderContent = () => {
    switch (currentSection) {
      case APP_SECTIONS.DASHBOARD:
        return <Dashboard products={products} transactions={transactions} customers={customers} currentUser={currentUser} settings={settings} />;
      case APP_SECTIONS.SALES:
        return <Sales
          products={products}
          customers={customers}
          transactions={transactions}
          onCompleteSale={handleSaleComplete}
          onReturnTransaction={handleReturnTransaction}
          settings={settings}
          currentUser={currentUser}
          onOpenShift={handleOpenShift}
          onCloseShift={handleCloseShift}
          onAddCustomer={handleAddCustomer}
        />;
      case APP_SECTIONS.PURCHASES:
        return <Purchases products={products} suppliers={suppliers} transactions={transactions} onCompletePurchase={handlePurchaseComplete} onReturnTransaction={handleReturnTransaction} />;
      case APP_SECTIONS.QUOTATIONS:
        return <Quotations quotations={quotations} customers={customers} products={products} onCreateQuotation={handleCreateQuotation} onConvertToInvoice={handleConvertQuoteToInvoice} settings={settings} />;
      case APP_SECTIONS.INVENTORY:
        return <Inventory products={products} transactions={transactions} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onStockAdjustment={handleStockAdjustment} settings={settings} />;
      case APP_SECTIONS.TREASURY:
        return <Treasury
          transactions={transactions}
          customers={customers}
          suppliers={suppliers}
          onAddExpense={handleAddExpense}
          onReturnTransaction={handleReturnTransaction}
          onDebtSettlement={handleDebtSettlement}
          settings={settings}
          currentUser={currentUser}
          onApprove={handleApproveTransaction}
          onReject={handleRejectTransaction}
          onCapitalTransaction={handleCapitalTransaction}
        />;
      case APP_SECTIONS.CUSTOMERS:
        return <Customers customers={customers} transactions={transactions} onAddCustomer={handleAddCustomer} onUpdateCustomer={handleUpdateCustomer} onDeleteCustomer={handleDeleteCustomer} settings={settings} />;
      case APP_SECTIONS.SUPPLIERS:
        return <Suppliers suppliers={suppliers} transactions={transactions} onAddSupplier={handleAddSupplier} onUpdateSupplier={handleUpdateSupplier} onDeleteSupplier={handleDeleteSupplier} settings={settings} />;
      case APP_SECTIONS.REPORTS:
        return <Reports transactions={transactions} logs={activityLogs} shifts={shifts} customers={customers} suppliers={suppliers} products={products} currentUser={currentUser} settings={settings} />;
      case APP_SECTIONS.USERS:
        return <Users users={users} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} />;
      case APP_SECTIONS.SETTINGS:
        return <Settings settings={settings} onUpdateSettings={handleUpdateSettings} onBackup={handleBackup} onRestore={handleRestore} onFactoryReset={handleFactoryReset} onClearTransactions={handleClearTransactions} />;
      default:
        return <Dashboard products={products} transactions={transactions} customers={customers} currentUser={currentUser} settings={settings} />;
    }
  };

  if (!isAuthenticated) {
    return <Login users={users} onLogin={(user) => {
      setIsAuthenticated(true);
      setCurrentUser(user);
      logActivity('تسجيل دخول', `تسجيل دخول المستخدم ${user.username}`);
    }} />;
  }

  return (
    <Layout
      currentSection={currentSection}
      onNavigate={setCurrentSection}
      alertsCount={lowStockProducts.length}
      lowStockItems={lowStockProducts}
      currentUser={currentUser}
      onLogout={() => {
        setIsAuthenticated(false);
        logActivity('تسجيل خروج', 'خروج المستخدم من النظام');
      }}
      onChangePassword={handleChangePassword}
      settings={settings}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
