import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc, 
  setDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  UserPlus, 
  Trash2, 
  Edit, 
  Users, 
  ShieldCheck, 
  Key, 
  Calendar, 
  UserCheck, 
  AlertCircle,
  Plus,
  RefreshCw,
  Eye,
  Check,
  X
} from 'lucide-react';
import { db } from '../firebase';
import { Individual, SystemUser, UnitType, UserRole } from '../types';
import { classifyUnit, generatePinCode, calculateAge } from '../utils';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  // Individual Form States
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('2014-01-01');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  
  // System User Form States
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('unit_leader');
  const [userUnit, setUserUnit] = useState<UnitType>('كشافة');
  const [userPhone, setUserPhone] = useState('');

  // Editing state
  const [editingIndividualId, setEditingIndividualId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female'>('male');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active view filters
  const [activeUnitTab, setActiveUnitTab] = useState<string>('all');

  useEffect(() => {
    // 1. Get individuals list
    const unsubInd = onSnapshot(collection(db, 'individuals'), (snapshot) => {
      const list: Individual[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Individual);
      });
      // Sort alphabetically by name
      list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
      setIndividuals(list);
    });

    // 2. Get system users list
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: SystemUser[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SystemUser);
      });
      setSystemUsers(list);
    });

    return () => {
      unsubInd();
      unsubUsers();
    };
  }, []);

  // Add individual
  const handleAddIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!fullName.trim() || !birthDate) {
      setError('الرجاء تعبئة اسم الفرد وتاريخ ميلاده');
      return;
    }

    setLoading(true);

    try {
      // 1. Generate unique pin
      const existingPins = individuals.map(i => i.pinCode);
      const pinCode = generatePinCode(existingPins);

      // 2. Calculate Unit dynamically
      const unit = classifyUnit(birthDate, gender);

      // 3. Save to database
      await addDoc(collection(db, 'individuals'), {
        fullName: fullName.trim(),
        birthDate: birthDate,
        gender: gender,
        unit: unit,
        pinCode: pinCode,
        status: 'inside', // Default inside
        currentMovementId: null,
        createdAt: new Date()
      });

      setFullName('');
      setBirthDate('2014-01-01');
      setGender('male');
      setSuccess('تم تسجيل الفرد وتوليد كود المرور (PIN) وتصنيفه كشفياً بنجاح!');
    } catch (err: any) {
      console.error('Error adding individual:', err);
      setError('فشل في حفظ بيانات الفرد. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Individual
  const handleDeleteIndividual = async (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الفرد "${name}" نهائياً من سجلات المخيم؟`)) {
      try {
        await deleteDoc(doc(db, 'individuals', id));
        setSuccess('تم حذف الفرد بنجاح.');
      } catch (err) {
        console.error('Error deleting individual:', err);
        setError('فشل الحذف. يرجى المحاولة مرة أخرى.');
      }
    }
  };

  // Start edit
  const startEdit = (ind: Individual) => {
    setEditingIndividualId(ind.id);
    setEditFullName(ind.fullName);
    setEditBirthDate(ind.birthDate);
    setEditGender(ind.gender);
  };

  // Save Edit
  const saveEditIndividual = async (id: string) => {
    if (!editFullName.trim() || !editBirthDate) {
      alert('الرجاء تعبئة اسم الفرد وتاريخ ميلاده');
      return;
    }

    try {
      const unit = classifyUnit(editBirthDate, editGender);
      const indRef = doc(db, 'individuals', id);
      await updateDoc(indRef, {
        fullName: editFullName.trim(),
        birthDate: editBirthDate,
        gender: editGender,
        unit: unit
      });
      setEditingIndividualId(null);
      setSuccess('تم تحديث بيانات الفرد وتحديث تصنيفه الكشفي تلقائياً!');
    } catch (err) {
      console.error('Error updating individual:', err);
      alert('فشل تحديث الفرد.');
    }
  };

  // Add system user profile directly to database
  const handleAddSystemUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!userName.trim() || !userEmail.trim()) {
      setError('الرجاء تعبئة الاسم والبريد الإلكتروني للحساب');
      return;
    }

    setLoading(true);

    try {
      // Create a deterministic synthetic user document so they can be logged in
      const userRef = doc(collection(db, 'users'));
      await setDoc(userRef, {
        id: userRef.id,
        name: userName.trim(),
        email: userEmail.trim().toLowerCase(),
        role: userRole,
        phone: userPhone || '',
        ...(userRole === 'unit_leader' ? { unit: userUnit } : {}),
        createdAt: new Date()
      });

      let extraMsg = '';
      // Also add as an individual under the "قادة" unit so they can use the exit gate
      if (userRole !== 'gatekeeper') {
        const existingPins = individuals.map(i => i.pinCode);
        const pinCode = generatePinCode(existingPins);
        await addDoc(collection(db, 'individuals'), {
          fullName: userName.trim(),
          birthDate: '1995-01-01', // default leader birth year
          gender: 'male',
          unit: 'قادة',
          pinCode: pinCode,
          status: 'inside',
          currentMovementId: null,
          createdAt: new Date()
        });
        extraMsg = ` وتم ربطه تلقائياً بسجل بوابة الخروج (رمز مرور PIN: ${pinCode})`;
      }

      setUserName('');
      setUserEmail('');
      setUserPhone('');
      setSuccess(`تم إضافة ملف حساب النظام الجديد بنجاح!${extraMsg} للتجربة الفورية، يرجى تفعيل الحساب ببذر البيانات أو الدخول السريع بكلمة السر: password123`);
    } catch (err: any) {
      console.error('Error adding user profile:', err);
      setError('فشل إضافة ملف الحساب.');
    } finally {
      setLoading(false);
    }
  };

  const getUnitColor = (unit: UnitType) => {
    switch (unit) {
      case 'أشبال': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'زهرات': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'كشافة': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'مرشدات': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'قادة': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getRoleNameArabic = (role: string) => {
    switch (role) {
      case 'camp_leader': return 'قائد المخيم';
      case 'general_order_leader': return 'قائد النظام العام';
      case 'unit_leader': return 'قائد وحدة كشفية';
      case 'gatekeeper': return 'البواب مناوب';
      case 'admin': return 'قيادة المخيم الإدارية';
      default: return role;
    }
  };

  // Filter individuals based on unit tab
  const filteredIndividuals = activeUnitTab === 'all' 
    ? individuals 
    : individuals.filter(ind => ind.unit === activeUnitTab);

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 flex items-start gap-2">
          <UserCheck className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD INDIVIDUAL MODULE */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-500" />
              تسجيل فرد جديد في المخيم
            </h3>

            <form onSubmit={handleAddIndividual} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل للفرد</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: يوسف خالد الحربي"
                  className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الميلاد</label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الجنس</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`py-2 text-xs rounded-xl border font-bold transition-all ${
                        gender === 'male' 
                          ? 'bg-blue-50 border-blue-400 text-blue-700' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ذكر
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`py-2 text-xs rounded-xl border font-bold transition-all ${
                        gender === 'female' 
                          ? 'bg-pink-50 border-pink-400 text-pink-700' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      أنثى
                    </button>
                  </div>
                </div>
              </div>

              {/* Classification Preview box */}
              {birthDate && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1 font-bold text-emerald-800">
                    <span>التصنيف الكشفي التلقائي للسن:</span>
                  </div>
                  <div className="text-slate-600">
                    العمر المحسوب: <span className="font-bold">{calculateAge(birthDate)} سنة</span> | 
                    الوحدة: <span className="font-bold text-emerald-700">{classifyUnit(birthDate, gender)}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1 shadow-md shadow-emerald-600/10"
              >
                <Plus className="w-4 h-4" />
                حفظ وتسجيل العضو
              </button>
            </form>
          </div>

          {/* ADD SYSTEM USER ACCOUNT */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              إضافة حساب مستخدم للنظام
            </h3>

            <form onSubmit={handleAddSystemUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم القائد / البواب</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="مثال: القائد تركي المطيري"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="leader2@camp.com"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الهاتف الجوال</label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="0500000000"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الدور والصلاحيات</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as UserRole)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="gatekeeper">البواب (الحارس)</option>
                    <option value="unit_leader">قائد وحدة كشفية</option>
                    <option value="general_order_leader">قائد النظام العام</option>
                    <option value="camp_leader">قائد المخيم</option>
                    <option value="admin">إدارة المخيم</option>
                  </select>
                </div>

                {userRole === 'unit_leader' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة التابعة له</label>
                    <select
                      value={userUnit}
                      onChange={(e) => setUserUnit(e.target.value as UnitType)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="أشبال">أشبال</option>
                      <option value="زهرات">زهرات</option>
                      <option value="كشافة">كشافة</option>
                      <option value="مرشدات">مرشدات</option>
                      <option value="قادة">قادة</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                حفظ وإضافة الحساب
              </button>
            </form>
          </div>
        </div>

        {/* LIST & ROSTER MANAGEMENT */}
        <div className="lg:col-span-2 space-y-6">
          {/* Individual list roster */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                سجل وإدارة الأفراد المعتمدين كشفياً بالمخيم ({individuals.length})
              </h3>

              {/* Unit Tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                {['all', 'أشبال', 'زهرات', 'كشافة', 'مرشدات', 'قادة'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveUnitTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeUnitTab === tab 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab === 'all' ? 'الكل' : tab}
                  </button>
                ))}
              </div>
            </div>

            {filteredIndividuals.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">لا توجد سجلات أفراد لهذه الفئة.</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
                {filteredIndividuals.map((ind) => (
                  <div key={ind.id} className="py-4 flex flex-col md:flex-row justify-between md:items-center gap-4 text-right">
                    
                    {/* EDIT MODE OR VIEW MODE */}
                    {editingIndividualId === ind.id ? (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <input
                          type="text"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                        />
                        <input
                          type="date"
                          value={editBirthDate}
                          onChange={(e) => setEditBirthDate(e.target.value)}
                          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value as 'male' | 'female')}
                          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="male">ذكر</option>
                          <option value="female">أنثى</option>
                        </select>
                        <div className="flex gap-1 items-center justify-end">
                          <button
                            onClick={() => saveEditIndividual(ind.id)}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingIndividualId(null)}
                            className="p-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-sm">{ind.fullName}</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getUnitColor(ind.unit)}`}>
                              {ind.unit}
                            </span>
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                              PIN: {ind.pinCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            تاريخ الميلاد: {ind.birthDate} ({calculateAge(ind.birthDate)} سنة) | 
                            الجنس: {ind.gender === 'male' ? 'ذكر' : 'أنثى'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:justify-end shrink-0">
                          {ind.status === 'inside' ? (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">بالداخل</span>
                          ) : (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">بالخارج</span>
                          )}

                          <button
                            onClick={() => startEdit(ind)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteIndividual(ind.id, ind.fullName)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-250 text-slate-500 hover:text-rose-600 rounded-lg transition-colors"
                            title="حذف نهائي"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Accounts List */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
              حسابات وقيادات المخيم المسجلة ({systemUsers.length})
            </h3>

            {systemUsers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">لا يوجد قادة أو حراس مسجلين في النظام.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {systemUsers.map((user) => (
                  <div key={user.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start justify-between">
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">{user.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{user.email}</span>
                      
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[9px] font-extrabold">
                          {getRoleNameArabic(user.role)}
                        </span>
                        {user.unit && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${getUnitColor(user.unit)}`}>
                            {user.unit}
                          </span>
                        )}
                      </div>
                    </div>
                    {user.phone && (
                      <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg">
                        {user.phone}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
