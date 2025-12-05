import apiClient from './api';
import type {
  Product,
  Customer,
  Supplier,
  Transaction,
  Shift,
  Quotation,
  AppSettings,
  User,
  ActivityLogEntry,
  PaymentMethod,
} from '../types';

export const productsAPI = {
  list: async (params?: { category?: string; search?: string }) => {
    const { offlineService } = await import('./offline');
    
    // If offline, return cached data
    if (!offlineService.getNetworkStatus()) {
      const cached = offlineService.getCachedData();
      let products = cached.products;
      
      // Apply filters if provided
      if (params?.category) {
        products = products.filter(p => p.category === params.category);
      }
      if (params?.search) {
        const search = params.search.toLowerCase();
        products = products.filter(p => 
          p.name.toLowerCase().includes(search) ||
          p.sku?.toLowerCase().includes(search) ||
          p.barcode?.toLowerCase().includes(search)
        );
      }
      
      return { data: products };
    }
    
    return apiClient.get<Product[]>('/products/', { params });
  },
  
  create: (data: Omit<Product, 'id'>) =>
    apiClient.post<Product>('/products/', data),
  
  update: (id: number, data: Partial<Product>) =>
    apiClient.put<Product>(`/products/${id}/`, data),
  
  delete: async (id: number) => {
    const { offlineService } = await import('./offline');
    
    // Prevent delete when offline
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن حذف المنتجات في وضع عدم الاتصال');
    }
    
    return apiClient.delete(`/products/${id}/`);
  },
  
  adjustStock: (id: number, data: { quantity_diff: number; reason: string }) =>
    apiClient.post(`/products/${id}/adjust_stock/`, data),
};

export const customersAPI = {
  list: async () => {
    const { offlineService } = await import('./offline');
    
    // If offline, return cached data
    if (!offlineService.getNetworkStatus()) {
      const cached = offlineService.getCachedData();
      return { data: cached.customers };
    }
    
    return apiClient.get<Customer[]>('/customers/');
  },
  
  create: (data: Omit<Customer, 'id' | 'balance'>) =>
    apiClient.post<Customer>('/customers/', data),
  
  update: (id: number, data: Partial<Customer>) =>
    apiClient.put<Customer>(`/customers/${id}/`, data),
  
  delete: async (id: number) => {
    const { offlineService } = await import('./offline');
    
    // Prevent delete when offline
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن حذف العملاء في وضع عدم الاتصال');
    }
    
    return apiClient.delete(`/customers/${id}/`);
  },
  
  settleDebt: async (id: number, data: { amount: number; payment_method: PaymentMethod }) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      offlineService.addToQueue('debt_settlement', { entityType: 'customer', entityId: id, ...data });
      return { data: { success: true, message: 'تم إضافة العملية للمزامنة' } };
    }
    
    return apiClient.post(`/customers/${id}/settle_debt/`, data);
  },
};

export const suppliersAPI = {
  list: async () => {
    const { offlineService } = await import('./offline');
    
    // If offline, return cached data
    if (!offlineService.getNetworkStatus()) {
      const cached = offlineService.getCachedData();
      return { data: cached.suppliers };
    }
    
    return apiClient.get<Supplier[]>('/suppliers/');
  },
  
  create: (data: Omit<Supplier, 'id' | 'balance'>) =>
    apiClient.post<Supplier>('/suppliers/', data),
  
  update: (id: number, data: Partial<Supplier>) =>
    apiClient.put<Supplier>(`/suppliers/${id}/`, data),
  
  delete: async (id: number) => {
    const { offlineService } = await import('./offline');
    
    // Prevent delete when offline
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن حذف الموردين في وضع عدم الاتصال');
    }
    
    return apiClient.delete(`/suppliers/${id}/`);
  },
  
  settleDebt: async (id: number, data: { amount: number; payment_method: PaymentMethod }) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      offlineService.addToQueue('debt_settlement', { entityType: 'supplier', entityId: id, ...data });
      return { data: { success: true, message: 'تم إضافة العملية للمزامنة' } };
    }
    
    return apiClient.post(`/suppliers/${id}/settle_debt/`, data);
  },
};

