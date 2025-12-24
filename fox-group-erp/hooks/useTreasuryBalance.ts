import { useMemo } from 'react';
import { Transaction, TransactionType, PaymentMethod, Customer, Supplier } from '../types';

interface UseTreasuryBalanceProps {
  transactions: Transaction[];
  customers: Customer[];
  suppliers: Supplier[];
  openingBalance: number;
}

export const useTreasuryBalance = ({
  transactions,
  customers,
  openingBalance
}: UseTreasuryBalanceProps) => {

  // Single optimized loop for both balance and summary
  const result = useMemo(() => {
    let currentBalance = openingBalance;
    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach(t => {
      if (t.paymentMethod === PaymentMethod.DEFERRED) return;
      if (t.status === 'pending' || t.status === 'rejected') return;

      switch (t.type) {
        case TransactionType.SALE:
        case TransactionType.CAPITAL:
          currentBalance += Number(t.amount);
          totalIncome += Number(t.amount);
          break;
        case TransactionType.PURCHASE:
        case TransactionType.EXPENSE:
        case TransactionType.WITHDRAWAL:
          currentBalance -= Number(t.amount);
          totalExpenses += Number(t.amount);
          break;
        case TransactionType.RETURN:
          const isCustomerReturn = customers.some(c => c.id === t.relatedId);
          if (isCustomerReturn) {
            currentBalance -= Number(t.amount);
            totalExpenses += Number(t.amount);
          } else {
            currentBalance += Number(t.amount);
            totalIncome += Number(t.amount);
          }
          break;
      }
    });

    return {
      balance: currentBalance,
      totalIncome,
      totalExpenses,
      netFlow: totalIncome - totalExpenses
    };
  }, [transactions, customers, openingBalance]);

  return result;
};

