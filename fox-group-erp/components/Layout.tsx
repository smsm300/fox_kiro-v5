
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Wallet,
  FileText,
  Menu,
  LogOut,
  Bell,
  ShoppingBag,
  ClipboardList,
  Settings,
  AlertTriangle,
  UserCog,
  Lock,
  Key,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff
} from 'lucide-react';
import { APP_SECTIONS } from '../constants';
import { Product, User, AppSettings } from '../types';
import { Modal } from './Modal';
import Logo from './Logo';
import { offlineService } from '../services/offline';

interface LayoutProps {
  currentSection: string;
  onNavigate: (section: string) => void;
  children: React.ReactNode;
  alertsCount?: number;
  lowStockItems?: Product[];
  currentUser?: User;
  onLogout: () => void;
  onChangePassword?: (newPassword: string) => void;
  settings?: AppSettings;
}

const Layout: React.FC<LayoutProps> = ({
  currentSection,
  onNavigate,
  children,
  alertsCount = 0,
  lowStockItems = [],
  currentUser,
  onLogout,
  onChangePassword,
  settings
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Network Status
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Setup network listener
    const handleNetworkChange = (online: boolean) => {
      setIsOnline(online);
      if (online) {
        // Update pending count after sync
        setTimeout(() => {
          setPendingCount(offlineService.getPendingCount());
        }, 1000);
      }
    };

    offlineService.addNetworkListener(handleNetworkChange);

    // Initial status
    setIsOnline(offlineService.getNetworkStatus());
    setPendingCount(offlineService.getPendingCount());

    return () => {
      offlineService.removeNetworkListener(handleNetworkChange);
    };
  }, []);

  // Full Menu
  const allMenuItems = [
    { id: APP_SECTIONS.DASHBOARD, label: 'الرئيسية', icon: LayoutDashboard, roles: ['admin', 'accountant', 'cashier', 'stock_keeper'] },
    { id: APP_SECTIONS.SALES, label: 'نقطة البيع', icon: ShoppingCart, roles: ['admin', 'cashier'] },
    { id: APP_SECTIONS.PURCHASES, label: 'المشتريات', icon: ShoppingBag, roles: ['admin', 'accountant', 'stock_keeper'] },
    { id: APP_SECTIONS.INVENTORY, label: 'المخزون', icon: Package, roles: ['admin', 'stock_keeper'] },
    { id: APP_SECTIONS.QUOTATIONS, label: 'عروض الأسعار', icon: ClipboardList, roles: ['admin', 'cashier'] },
    { id: APP_SECTIONS.INVOICES, label: 'الفواتير', icon: FileText, roles: ['admin', 'accountant', 'cashier'] },
    { id: APP_SECTIONS.CUSTOMERS, label: 'العملاء', icon: Users, roles: ['admin', 'accountant', 'cashier'] },
    { id: APP_SECTIONS.SUPPLIERS, label: 'الموردين', icon: Truck, roles: ['admin', 'accountant'] },
    { id: APP_SECTIONS.TREASURY, label: 'الخزينة', icon: Wallet, roles: ['admin', 'accountant'] },
    { id: APP_SECTIONS.REPORTS, label: 'التقارير', icon: FileText, roles: ['admin', 'accountant'] },
    { id: APP_SECTIONS.USERS, label: 'المستخدمين', icon: UserCog, roles: ['admin'] },
    { id: APP_SECTIONS.SETTINGS, label: 'الإعدادات', icon: Settings, roles: ['admin'] },
  ];

  // Filter Menu based on Role
  const menuItems = allMenuItems.filter(item =>
    currentUser ? item.roles.includes(currentUser.role) : false
  );

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && onChangePassword) {
      onChangePassword(newPassword);
      setNewPassword('');
      setIsPasswordModalOpen(false);
      alert('تم تحديث كلمة المرور بنجاح');
    }
  };

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? 'w-64' : 'w-20'
          } bg-dark-950 border-l border-dark-800 transition-all duration-300 flex flex-col z-20 shadow-2xl relative`}
      >
        <div className="h-24 flex items-center justify-center border-b border-dark-800 relative bg-black/40">
          {isSidebarOpen ? (
            <div className="flex flex-col items-center justify-center w-full px-4 h-full py-2">
              <Logo src={settings?.logoUrl} height={64} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-fox-500 flex items-center justify-center neon-border shadow-lg shadow-fox-500/30">
              <span className="font-bold text-white text-xl">F</span>
            </div>
          )}

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-2 left-2 p-1 rounded-md hover:bg-dark-800 text-gray-500 hover:text-fox-500 transition-colors z-10"
          >
            <Menu size={16} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center px-4 py-3 transition-all duration-200 border-r-4 ${isActive
                    ? 'border-fox-500 bg-gradient-to-l from-fox-900/20 to-transparent text-fox-400'
                    : 'border-transparent hover:bg-dark-800 text-gray-400 hover:text-gray-200'
                  }`}
              >
                <Icon
                  size={22}
                  className={`${isActive ? 'text-fox-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]' : ''}`}
                />
                {isSidebarOpen && (
                  <span className={`mr-4 font-medium text-sm ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                )}
                {!isSidebarOpen && item.id === APP_SECTIONS.INVENTORY && alertsCount > 0 && (
                  <span className="absolute left-2 top-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-dark-950"></span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-dark-800 bg-dark-950/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center px-4 py-2 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="mr-2 text-sm font-bold">تسجيل خروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900/50">
        {/* Header */}
        <header className="h-16 bg-dark-950/80 backdrop-blur-md border-b border-dark-800 flex items-center justify-between px-6 z-10">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <Logo src={settings?.logoUrl} height={24} className="hidden sm:block" />
            <span className="w-2 h-6 bg-fox-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>
            {menuItems.find(i => i.id === currentSection)?.label}
          </h2>
          <div className="flex items-center gap-4">
            {/* Network Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isOnline
                ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                : 'bg-red-900/30 text-red-400 border border-red-700/30 animate-pulse'
              }`}>
              {isOnline ? (
                <>
                  <Wifi size={14} />
                  <span>متصل</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} />
                  <span>غير متصل</span>
                  {pendingCount > 0 && (
                    <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
            </div>
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 rounded-full hover:bg-dark-800 transition-colors focus:outline-none group"
              >
                <Bell size={20} className="text-gray-400 group-hover:text-fox-500 transition-colors" />
                {alertsCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white animate-pulse">
                    {alertsCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-dark-950 border border-dark-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                  <div className="p-3 border-b border-dark-800 bg-dark-900 flex justify-between items-center">
                    <h3 className="font-bold text-gray-200">التنبيهات</h3>
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{alertsCount}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {lowStockItems.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">لا توجد تنبيهات جديدة</div>
                    ) : (
                      lowStockItems.map(item => (
                        <div key={item.id} className="p-3 border-b border-dark-800 hover:bg-dark-800/50 flex gap-3 cursor-pointer" onClick={() => onNavigate(APP_SECTIONS.INVENTORY)}>
                          <div className="mt-1">
                            <AlertTriangle size={16} className="text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-300 font-medium">{item.name}</p>
                            <p className="text-xs text-red-400">الكمية الحالية: {item.quantity} (الحد الأدنى: {item.minStockAlert})</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Trigger */}
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center gap-3 bg-dark-800/50 pl-4 pr-1 py-1 rounded-full border border-dark-700/50 hover:border-fox-500/30 transition-colors cursor-pointer group"
              title="تغيير كلمة المرور"
            >
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-gray-200 group-hover:text-fox-400 transition-colors">{currentUser?.name || 'Guest'}</span>
                <span className="text-[10px] text-fox-500 uppercase tracking-wider">{currentUser?.role || 'Viewer'}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fox-500 to-fox-700 flex items-center justify-center text-xs font-bold uppercase text-white shadow-lg shadow-fox-500/20 border border-fox-400/20">
                {currentUser?.username?.substring(0, 2) || 'GS'}
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 pb-14 relative custom-scrollbar">
          {children}
        </div>

        <footer className="h-10 bg-dark-950/80 border-t border-dark-800 flex items-center justify-center px-6 flex-shrink-0">
          <span className="text-xs text-gray-400">تم التطوير بواسطة <span className="text-accent-500 font-semibold">CairoCode</span></span>
        </footer>

        {/* Change Password Modal */}
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          title="تغيير كلمة المرور"
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="flex items-center justify-center mb-4 text-fox-500">
              <div className="p-4 rounded-full bg-fox-500/10 border border-fox-500/20">
                <Lock size={32} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">كلمة المرور الجديدة</label>
              <div className="relative">
                <Key className="absolute right-3 top-2.5 text-gray-500" size={16} />
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full bg-dark-900 border border-dark-700 text-white pr-10 pl-3 py-2 rounded-lg focus:border-fox-500 focus:outline-none"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="******"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-fox-600 hover:bg-fox-500 text-white py-2.5 rounded-lg font-bold mt-2">
              تحديث كلمة المرور
            </button>
          </form>
        </Modal>

      </main>
    </div>
  );
};

export default Layout;
