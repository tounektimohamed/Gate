import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { SystemUser, UserRole } from './types';
import { motion } from 'motion/react';
import { 
  Shield, 
  LogOut, 
  UserCheck, 
  UserX, 
  Users, 
  Settings, 
  Radio, 
  Compass, 
  Sliders, 
  Loader2,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';

// Components
import Login from './components/Login';
import DashboardStats from './components/DashboardStats';
import GatekeeperDashboard from './components/GatekeeperDashboard';
import UnitLeaderDashboard from './components/UnitLeaderDashboard';
import CampLeaderDashboard from './components/CampLeaderDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [user, setUser] = useState<SystemUser | null>(() => {
    const localUserStr = localStorage.getItem('gatekeeper_local_user');
    if (localUserStr) {
      try {
        return JSON.parse(localUserStr) as SystemUser;
      } catch (e) {
        localStorage.removeItem('gatekeeper_local_user');
      }
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      // Check if we have a persistent local session fallback first
      const localUserStr = localStorage.getItem('gatekeeper_local_user');
      if (localUserStr) {
        try {
          const localUser = JSON.parse(localUserStr) as SystemUser;
          setUser(localUser);
          setAuthLoading(false);
          return; // Prevent Firebase null authUser from logging out the local fallback session
        } catch (e) {
          localStorage.removeItem('gatekeeper_local_user');
        }
      }

      if (authUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as SystemUser;
            setUser(userData);
          } else {
            // Fallback
            const fallbackUser: SystemUser = {
              id: authUser.uid,
              email: authUser.email || '',
              role: 'gatekeeper',
              name: authUser.email?.split('@')[0] || 'بواب',
            };
            setUser(fallbackUser);
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
          // Local fallback for offline/interrupted states
          const fallbackUser: SystemUser = {
            id: authUser.uid,
            email: authUser.email || '',
            role: 'gatekeeper',
            name: 'بواب',
          };
          setUser(fallbackUser);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = async () => {
    setAuthLoading(true);
    localStorage.removeItem('gatekeeper_local_user');
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error signing out:', e);
    }
    setUser(null);
    setShowLogoutConfirm(false);
    setAuthLoading(false);
  };

  const getRoleNameArabic = (role: UserRole) => {
    switch (role) {
      case 'camp_leader': return 'قائد المخيم العام';
      case 'general_order_leader': return 'قائد النظام العام';
      case 'unit_leader': return 'قائد وحدة (طلائع)';
      case 'gatekeeper': return 'البواب (نقطة الحراسة)';
      case 'admin': return 'قيادة المخيم (الإدارة)';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'camp_leader': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'general_order_leader': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'unit_leader': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'gatekeeper': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'admin': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const activeRole = user?.role || 'gatekeeper';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {authLoading ? (
        <div className="min-h-screen flex flex-col justify-center items-center bg-slate-900 text-slate-100 gap-4">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <span className="text-sm font-bold tracking-wider">جاري تهيئة الاتصال بقاعدة البيانات...</span>
        </div>
      ) : !user ? (
        <Login onLoginSuccess={(userData) => {
          setUser(userData);
        }} />
      ) : (
        <>
          {/* Main App Bar / Header */}
          <header className="bg-slate-900 text-white shadow-xl z-30 sticky top-0 border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                
                {/* Right: App Logo & Title */}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-md shadow-emerald-950/40">
                    <Compass className="w-6 h-6 animate-spin-slow" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                      نظام التحكم بالبوابة
                      <span className="text-[10px] font-bold py-0.5 px-1.5 bg-emerald-500/15 text-emerald-400 rounded-md border border-emerald-500/20 font-mono">
                        v1.0
                      </span>
                    </h1>
                    <span className="text-[10px] text-slate-400 font-medium block -mt-1 sm:inline">بوابة الحراسة الكشفية للمخيم الصيفي</span>
                  </div>
                </div>

                {/* Left: User Panel, Simulation & Logout */}
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Active user details */}
                  <div className="hidden md:flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-100">{user.name}</span>
                    <span className="text-[10px] text-slate-400">{user.email}</span>
                  </div>

                  <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border ${getRoleBadgeColor(activeRole)}`}>
                    {getRoleNameArabic(activeRole)}
                    {activeRole === 'unit_leader' && user.unit ? ` (${user.unit})` : ''}
                  </span>

                  {/* LOGOUT BUTTON */}
                  <button
                    onClick={handleLogout}
                    className="p-2 bg-slate-800 hover:bg-slate-700 hover:text-rose-400 text-slate-300 rounded-xl transition-all border border-slate-750"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-4.5 h-4.5" />
                  </button>
                </div>

              </div>
            </div>
          </header>

          {/* Main Content Stage */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            
            {/* Real-time Statistics Cards (Always visible on all dashboards for camp sync) */}
            <DashboardStats />

            {/* Render appropriate Dashboard view based on active role */}
            <motion.div
              key={activeRole}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activeRole === 'gatekeeper' && <GatekeeperDashboard currentUser={user} />}
              {activeRole === 'unit_leader' && <UnitLeaderDashboard currentUser={user} />}
              {activeRole === 'general_order_leader' && <CampLeaderDashboard currentUser={user} />}
              {activeRole === 'camp_leader' && <CampLeaderDashboard currentUser={user} />}
              {activeRole === 'admin' && <AdminDashboard />}
            </motion.div>

          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-12">
            <div className="max-w-7xl mx-auto px-4">
              نظام إدارة البوابة الذكي • Gate Control System © 2026 • جميع الحقوق محفوظة للمخيم الكشفي الصيفي
            </div>
          </footer>

          {/* Custom Logout Confirmation Modal */}
          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-right border border-slate-100"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mb-4 mx-auto">
                  <LogOut className="w-6 h-6" />
                </div>
                
                <h3 className="text-base font-black text-slate-900 text-center mb-2">
                  تأكيد تسجيل الخروج
                </h3>
                <p className="text-xs text-slate-500 text-center leading-relaxed mb-6">
                  هل أنت متأكد من رغبتك في تسجيل الخروج من نظام التحكم بالبوابة؟
                </p>

                <div className="flex gap-2.5">
                  <button
                    onClick={executeLogout}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-200"
                  >
                    نعم، تسجيل الخروج
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
