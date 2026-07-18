import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  Timestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { 
  Check, 
  X, 
  Clock, 
  Filter, 
  History, 
  Sparkles, 
  AlertTriangle, 
  FileText, 
  User, 
  TrendingUp, 
  Activity, 
  TrendingDown, 
  Calendar,
  Users
} from 'lucide-react';
import { db } from '../firebase';
import { LiveRequest, Individual, Movement, SystemUser, UnitType, Guest } from '../types';
import { formatDuration, formatDateTime, formatTime } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface CampLeaderProps {
  currentUser: SystemUser;
}

export default function CampLeaderDashboard({ currentUser }: CampLeaderProps) {
  // Live states
  const [pendingRequests, setPendingRequests] = useState<LiveRequest[]>([]);
  const [individualsOutside, setIndividualsOutside] = useState<Individual[]>([]);
  const [movementLogs, setMovementLogs] = useState<Movement[]>([]);
  const [guestLogs, setGuestLogs] = useState<Guest[]>([]);
  const [allIndividuals, setAllIndividuals] = useState<Individual[]>([]);

  // Filter states
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterAuthType, setFilterAuthType] = useState<string>('all');
  const [searchName, setSearchName] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('today'); // today, all

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Live pending approval requests
    const qPending = query(collection(db, 'liveRequests'), where('status', '==', 'pending'));
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const list: LiveRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LiveRequest);
      });
      // Sort by creation time descending
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPendingRequests(list);
    });

    // 2. Individuals list to track who is outside
    const unsubInd = onSnapshot(collection(db, 'individuals'), (snapshot) => {
      const outsideList: Individual[] = [];
      const allList: Individual[] = [];
      snapshot.forEach((doc) => {
        const ind = { id: doc.id, ...doc.data() } as Individual;
        allList.push(ind);
        if (ind.status === 'outside') {
          outsideList.push(ind);
        }
      });
      setIndividualsOutside(outsideList);
      setAllIndividuals(allList);
    });

    // 3. Movement logs for history
    const qMovements = query(collection(db, 'movements'), orderBy('exitTime', 'desc'));
    const unsubMovements = onSnapshot(qMovements, (snapshot) => {
      const list: Movement[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Movement);
      });
      setMovementLogs(list);
    });

    // 4. Guest logs
    const qGuests = query(collection(db, 'guests'), orderBy('arrivalTime', 'desc'));
    const unsubGuests = onSnapshot(qGuests, (snapshot) => {
      const list: Guest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Guest);
      });
      setGuestLogs(list);
    });

    return () => {
      unsubPending();
      unsubInd();
      unsubMovements();
      unsubGuests();
    };
  }, []);

  // Handle Approve Request
  const handleApprove = async (requestId: string) => {
    setLoading(true);
    try {
      const reqRef = doc(db, 'liveRequests', requestId);
      await updateDoc(reqRef, {
        status: 'approved',
        approvedBy: currentUser.role,
        approvedByName: currentUser.name,
        approvedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error approving request:', error);
      alert('فشل اعتماد الطلب.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Reject Request
  const handleReject = async (requestId: string) => {
    setLoading(true);
    try {
      const reqRef = doc(db, 'liveRequests', requestId);
      await updateDoc(reqRef, {
        status: 'rejected',
        rejectedBy: currentUser.name,
        rejectedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('فشل رفض الطلب.');
    } finally {
      setLoading(false);
    }
  };

  // Helper colors
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

  // Calculate stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const movementsToday = movementLogs.filter(m => {
    if (!m.exitTime) return false;
    const exitDate = m.exitTime.toDate ? m.exitTime.toDate() : new Date(m.exitTime);
    return exitDate >= todayStart;
  });

  const totalExitsToday = movementsToday.length;

  const returnsToday = movementsToday.filter(m => m.returnTime !== null);
  const avgDurationToday = returnsToday.length > 0 
    ? Math.round(returnsToday.reduce((acc, curr) => acc + (curr.durationOutside || 0), 0) / returnsToday.length)
    : 0;

  const currentOutsideCount = individualsOutside.length;

  // Filter movement logs for displaying history
  const filteredMovements = movementLogs.filter(move => {
    // 1. Filter unit
    if (filterUnit !== 'all' && move.individualUnit !== filterUnit) return false;

    // 2. Filter auth type
    if (filterAuthType !== 'all' && move.authorizationType !== filterAuthType) return false;

    // 3. Search name
    if (searchName.trim() !== '' && !move.individualName.toLowerCase().includes(searchName.toLowerCase())) return false;

    // 4. Filter date
    if (filterDate === 'today') {
      if (!move.exitTime) return false;
      const exitDate = move.exitTime.toDate ? move.exitTime.toDate() : new Date(move.exitTime);
      return exitDate >= todayStart;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Leadership Stats Header */}
      <div id="leader-stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold block mb-1">الخروج الفردي والجماعي اليوم</span>
            <span className="text-3xl font-black text-slate-800 font-mono">{totalExitsToday}</span>
            <span className="text-[10px] text-slate-400 block mt-1">حركة خروج مسجلة</span>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold block mb-1">متوسط مدة الخروج اليوم</span>
            <span className="text-3xl font-black text-slate-800 font-mono">{avgDurationToday}</span>
            <span className="text-[10px] text-slate-500 block mt-1">دقيقة غياب بالمتوسط</span>
          </div>
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold block mb-1">عدد المتواجدين بالخارج</span>
            <span className="text-3xl font-black text-amber-600 font-mono">{currentOutsideCount}</span>
            <span className="text-[10px] text-amber-500 block mt-1">فرد خارج نطاق المخيم</span>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-500 rounded-2xl">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold block mb-1">إجمالي الحاضرين بالداخل</span>
            <span className="text-3xl font-black text-emerald-600 font-mono">
              {allIndividuals.filter(i => i.status === 'inside').length}
            </span>
            <span className="text-[10px] text-emerald-500 block mt-1">أعضاء نشطين بالداخل</span>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Pending Approvals (Central Module) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
              طلبات الخروج الذكية المعلقة للتصديق والاعتماد ({pendingRequests.length})
            </h3>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
                <Check className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <span className="font-bold block text-slate-700">لا توجد طلبات إذن خروج معلقة حالياً</span>
                <span className="text-xs text-slate-400 block mt-1">طلبات البوابة والوحدات ستظهر هنا فور إرسالها لحظياً.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((req) => (
                  <motion.div
                    key={req.id}
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-5 bg-purple-50/40 border border-purple-100 rounded-3xl flex flex-col md:flex-row justify-between md:items-center gap-4 text-right"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getUnitColor(req.unit as UnitType)}`}>
                          {req.unit || 'فردي'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          بطلب من: {req.requesterName} ({req.requesterRole === 'gatekeeper' ? 'البواب' : 'قائد الوحدة'})
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatTime(req.createdAt)}
                        </span>
                      </div>

                      <h4 className="text-base font-extrabold text-purple-950">
                        {req.individualName || `خروج جماعي لوحدة الـ ${req.unit} (${req.memberIds?.length} كشاف)`}
                      </h4>

                      <p className="text-xs text-slate-700 font-medium">سبب الخروج المطلوب: {req.reason}</p>
                    </div>

                    <div className="flex gap-2 shrink-0 md:justify-end">
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={loading}
                        className="py-2 px-4 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        رفض الطلب
                      </button>

                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={loading}
                        className="py-2 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/10 transition-all flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        اعتماد وموافقة
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Movements Log with Multi-Filters */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                سجل حركات البوابة الشامل والتحليلات
              </h3>

              {/* Filters toggle bar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-0.5">
                  <Filter className="w-3.5 h-3.5" />
                  فلترة السجل:
                </span>

                {/* Filter Unit */}
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="py-1 px-2.5 bg-slate-50 border border-slate-200 text-xs rounded-lg font-medium text-slate-700"
                >
                  <option value="all">كل الوحدات</option>
                  <option value="أشبال">أشبال</option>
                  <option value="زهرات">زهرات</option>
                  <option value="كشافة">كشافة</option>
                  <option value="مرشدات">مرشدات</option>
                  <option value="قادة">قادة</option>
                </select>

                {/* Filter Authorization Type */}
                <select
                  value={filterAuthType}
                  onChange={(e) => setFilterAuthType(e.target.value)}
                  className="py-1 px-2.5 bg-slate-50 border border-slate-200 text-xs rounded-lg font-medium text-slate-700"
                >
                  <option value="all">كل أنواع الإذن</option>
                  <option value="paper_permit">بطاقة ورقية</option>
                  <option value="live_approval">إذن تطبيق</option>
                  <option value="phone_call">اتصال هاتفي</option>
                  <option value="group_exit">خروج جماعي</option>
                </select>

                {/* Filter Date range */}
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="py-1 px-2.5 bg-slate-50 border border-slate-200 text-xs rounded-lg font-medium text-slate-700"
                >
                  <option value="today">اليوم فقط</option>
                  <option value="all">كامل الأرشيف</option>
                </select>
              </div>
            </div>

            {/* Quick search by Name */}
            <div className="mb-4">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="ابحث باسم الفرد لتصفية الحركات..."
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Logs Table */}
            {filteredMovements.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">لا توجد حركات خروج أو عودة مطابقة للفلاتر المحددة.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-100 text-right text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="p-3">الفرد</th>
                      <th className="p-3">الوحدة</th>
                      <th className="p-3">نوع الإذن ومصدره</th>
                      <th className="p-3">سبب الخروج</th>
                      <th className="p-3">وقت الخروج / العودة</th>
                      <th className="p-3">المدة خارجاً</th>
                      <th className="p-3">أغراض أحضرها</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700 font-medium">
                    {filteredMovements.map((move) => (
                      <tr key={move.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{move.individualName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getUnitColor(move.individualUnit)}`}>
                            {move.individualUnit}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{move.authorizedBy}</td>
                        <td className="p-3">{move.reason}</td>
                        <td className="p-3 font-mono text-[10px] leading-relaxed">
                          <div className="text-slate-800">خروج: {formatTime(move.exitTime)}</div>
                          {move.returnTime ? (
                            <div className="text-emerald-600 mt-0.5">عودة: {formatTime(move.returnTime)}</div>
                          ) : (
                            <div className="text-amber-600 font-bold mt-0.5">بالخارج</div>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {move.durationOutside ? formatDuration(move.durationOutside) : '-'}
                        </td>
                        <td className="p-3 text-slate-500 italic max-w-[120px] truncate" title={move.broughtItems}>
                          {move.broughtItems || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Tracking: Currently Outside Camp */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              المتواجدون بالخارج حالياً ({currentOutsideCount})
            </h3>

            {individualsOutside.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                جميع الأفراد متواجدون داخل أرض المخيم حالياً.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                {individualsOutside.map((ind) => {
                  // Find their matching exit movement log
                  const matchMove = movementLogs.find(m => m.id === ind.currentMovementId);
                  const exitTime = matchMove?.exitTime;
                  let elapsedStr = '';
                  if (exitTime) {
                    const exitDate = exitTime.toDate ? exitTime.toDate() : new Date(exitTime);
                    const diffMins = Math.max(1, Math.floor((new Date().getTime() - exitDate.getTime()) / 60000));
                    elapsedStr = formatDuration(diffMins);
                  }

                  return (
                    <div 
                      key={ind.id} 
                      className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-2xl text-right text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-950 text-sm">{ind.fullName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getUnitColor(ind.unit)}`}>
                          {ind.unit}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-0.5 leading-relaxed font-medium">
                        {matchMove && (
                          <>
                            <div>سبب الخروج: {matchMove.reason}</div>
                            <div>مصدر الإذن: {matchMove.authorizedBy}</div>
                          </>
                        )}
                        <div className="text-amber-700 font-bold flex items-center gap-1 mt-1 font-mono text-[10px]">
                          <Clock className="w-3.5 h-3.5" />
                          خارج منذ: {elapsedStr || 'دقيقة'} (خروج: {formatTime(exitTime)})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guests Logs Tracker */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-500" />
              سجل الزوار اليومي
            </h3>

            {guestLogs.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">لا يوجد زيارات مسجلة للزوار اليوم.</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {guestLogs.map((guest) => (
                  <div key={guest.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-800">{guest.name}</span>
                      {guest.departureTime ? (
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">مغادر</span>
                      ) : (
                        <span className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full animate-pulse font-bold">داخل المخيم</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600">السبب: {guest.visitReason}</p>
                    <div className="text-[10px] text-slate-400 leading-normal">
                      وصول: {formatTime(guest.arrivalTime)}
                      {guest.departureTime && ` | مغادرة: ${formatTime(guest.departureTime)}`}
                    </div>
                    <div className="text-[9px] text-slate-500">منسق القيادة: {guest.contactedLeaderName}</div>
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
