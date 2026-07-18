import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, Database, KeyRound, Mail, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { isDatabaseEmpty, seedDatabase } from '../firebaseSeeder';
import { DEMO_USERS } from '../utils';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Seeding state
  const [showSeedButton, setShowSeedButton] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState('');

  useEffect(() => {
    async function checkDb() {
      const isEmpty = await isDatabaseEmpty();
      if (isEmpty) {
        setShowSeedButton(true);
      }
    }
    checkDb();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Proactively check for demo users to run instantly with zero console errors
    const matchedDemo = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );

    if (matchedDemo) {
      const fallbackUid = matchedDemo.role + '_uid';
      let finalUser: any = {
        id: fallbackUid,
        email: matchedDemo.email,
        role: matchedDemo.role,
        name: matchedDemo.name,
        phone: matchedDemo.phone,
        ...(matchedDemo.unit ? { unit: matchedDemo.unit } : {}),
      };

      try {
        // Try reading their Firestore-seeded profile
        const userDoc = await getDoc(doc(db, 'users', fallbackUid));
        if (userDoc.exists()) {
          finalUser = userDoc.data();
        }
      } catch (dbError) {
        console.warn('Could not read user profile from Firestore, falling back to static local info:', dbError);
      }

      localStorage.setItem('gatekeeper_local_user', JSON.stringify(finalUser));
      onLoginSuccess(finalUser);
      setLoading(false);
      return;
    }

    // 1.5 Check if there is an admin-created user in Firestore users collection (Fallback for custom accounts)
    if (password === 'password123') {
      try {
        const q = query(
          collection(db, 'users'),
          where('email', '==', email.trim().toLowerCase()),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          localStorage.setItem('gatekeeper_local_user', JSON.stringify(userData));
          onLoginSuccess(userData);
          setLoading(false);
          return;
        }
      } catch (dbError) {
        console.warn('Firestore query for user fallback failed:', dbError);
      }
    }

    // 2. Regular Firebase Auth Login
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      
      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, 'users', uid));
      let finalUser: any = null;
      if (userDoc.exists()) {
        finalUser = userDoc.data();
      } else {
        // Fallback or custom user
        finalUser = {
          id: uid,
          email: userCredential.user.email,
          role: 'gatekeeper', // Default to gatekeeper
          name: userCredential.user.email?.split('@')[0] || 'مستخدم',
        };
      }
      localStorage.setItem('gatekeeper_local_user', JSON.stringify(finalUser));
      onLoginSuccess(finalUser);
    } catch (err: any) {
      if (err.code === 'auth/configuration-not-found') {
        console.warn('Firebase Auth email/password provider is not enabled in the Firebase Console:', err);
      } else {
        console.error('Login error:', err);
      }
      
      let arabicError = 'فشل تسجيل الدخول. يرجى التحقق من البريد وكلمة المرور';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        arabicError = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (err.code === 'auth/network-request-failed') {
        arabicError = 'فشل الاتصال بالإنترنت. يرجى التحقق من اتصالك';
      } else if (err.code === 'auth/configuration-not-found') {
        arabicError = 'تنبيه: مزود تسجيل الدخول بالبريد غير مفعّل في كونسول Firebase. يرجى تفعيله، أو استخدام الحسابات التجريبية بالأسفل للدخول المحلي الفوري.';
      } else {
        arabicError = `خطأ: ${err.message || err.code || 'فشل تسجيل الدخول'}`;
      }
      setError(arabicError);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (confirm('هل أنت متأكد من رغبتك في بذر البيانات؟ سيقوم هذا بإنشاء الحسابات الافتراضية والبيانات التجريبية في قاعدة البيانات.')) {
      setSeeding(true);
      setError(null);
      try {
        await seedDatabase((msg) => setSeedProgress(msg));
        setShowSeedButton(false);
        alert('تم تأسيس قاعدة البيانات بنجاح! يمكنك الآن تجربة الدخول السريع.');
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء بذر البيانات');
      } finally {
        setSeeding(false);
        setSeedProgress('');
      }
    }
  };

  const selectDemoUser = (demo: typeof DEMO_USERS[0]) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'camp_leader': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'general_order_leader': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'unit_leader': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'gatekeeper': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'admin': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleNameArabic = (role: string) => {
    switch (role) {
      case 'camp_leader': return 'قائد المخيم';
      case 'general_order_leader': return 'قائد النظام العام';
      case 'unit_leader': return 'قائد وحدة';
      case 'gatekeeper': return 'البواب (الحراسة)';
      case 'admin': return 'قيادة المخيم (الإدارة)';
      default: return role;
    }
  };

  return (
    <div id="login-container" className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-900 text-slate-100 relative overflow-hidden">
      {/* Decorative ambient blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animate-blob animation-delay-2000"></div>

      <div className="sm:mx-auto w-full max-w-md z-10">
        <div className="flex justify-center mb-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="p-3 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-900/30 text-white"
          >
            <Sparkles className="w-12 h-12" />
          </motion.div>
        </div>
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-white mb-2">
          نظام التحكم بالبوابة
        </h2>
        <p className="text-center text-sm text-slate-400 font-medium">
          مخيم كشفي صيفي • Gate Control System
        </p>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mt-8 sm:mx-auto w-full max-w-md z-10 px-4"
      >
        <div className="bg-slate-800 py-8 px-6 shadow-2xl rounded-3xl border border-slate-700">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-xl bg-rose-950/40 border border-rose-800 p-4 text-sm text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                البريد الإلكتروني
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pr-10 pl-3 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  placeholder="name@camp.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                كلمة المرور
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pr-10 pl-3 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    تسجيل الدخول
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Database Empty Seeding Options */}
          {(showSeedButton || seeding) && (
            <div className="mt-6 pt-4 border-t border-slate-700/60">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-900/30 text-purple-300 border border-purple-800 hover:bg-purple-900/40 rounded-xl text-xs font-bold transition-all"
              >
                {seeding ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 text-purple-400" />
                    <span>{seedProgress}</span>
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    <span>تأسيس قاعدة البيانات وبذر الأفراد والحسابات</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Always allow manual seed if needed */}
          {!showSeedButton && !seeding && (
            <div className="text-center mt-4">
              <button 
                onClick={handleSeed}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline"
              >
                إعادة تهيئة وبذر قاعدة البيانات بالكامل
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