interface SaleRequest {
  customer_id: number;
  payment_method: PaymentMethod;
  items: Array<{
    id: number;
    quantity: number;
    price: number;
    discount: number;
  }>;
  total_amount: number;
  invoice_id?: string;
  is_direct_sale?: boolean;
}

interface PurchaseRequest {
  supplier_id: number;
  payment_method: PaymentMethod;
  items: Array<{
    id: number;
    quantity: number;
    cost_price: number;
  }>;
  total_amount: number;
}

interface ExpenseRequest {
  amount: number;
  category: string;
  description: string;
  payment_method: PaymentMethod;
}

interface CapitalRequest {
  amount: number;
  description: string;
}

interface WithdrawalRequest {
  amount: number;
  description: string;
}

export const transactionsAPI = {
  list: (params?: {
    type?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    shift_id?: number;
    customer_id?: number;
    supplier_id?: number;
  }) =>
    apiClient.get<Transaction[]>('/transactions/', { params }),
  
  createSale: async (data: SaleRequest) => {
    const { offlineService } = await import('./offline');
    
    // Check if online
    if (!offlineService.getNetworkStatus()) {
      // Queue for offline sync
      offlineService.addToQueue('sale', data);
      
      // Return a mock response for UI
      return {
        data: {
          id: `offline_${Date.now()}`,
          type: 'بيع',
          date: new Date().toISOString(),
          amount: data.total_amount,
          paymentMethod: data.payment_method,
          description: 'فاتورة بيع (في انتظار المزامنة)',
          status: 'pending_sync',
          relatedId: data.customer_id,
        } as unknown as Transaction
      };
    }
    
    return apiClient.post<Transaction>('/transactions/create_sale/', data);
  },
  
  createPurchase: async (data: PurchaseRequest) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      offlineService.addToQueue('purchase', data);
      return {
        data: {
          id: `offline_${Date.now()}`,
          type: 'شراء',
          date: new Date().toISOString(),
          amount: data.total_amount,
          paymentMethod: data.payment_method,
          description: 'فاتورة شراء (في انتظار المزامنة)',
          status: 'pending_sync',
          relatedId: data.supplier_id,
        } as unknown as Transaction
      };
    }
    
    return apiClient.post<Transaction>('/transactions/create_purchase/', data);
  },
  
  createExpense: async (data: ExpenseRequest) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      offlineService.addToQueue('expense', data);
      return {
        data: {
          id: `offline_${Date.now()}`,
          type: 'مصروف',
          date: new Date().toISOString(),
          amount: data.amount,
          paymentMethod: data.payment_method,
          description: data.description,
          category: data.category,
          status: 'pending_sync',
        } as unknown as Transaction
      };
    }
    
    return apiClient.post<Transaction>('/transactions/create_expense/', data);
  },
  
  createCapital: async (data: CapitalRequest) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      offlineService.addToQueue('capital', data);
      return {
        data: {
          id: `offline_${Date.now()}`,
          type: 'إيداع رأس مال',
          date: new Date().toISOString(),
          amount: data.amount,
          paymentMethod: 'كاش' as PaymentMethod,
          description: data.description,
          status: 'pending_sync',
        } as unknown as Transaction
      };
    }
    
    return apiClient.post<Transaction>('/transactions/create_capital/', data);
  },
  
  createWithdrawal: async (data: WithdrawalRequest) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      offlineService.addToQueue('withdrawal', data);
      return {
        data: {
          id: `offline_${Date.now()}`,
          type: 'مسحوبات',
          date: new Date().toISOString(),
          amount: data.amount,
          paymentMethod: 'كاش' as PaymentMethod,
          description: data.description,
          status: 'pending_sync',
        } as unknown as Transaction
      };
    }
    
    return apiClient.post<Transaction>('/transactions/create_withdrawal/', data);
  },
  
  approve: (id: string) =>
    apiClient.put(`/transactions/${id}/approve/`),
  
  reject: (id: string) =>
    apiClient.put(`/transactions/${id}/reject/`),
  
  return: (id: string) =>
    apiClient.post(`/transactions/${id}/process_return/`),
};

