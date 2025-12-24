
import React, { useState } from 'react';
import { Lock, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { authAPI } from '../services/endpoints';
import Logo from '../components/Logo';
import { handleAPIError } from '../services/errorHandler';
import LoadingButton from '../components/LoadingButton';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const settings = INITIAL_SETTINGS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(username, password);

      localStorage.setItem('token', response.data.access);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      onLogin(response.data.user);
    } catch (err: any) {
      setError(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Effects matching Fox Group Theme */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-fox-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-600/10 rounded-full blur-[120px]"></div>

      <div className="bg-dark-900/80 backdrop-blur-xl border border-fox-500/20 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="h-40 w-full flex items-center justify-center relative p-4 rounded-xl">
              <Logo src={settings.logoUrl} height={160} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-wider neon-text uppercase font-sans">FOX GROUP</h1>
          <p className="text-fox-500/80 text-sm font-medium">نظام إدارة المبيعات والمخزون المتكامل</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-400 text-sm mb-1">اسم المستخدم</label>
            <div className="relative group">
              <UserIcon className="absolute right-3 top-3 text-gray-500 group-focus-within:text-fox-500 transition-colors" size={20} />
              <input
                type="text"
                className="w-full bg-dark-950 border border-dark-700 text-white pr-10 pl-4 py-3 rounded-lg focus:border-fox-500 focus:outline-none transition-all focus:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                placeholder="ادخل اسم المستخدم"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">كلمة المرور</label>
            <div className="relative group">
              <Lock className="absolute right-3 top-3 text-gray-500 group-focus-within:text-fox-500 transition-colors" size={20} />
              <input
                type="password"
                className="w-full bg-dark-950 border border-dark-700 text-white pr-10 pl-4 py-3 rounded-lg focus:border-fox-500 focus:outline-none transition-all focus:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/10 p-3 rounded border border-red-500/20 text-center animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <LoadingButton
            type="submit"
            isLoading={loading}
            loadingText="جاري تسجيل الدخول..."
            className="w-full bg-gradient-to-r from-fox-600 to-fox-500 hover:from-fox-500 hover:to-fox-400 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-fox-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-4"
          >
            تسجيل الدخول
          </LoadingButton>
        </form>

        <div className="mt-8 text-center border-t border-dark-800 pt-4">
          <p className="text-xs text-gray-500">Fox Group ERP v1.0.0 &copy; 2025</p>
          <p className="text-xs text-gray-400 mt-1">تم التطوير بواسطة <span className="text-accent-500 font-semibold">CairoCode</span></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
