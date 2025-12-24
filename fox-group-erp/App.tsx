
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Quotations from './pages/Quotations';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Treasury from './pages/Treasury';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import { APP_SECTIONS, INITIAL_CUSTOMERS, INITIAL_PRODUCTS, INITIAL_SUPPLIERS, INITIAL_TRANSACTIONS, INITIAL_SETTINGS, INITIAL_USERS } from './constants';
import { Product, Transaction, Customer, Supplier, CartItem, PaymentMethod, TransactionType, Quotation, AppSettings, User, ActivityLogEntry, Shift } from './types';
import { authAPI, productsAPI, customersAPI, suppliersAPI, transactionsAPI, shiftsAPI, quotationsAPI, settingsAPI, usersAPI, activityLogAPI } from './services/endpoints';
import { handleAPIError } from './services/errorHandler';
import { useAutoLogout } from './hooks/useAutoLogout';

// Helper to load from localStorage
const loadState = <T,>(key: string, fallback: T): T => {
  const stored = localStorage.getItem(`fox_erp_${key}`);
  return stored ? JSON.parse(stored) : fallback;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentSection, setCurrentSection] = useState(() => 
    localStorage.getItem('fox_erp_current_section') || APP_SECTIONS.DASHBOARD
  );
  
  // Current logged in user
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);

  // Global State - All data from API (NO localStorage for data)
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [users, setUsers] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  // Invoice Modal State
  const [invoiceModal, setInvoiceModal] = useState<{
    isOpen: boolean;
    transaction: Transaction | null;
    items: CartItem[];
    customerName: string;
    total: number;
    paymentMethod: PaymentMethod;
  }>({
    isOpen: false,
    transaction: null,
    items: [],
    customerName: '',
    total: 0,
    paymentMethod: PaymentMethod.CASH
  });

  // Logout handler
  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    setIsAuthenticated(false);
    logActivity('تسجيل خروج', 'خروج المستخدم من النظام');
  };

  // Auto logout hook (only active when authenticated)
  // Handles inactivity timeout and tab visibility
  useAutoLogout({
    onLogout: handleLogout,
    inactivityTimeout: (settings.inactivityTimeout || 30) * 60 * 1000,
    enabled: isAuthenticated // Only run when user is logged in
  });

  // Check authentication on mount (with browser close detection)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const sessionActive = sessionStorage.getItem('fox_erp_session_active');
    
    // If there's a token but no active session, browser was closed
    // Clear the old token so user needs to login again
    if (token && !sessionActive) {
      console.log('Browser was closed - clearing old authentication');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't return - let user see login page
    }
    
    // Check again after potential cleanup
    const currentToken = localStorage.getItem('token');
    const currentUserStr = localStorage.getItem('user');
    
    if (currentToken && currentUserStr) {
      try {
        const user = JSON.parse(currentUserStr);
        setCurrentUser(user);
        setIsAuthenticated(true);
        // Mark session as active
        sessionStorage.setItem('fox_erp_session_active', 'true');
      } catch (err) {
        console.error('Failed to parse user from localStorage:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Fetch Data on Auth
  useEffect(() => {
    if (isAuthenticated) {
      fetchInitialData();
    }
  }, [isAuthenticated]);

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

  const fetchInitialData = async () => {
    try {
      const [
        productsRes,
        transactionsRes,
        customersRes,
        suppliersRes,
        quotationsRes,
        settingsRes,
        usersRes,
        activityLogsRes,
        shiftsRes
      ] = await Promise.all([
        productsAPI.list(),
        transactionsAPI.list(),
        customersAPI.list(),
        suppliersAPI.list(),
        quotationsAPI.list(),
        settingsAPI.get(),
        usersAPI.list(),
        activityLogAPI.list(),
        shiftsAPI.list()
      ]);

      setProducts(getListData(productsRes));
      setTransactions(getListData(transactionsRes));
      setCustomers(getListData(customersRes));
      setSuppliers(getListData(suppliersRes));
      setQuotations(getListData(quotationsRes));
      if (settingsRes.data) setSettings(settingsRes.data);
      setUsers(getListData(usersRes));
      setActivityLogs(getListData(activityLogsRes));
      setShifts(getListData(shiftsRes));

    } catch (error: any) {
      console.error('Error fetching initial data:', error);
      // Don't show alert on load to avoid annoyance, just log
    }
  };

  // Save only current section to localStorage (for navigation persistence)
  useEffect(() => localStorage.setItem('fox_erp_current_section', currentSection), [currentSection]);

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

  const handleOpenShift = async (startCash: number) => {
    if (settings.currentShiftId) {
      alert('هناك وردية مفتوحة بالفعل!');
      return;
    }

    try {
      const response = await shiftsAPI.open(startCash);
      const newShift = response.data;
      
      setShifts(prev => [...prev, newShift]);
      setSettings(prev => ({ ...prev, currentShiftId: newShift.id }));
      
      logActivity('وردية', `فتح وردية جديدة بواسطة ${currentUser.name} برصيد ${startCash}`);
    } catch (error: any) {
      console.error('Failed to open shift:', error);
      alert('فشل فتح الوردية: ' + handleAPIError(error));
    }
  };

  const handleCloseShift = async (endCash: number) => {
    if (!settings.currentShiftId) return;

    try {
      const response = await shiftsAPI.close(settings.currentShiftId, endCash);
      const updatedShift = response.data;
      
      setShifts(prev => prev.map(s => s.id === settings.currentShiftId ? updatedShift : s));
      setSettings(prev => ({ ...prev, currentShiftId: undefined }));
      
      logActivity('وردية', `إغلاق الوردية. المتوقع: ${updatedShift.expectedCash}، الفعلي: ${endCash}`);
      return updatedShift;
    } catch (error: any) {
      console.error('Failed to close shift:', error);
      alert('فشل إغلاق الوردية: ' + handleAPIError(error));
    }
  };

  // --- Handlers ---

  const handleSaleComplete = async (cartItems: CartItem[], customerId: number, paymentMethod: PaymentMethod, totalAmount: number, invoiceId?: string, isDirectSale: boolean = false, dueDate?: string) => {
    // Check if shift is open (Admin can sell without shift)
    if (!settings.currentShiftId && currentUser.role !== 'admin') {
      alert('يجب فتح الوردية (Shift) أولاً قبل إجراء أي عملية بيع.');
      return;
    }

    try {
      // 1. Create Sale Transaction via API
      const response = await transactionsAPI.createSale({
        customer_id: customerId,
        payment_method: paymentMethod,
        items: cartItems.map(item => ({
          id: item.id,
          quantity: item.cartQuantity,
          price: item.sellPrice,
          discount: item.discount || 0
        })),
        total_amount: totalAmount,
        invoice_id: invoiceId,
        is_direct_sale: isDirectSale
      });

      const newTransaction = response.data;
      setTransactions(prev => [...prev, newTransaction]);

      // 2. Refresh Products (to get updated stock)
      const productsRes = await productsAPI.list();
      setProducts(getListData(productsRes));

      // 3. Refresh Customers (to get updated balance if deferred)
      if (paymentMethod === PaymentMethod.DEFERRED) {
        const customersRes = await customersAPI.list();
        setCustomers(getListData(customersRes));
      }

      // 4. Update Settings (Invoice Number) if needed
      // (API handles this usually, but we update local state to reflect changes immediately if we want)
      // But simpler to just fetch settings or let API handle next ID.
      // Let's refresh settings just in case
      // const settingsRes = await settingsAPI.get();
      // setSettings(settingsRes.data);
      // Actually, we can manually increment locally to avoid full fetch for just ID
      if (!invoiceId || invoiceId === settings.nextInvoiceNumber.toString()) {
         setSettings(prev => ({...prev, nextInvoiceNumber: prev.nextInvoiceNumber + 1}));
      }

      logActivity('عملية بيع', `إضافة فاتورة بيع رقم ${newTransaction.id} بقيمة ${totalAmount}`);
      
      // Show Invoice Modal
      const customer = customers.find(c => c.id === customerId);
      setInvoiceModal({
        isOpen: true,
        transaction: newTransaction,
        items: cartItems,
        customerName: customer?.name || 'عميل نقدي',
        total: totalAmount,
        paymentMethod
      });
      
    } catch (error: any) {
      console.error('Sale failed:', error);
      alert('فشل حفظ عملية البيع: ' + handleAPIError(error));
    }
  };

  // Print Invoice from Modal
  const handlePrintInvoice = () => {
    const printContent = document.getElementById('invoice-print-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 15px; font-size: 12px; background: white; color: black; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
          .logo { font-size: 20px; font-weight: bold; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
          th, td { padding: 5px 3px; text-align: right; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; }
          .total-section { border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .grand-total { font-size: 16px; font-weight: bold; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>${printContent.innerHTML}</body>
      <script>window.onload = function() { window.print(); window.close(); }</script>
      </html>
    `);
    printWindow.document.close();
  };

  // Close Invoice Modal
  const closeInvoiceModal = () => {
    setInvoiceModal({
      isOpen: false,
      transaction: null,
      items: [],
      customerName: '',
      total: 0,
      paymentMethod: PaymentMethod.CASH
    });
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
      items: [{...product, cartQuantity: Math.abs(quantityDiff), discount: 0}],
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
      if(!window.confirm('هل تريد المتابعة رغم نقص المخزون؟ (سيصبح المخزون بالسالب)')) return;
    }

    // If customerId is 0 or not found in customers, use cash customer
    let customerId = quote.customerId;
    const customerExists = customers.find(c => c.id === customerId);
    if (!customerExists || customerId === 0) {
      // Find cash customer or use first customer
      const cashCustomer = customers.find(c => c.name === 'عميل نقدي');
      customerId = cashCustomer?.id || customers[0]?.id || 0;
    }

    handleSaleComplete(quote.items, customerId, PaymentMethod.CASH, quote.totalAmount);
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
    if(window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
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
    setCustomers(prev => prev.map(c => ({...c, balance: 0})));
    setSuppliers(prev => prev.map(s => ({...s, balance: 0})));
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
  const lowStockProducts = Array.isArray(products) ? products.filter(p => p.quantity <= p.minStockAlert) : [];

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
                  onAddCustomer={handleAddCustomer}
               />;
      case APP_SECTIONS.PURCHASES:
        return <Purchases onDataChange={fetchInitialData} />;
      case APP_SECTIONS.QUOTATIONS:
        return <Quotations quotations={quotations} customers={customers} products={products} onCreateQuotation={handleCreateQuotation} onConvertToInvoice={handleConvertQuoteToInvoice} settings={settings} />;
      case APP_SECTIONS.INVOICES:
        return <Invoices onDataChange={fetchInitialData} />;
      case APP_SECTIONS.INVENTORY:
        return <Inventory onProductsChange={fetchInitialData} />;
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
        return <Customers onDataChange={fetchInitialData} />;
      case APP_SECTIONS.SUPPLIERS:
        return <Suppliers onDataChange={fetchInitialData} />;
      case APP_SECTIONS.REPORTS:
        return <Reports />;
      case APP_SECTIONS.USERS:
        return <Users />;
      case APP_SECTIONS.SETTINGS:
        return <Settings />;
      default:
        return <Dashboard products={products} transactions={transactions} customers={customers} currentUser={currentUser} settings={settings} />;
    }
  };

  if (!isAuthenticated) {
    return <Login users={users} onLogin={(user) => {
      // Mark session as active for browser close detection
      sessionStorage.setItem('fox_erp_session_active', 'true');
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
      onLogout={handleLogout}
      onChangePassword={handleChangePassword}
      settings={settings}
    >
      {renderContent()}
      
      {/* Invoice Modal */}
      {invoiceModal.isOpen && invoiceModal.transaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div id="invoice-print-content" className="p-6 text-black">
              {/* Header */}
              <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-4">
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="h-12 mx-auto mb-2" />
                )}
                <h1 className="text-xl font-bold">{settings.companyName || 'Fox Group'}</h1>
                {settings.companyAddress && <p className="text-sm text-gray-600">{settings.companyAddress}</p>}
                {settings.companyPhone && <p className="text-sm text-gray-600">تليفون: {settings.companyPhone}</p>}
              </div>
              
              {/* Info */}
              <div className="mb-4 text-sm space-y-1">
                <div className="flex justify-between"><span>رقم الفاتورة:</span><span>#{invoiceModal.transaction.id}</span></div>
                <div className="flex justify-between"><span>التاريخ:</span><span>{new Date().toLocaleString('ar-EG')}</span></div>
                <div className="flex justify-between"><span>العميل:</span><span>{invoiceModal.customerName}</span></div>
                <div className="flex justify-between"><span>طريقة الدفع:</span><span>{invoiceModal.paymentMethod}</span></div>
              </div>
              
              {/* Items Table */}
              <table className="w-full text-sm mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-right">الصنف</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-left">السعر</th>
                    <th className="p-2 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceModal.items.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-center">{item.cartQuantity}</td>
                      <td className="p-2 text-left">{item.sellPrice.toLocaleString()}</td>
                      <td className="p-2 text-left">{((item.sellPrice - (item.discount || 0)) * item.cartQuantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Totals */}
              <div className="border-t-2 border-dashed border-gray-400 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>المجموع الفرعي:</span>
                  <span>{invoiceModal.items.reduce((s, i) => s + (i.sellPrice * i.cartQuantity), 0).toLocaleString()} ج.م</span>
                </div>
                {invoiceModal.items.reduce((s, i) => s + ((i.discount || 0) * i.cartQuantity), 0) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>الخصم:</span>
                    <span>- {invoiceModal.items.reduce((s, i) => s + ((i.discount || 0) * i.cartQuantity), 0).toLocaleString()} ج.م</span>
                  </div>
                )}
                {settings.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>ضريبة القيمة المضافة ({settings.taxRate}%):</span>
                    <span>{(invoiceModal.total * settings.taxRate / 100).toLocaleString()} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>الإجمالي:</span>
                  <span>{(invoiceModal.total + (settings.taxRate > 0 ? invoiceModal.total * settings.taxRate / 100 : 0)).toLocaleString()} ج.م</span>
                </div>
              </div>
              
              {/* Invoice Terms */}
              {settings.invoiceTerms && (
                <div className="mt-4 pt-3 border-t border-dashed border-gray-300 text-xs text-gray-500">
                  <p className="font-bold mb-1">الشروط والأحكام:</p>
                  <p>{settings.invoiceTerms}</p>
                </div>
              )}
              
              {/* Footer */}
              <div className="text-center mt-4 pt-4 border-t border-dashed border-gray-400 text-sm text-gray-600">
                <p>شكراً لتعاملكم معنا</p>
                <p>نتمنى لكم يوماً سعيداً</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 p-4 bg-gray-100 border-t">
              <button
                onClick={handlePrintInvoice}
                className="flex-1 bg-fox-500 text-white py-2 rounded-lg font-bold hover:bg-fox-600"
              >
                طباعة
              </button>
              <button
                onClick={closeInvoiceModal}
                className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-bold hover:bg-gray-600"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