export const shiftsAPI = {
  list: () =>
    apiClient.get<Shift[]>('/shifts/'),
  
  open: (startCash: number) =>
    apiClient.post<Shift>('/shifts/open/', { start_cash: startCash }),
  
  close: (id: number, endCash: number) =>
    apiClient.post<Shift>(`/shifts/${id}/close/`, { end_cash: endCash }),
};

export const quotationsAPI = {
  list: (params?: { status?: string; customer_id?: number }) =>
    apiClient.get<Quotation[]>('/quotations/', { params }),
  
  create: (data: {
    customer_id: number;
    items: Array<{
      id: number;
      quantity: number;
      price: number;
      discount: number;
    }>;
    total_amount: number;
  }) =>
    apiClient.post<Quotation>('/quotations/', data),
  
  convert: (id: string, data: { payment_method: PaymentMethod }) =>
    apiClient.post<Transaction>(`/quotations/${id}/convert/`, data),
  
  delete: (id: string) =>
    apiClient.delete(`/quotations/${id}/`),
};

export const settingsAPI = {
  get: () =>
    apiClient.get<AppSettings>('/settings/'),
  
  update: (data: Partial<AppSettings>) =>
    apiClient.put<AppSettings>('/settings/', data),
};

export const usersAPI = {
  list: () =>
    apiClient.get<User[]>('/users/'),
  
  create: async (data: { username: string; password: string; name: string; role: string }) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن إضافة مستخدمين في وضع عدم الاتصال');
    }
    
    return apiClient.post<User>('/users/', data);
  },
  
  delete: async (id: number) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن حذف مستخدمين في وضع عدم الاتصال');
    }
    
    return apiClient.delete(`/users/${id}/`);
  },
  
  changePassword: (data: { old_password: string; new_password: string }) =>
    apiClient.put('/users/me/change_password/', data),
};

export const activityLogAPI = {
  list: (params?: { from_date?: string; to_date?: string; user_id?: number }) =>
    apiClient.get<ActivityLogEntry[]>('/activity-logs/', { params }),
};

interface ReportParams {
  from_date?: string;
  to_date?: string;
}

export const reportsAPI = {
  sales: (params?: ReportParams) =>
    apiClient.get('/reports/sales/', { params }),
  
  inventory: () =>
    apiClient.get('/reports/inventory/'),
  
  treasury: (params?: ReportParams) =>
    apiClient.get('/reports/treasury/', { params }),
  
  debts: () =>
    apiClient.get('/reports/debts/'),
  
  profitLoss: (params?: ReportParams) =>
    apiClient.get('/reports/profit_loss/', { params }),
};

export const systemAPI = {
  backup: async () => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن إنشاء نسخة احتياطية في وضع عدم الاتصال');
    }
    
    return apiClient.post('/system/backup/', {}, { responseType: 'blob' });
  },
  
  restore: async (file: File) => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن استعادة النسخة الاحتياطية في وضع عدم الاتصال');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/system/restore/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  clearTransactions: async () => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن مسح المعاملات في وضع عدم الاتصال');
    }
    
    return apiClient.post('/system/clear_transactions/');
  },
  
  factoryReset: async () => {
    const { offlineService } = await import('./offline');
    
    if (!offlineService.getNetworkStatus()) {
      throw new Error('لا يمكن إعادة ضبط المصنع في وضع عدم الاتصال');
    }
    
    return apiClient.post('/system/factory_reset/');
  },
};

export const authAPI = {
  login: (username: string, password: string) =>
    apiClient.post<{ access: string; refresh: string; user: User }>('/auth/login/', {
      username,
      password,
    }),
  
  logout: () =>
    apiClient.post('/auth/logout/'),
};
