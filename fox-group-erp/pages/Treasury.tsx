import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Customer, Supplier, AppSettings, User } from '../types';
import { ArrowDownLeft, ArrowUpRight, Wallet, Download, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';

// Sort types
type SortField = 'id' | 'date' | 'type' | 'amount' | 'description' | 'status';
type SortDirection = 'asc' | 'desc';
import { ExpenseModal } from '../components/treasury/ExpenseModal';
import { CapitalModal } from '../components/treasury/CapitalModal';
import { TransactionsList } from '../components/treasury/TransactionsList';
import { useTreasuryBalance } from '../hooks/useTreasuryBalance';
import { transactionsAPI } from '../services/endpoints';
import { handleAPIError } from '../services/errorHandler';
import { Modal } from '../components/Modal';

interface TreasuryProps {
  transactions: Transaction[];
  customers: Customer[];
  suppliers: Supplier[];
  onAddExpense: (amount: number, description: string, category: string) => void;
  onReturnTransaction?: (transaction: Transaction) => void;
  onDebtSettlement?: (type: 'customer' | 'supplier', id: number, amount: number, notes: string) => void;
  settings?: AppSettings;
  currentUser: User;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCapitalTransaction: (type: 'deposit' | 'withdrawal', amount: number, description: string) => void;
  onDataChange?: () => void;
}

const Treasury: React.FC<TreasuryProps> = ({ 
  transactions, 
  customers, 
  suppliers, 
  onAddExpense, 
  settings, 
  currentUser, 
  onApprove, 
  onReject, 
  onCapitalTransaction,
  onDataChange
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Filter State - Default to last month
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Details Modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ 
    amount: '', 
    description: '', 
    category: 'مصروفات تشغيلية' 
  });

  // Capital Modal
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [capitalType, setCapitalType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [capitalForm, setCapitalForm] = useState({ amount: '', description: '' });

  // Expense Categories
  const expenseCategories = [
    'مصروفات تشغيلية',
    'إيجار',
    'رواتب وأجور',
    'كهرباء ومياه',
    'نقل ومشال',
    'دعاية وإعلان',
    'صيانة',
    'نثريات',
    'أخرى'
  ];

  // Calculate treasury balance
  const { balance, totalIncome, totalExpenses, netFlow } = useTreasuryBalance({
    transactions,
    customers,
    suppliers,
    openingBalance: settings?.openingBalance || 50000
  });

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col ml-1">
      <ChevronUp 
        size={12} 
        className={`-mb-1 ${sortField === field && sortDirection === 'asc' ? 'text-fox-400' : 'text-gray-600'}`} 
      />
      <ChevronDown 
        size={12} 
        className={`${sortField === field && sortDirection === 'desc' ? 'text-fox-400' : 'text-gray-600'}`} 
      />
    </span>
  );

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    // First filter
    const filtered = transactions.filter(t => {
      const tDate = t.date.split('T')[0];
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      return true;
    });

    // Then sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'id':
          comparison = String(a.id).localeCompare(String(b.id), 'ar');
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type, 'ar');
          break;
        case 'amount':
          comparison = Number(a.amount) - Number(b.amount);
          break;
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '', 'ar');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '', 'ar');
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [transactions, startDate, endDate, typeFilter, sortField, sortDirection]);

  const pendingTransactions = transactions.filter(t => t.status === 'pending');

  const handleAddExpense = () => {
    onAddExpense(
      Number(expenseForm.amount),
      expenseForm.description,
      expenseForm.category
    );
    setExpenseForm({ amount: '', description: '', category: 'مصروفات تشغيلية' });
    setIsExpenseModalOpen(false);
  };

  const handleCapitalTransaction = () => {
    onCapitalTransaction(
      capitalType,
      Number(capitalForm.amount),
      capitalForm.description
    );
    setCapitalForm({ amount: '', description: '' });
    setIsCapitalModalOpen(false);
  };

  const handleReturnTransaction = async (transaction: Transaction) => {
    setLoading(true);
    try {
      await transactionsAPI.return(transaction.id.toString());
      alert('تم تسجيل المرتجع وتحديث الحسابات بنجاح');
      onDataChange?.();
    } catch (err: any) {
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransaction = async (id: string) => {
    setLoading(true);
    try {
      await transactionsAPI.approve(id);
      alert('تمت الموافقة على المعاملة بنجاح');
      onDataChange?.();
    } catch (err: any) {
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTransaction = async (id: string) => {
    setLoading(true);
    try {
      await transactionsAPI.reject(id);
      alert('تم رفض المعاملة');
      onDataChange?.();
    } catch (err: any) {
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Balance */}
      <div className="bg-gradient-to-r from-dark-950 to-dark-900 rounded-xl border border-dark-800 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-right">
            <p className="text-gray-400 text-sm mb-1">رصيد الخزينة الحالي</p>
            <h1 className="text-4xl font-bold text-white mb-2">
              {balance.toLocaleString()} <span className="text-xl text-gray-500">ج.م</span>
            </h1>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400">
                إيرادات: {totalIncome.toLocaleString()}
              </span>
              <span className="text-red-400">
                مصروفات: {totalExpenses.toLocaleString()}
              </span>
              <span className={netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                صافي: {netFlow.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-lg font-bold hover:bg-red-500/20 border border-red-500/30"
            >
              <ArrowUpRight size={20} />
              مصروف
            </button>
            <button
              onClick={() => {
                setCapitalType('deposit');
                setIsCapitalModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg font-bold hover:bg-emerald-500/20 border border-emerald-500/30"
            >
              <ArrowDownLeft size={20} />
              إيداع
            </button>
            <button
              onClick={() => {
                setCapitalType('withdrawal');
                setIsCapitalModalOpen(true);
              }}
              className="flex items-center gap-2 bg-purple-500/10 text-purple-400 px-4 py-2 rounded-lg font-bold hover:bg-purple-500/20 border border-purple-500/30"
            >
              <Wallet size={20} />
              سحب
            </button>
          </div>
        </div>
      </div>

      {/* Pending Transactions Alert */}
      {pendingTransactions.length > 0 && currentUser.role === 'admin' && (
        <div className="bg-yellow-900/20 border border-yellow-900/30 rounded-lg p-4">
          <p className="text-yellow-400 font-bold">
            يوجد {pendingTransactions.length} معاملة معلقة تحتاج موافقة
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-dark-950 rounded-xl border border-dark-800 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={20} className="text-gray-500" />
          
          {/* Type Filter Dropdown */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-dark-900 border border-dark-700 text-white px-4 py-2 rounded-lg focus:border-fox-500 outline-none appearance-none pr-10 min-w-[150px]"
            >
              <option value="all">كل الأنواع</option>
              <option value={TransactionType.SALE}>مبيعات</option>
              <option value={TransactionType.PURCHASE}>مشتريات</option>
              <option value={TransactionType.EXPENSE}>مصروفات</option>
              <option value={TransactionType.RETURN}>مرتجعات</option>
              <option value={TransactionType.CAPITAL}>رأس مال</option>
              <option value={TransactionType.WITHDRAWAL}>سحب</option>
              <option value={TransactionType.ADJUSTMENT}>تسوية</option>
            </select>
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg focus:border-fox-500 outline-none"
          />
          <span className="text-gray-500">إلى</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded-lg focus:border-fox-500 outline-none"
          />
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setTypeFilter('all');
            }}
            className="text-gray-400 hover:text-white text-sm"
          >
            مسح الفلتر
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-dark-950 rounded-xl border border-dark-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">سجل المعاملات</h2>
          <span className="text-sm text-gray-400">عدد النتائج: {filteredAndSortedTransactions.length}</span>
        </div>
        
        {/* Sortable Table Headers */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-dark-900 text-gray-400">
              <tr>
                <th className="p-3 cursor-pointer hover:text-fox-400 select-none" onClick={() => handleSort('id')}>
                  <span className="flex items-center">ID <SortIcon field="id" /></span>
                </th>
                <th className="p-3 cursor-pointer hover:text-fox-400 select-none" onClick={() => handleSort('date')}>
                  <span className="flex items-center">التاريخ <SortIcon field="date" /></span>
                </th>
                <th className="p-3 cursor-pointer hover:text-fox-400 select-none" onClick={() => handleSort('type')}>
                  <span className="flex items-center">النوع <SortIcon field="type" /></span>
                </th>
                <th className="p-3 cursor-pointer hover:text-fox-400 select-none" onClick={() => handleSort('amount')}>
                  <span className="flex items-center">المبلغ <SortIcon field="amount" /></span>
                </th>
                <th className="p-3 cursor-pointer hover:text-fox-400 select-none" onClick={() => handleSort('description')}>
                  <span className="flex items-center">الوصف <SortIcon field="description" /></span>
                </th>
                <th className="p-3 cursor-pointer hover:text-fox-400 select-none" onClick={() => handleSort('status')}>
                  <span className="flex items-center">الحالة <SortIcon field="status" /></span>
                </th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
          </table>
        </div>
        
        <TransactionsList
          transactions={filteredAndSortedTransactions}
          currentUser={currentUser}
          onViewDetails={(t) => {
            setSelectedTransaction(t);
            setIsDetailsModalOpen(true);
          }}
          onApprove={handleApproveTransaction}
          onReject={handleRejectTransaction}
          onReturn={handleReturnTransaction}
        />
      </div>

      {/* Modals */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSubmit={handleAddExpense}
        formData={expenseForm}
        onFormChange={(field, value) => setExpenseForm(prev => ({ ...prev, [field]: value }))}
        categories={expenseCategories}
      />

      <CapitalModal
        isOpen={isCapitalModalOpen}
        onClose={() => setIsCapitalModalOpen(false)}
        onSubmit={handleCapitalTransaction}
        type={capitalType}
        onTypeChange={setCapitalType}
        formData={capitalForm}
        onFormChange={(field, value) => setCapitalForm(prev => ({ ...prev, [field]: value }))}
      />

      {/* Transaction Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedTransaction(null);
        }}
        title="تفاصيل المعاملة"
      >
        {selectedTransaction && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">رقم المعاملة</p>
                <p className="text-white font-mono">#{selectedTransaction.id}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">التاريخ</p>
                <p className="text-white">{new Date(selectedTransaction.date).toLocaleString('ar-EG')}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">النوع</p>
                <p className="text-white">{
                  selectedTransaction.type === TransactionType.SALE ? 'مبيعات' :
                  selectedTransaction.type === TransactionType.PURCHASE ? 'مشتريات' :
                  selectedTransaction.type === TransactionType.EXPENSE ? 'مصروف' :
                  selectedTransaction.type === TransactionType.RETURN ? 'مرتجع' :
                  selectedTransaction.type === TransactionType.CAPITAL ? 'رأس مال' :
                  selectedTransaction.type === TransactionType.WITHDRAWAL ? 'سحب' :
                  selectedTransaction.type === TransactionType.ADJUSTMENT ? 'تسوية' : selectedTransaction.type
                }</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">المبلغ</p>
                <p className="text-white font-bold">{selectedTransaction.amount.toLocaleString()} ج.م</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">طريقة الدفع</p>
                <p className="text-white">{selectedTransaction.paymentMethod}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">الحالة</p>
                <p className={`font-bold ${
                  selectedTransaction.status === 'completed' ? 'text-emerald-400' :
                  selectedTransaction.status === 'pending' ? 'text-yellow-400' :
                  selectedTransaction.status === 'rejected' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {selectedTransaction.status === 'completed' ? 'مكتمل' :
                   selectedTransaction.status === 'pending' ? 'معلق' :
                   selectedTransaction.status === 'rejected' ? 'مرفوض' : selectedTransaction.status}
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-gray-400 text-sm">الوصف</p>
              <p className="text-white">{selectedTransaction.description || '-'}</p>
            </div>

            {selectedTransaction.category && (
              <div>
                <p className="text-gray-400 text-sm">التصنيف</p>
                <p className="text-white">{selectedTransaction.category}</p>
              </div>
            )}

            {selectedTransaction.items && selectedTransaction.items.length > 0 && (
              <div>
                <p className="text-gray-400 text-sm mb-2">الأصناف</p>
                <div className="bg-dark-900 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-800 text-gray-400">
                      <tr>
                        <th className="p-2 text-right">الصنف</th>
                        <th className="p-2 text-center">الكمية</th>
                        <th className="p-2 text-left">السعر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {selectedTransaction.items.map((item, idx) => (
                        <tr key={idx} className="text-white">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-center">{item.cartQuantity}</td>
                          <td className="p-2 text-left">{item.sellPrice?.toLocaleString()} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-dark-700">
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedTransaction(null);
                }}
                className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Treasury;
