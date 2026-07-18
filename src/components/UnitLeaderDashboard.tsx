import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy,
  doc,
  updateDoc,
  getDocs,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  Users, 
  Send, 
  CheckCircle, 
  Clock, 
  History, 
  AlertCircle, 
  UserCheck, 
  UserX, 
  ArrowLeftRight, 
  UsersRound,
  FileCheck
} from 'lucide-react';
import { db } from '../firebase';
import { Individual, SystemUser, LiveRequest, GroupExit, UnitType } from '../types';
import { formatDateTime, formatTime, formatDuration } from '../utils';
import { motion } from 'motion/react';

interface UnitLeaderProps {
  currentUser: SystemUser;
}

export default function UnitLeaderDashboard({ currentUser }: UnitLeaderProps) {
  const unit = currentUser.unit || 'كشافة'; // default unit if undefined
  
  // Roster and Request states
  const [unitMembers, setUnitMembers] = useState<Individual[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [leaders, setLeaders] = useState<SystemUser[]>([]);
  const [activeGroupExits, setActiveGroupExits] = useState<GroupExit[]>([]);
  const [recentGroupExits, setRecentGroupExits] = useState<GroupExit[]>([]);
  
  // Form states
  const [exitReason, setExitReason] = useState('نشاط كشفي خارجي');
  const [authorizedByLeaderId, setAuthorizedByLeaderId] = useState('');
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load roster and leaders
  useEffect(() => {
    // 1. Get individuals of this unit
    const qMembers = query(collection(db, 'individuals'), where('unit', '==', unit));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      const list: Individual[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Individual);
      });
      setUnitMembers(list);
      
      // Auto select members who are inside
      const insideIds = list.filter(m => m.status === 'inside').map(m => m.id);
      setSelectedMemberIds(insideIds);
    });

    // 2. Load camp leaders for authorization list
    const qLeaders = query(collection(db, 'users'), where('role', 'in', ['camp_leader', 'general_order_leader']));
    const unsubLeaders = onSnapshot(qLeaders, (snapshot) => {
      const list: SystemUser[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SystemUser);
      });
      setLeaders(list);
    });

    // 3. Get all group exits for this unit and filter/sort client-side to avoid index requirements
    const qGroupExits = query(
      collection(db, 'groupExits'),
      where('unit', '==', unit)
    );
    const unsubGroupExits = onSnapshot(qGroupExits, (snapshot) => {
      const allList: GroupExit[] = [];
      snapshot.forEach((doc) => {
        allList.push({ id: doc.id, ...doc.data() } as GroupExit);
      });

      // Filter and sort active exits (status: 'out' or 'partially_returned')
      const activeList = allList
        .filter(item => ['out', 'partially_returned'].includes(item.status))
        .sort((a, b) => {
          const aTime = a.exitTime?.toMillis ? a.exitTime.toMillis() : (a.exitTime?.seconds ? a.exitTime.seconds * 1000 : 0);
          const bTime = b.exitTime?.toMillis ? b.exitTime.toMillis() : (b.exitTime?.seconds ? b.exitTime.seconds * 1000 : 0);
          return bTime - aTime;
        });
      setActiveGroupExits(activeList);

      // Filter, sort, and slice history exits (status: 'returned')
      const historyList = allList
        .filter(item => item.status === 'returned')
        .sort((a, b) => {
          const aTime = a.exitTime?.toMillis ? a.exitTime.toMillis() : (a.exitTime?.seconds ? a.exitTime.seconds * 1000 : 0);
          const bTime = b.exitTime?.toMillis ? b.exitTime.toMillis() : (b.exitTime?.seconds ? b.exitTime.seconds * 1000 : 0);
          return bTime - aTime;
        })
        .slice(0, 5);
      setRecentGroupExits(historyList);
    });

    return () => {
      unsubMembers();
      unsubLeaders();
      unsubGroupExits();
    };
  }, [unit]);

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(prev => prev.filter(mid => mid !== id));
    } else {
      setSelectedMemberIds(prev => [...prev, id]);
    }
  };

  const handleSelectAllInside = () => {
    const insideIds = unitMembers.filter(m => m.status === 'inside').map(m => m.id);
    setSelectedMemberIds(insideIds);
  };

  const handleDeselectAll = () => {
    setSelectedMemberIds([]);
  };

  // Submit live group exit request
  const handleRequestGroupExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setRequestStatus(null);

    if (selectedMemberIds.length === 0) {
      setFormError('الرجاء اختيار فرد واحد على الأقل للخروج الجماعي!');
      return;
    }

    if (!exitReason.trim()) {
      setFormError('يرجى تحديد سبب الخروج الجماعي');
      return;
    }

    setLoading(true);

    try {
      // Create a live request document for the leaders to approve
      await addDoc(collection(db, 'liveRequests'), {
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        requesterRole: 'unit_leader',
        unit: unit,
        memberIds: selectedMemberIds,
        reason: exitReason,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      setRequestStatus('تم إرسال طلب الخروج الجماعي لقائد النظام/المخيم بنجاح. يرجى انتظار الموافقة وتوجيه البواب لتمرير الوحدة.');
      setExitReason('نشاط كشفي خارجي');
    } catch (err: any) {
      console.error('Error submitting group exit request:', err);
      setFormError('حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  // Register Return of Group (all or partial)
  const handleGroupReturn = async (groupExit: GroupExit, all: boolean) => {
    setLoading(true);
    try {
      const now = Timestamp.now();
      const exitTime = groupExit.exitTime;
      const diffMs = now.toMillis() - exitTime.toMillis();
      const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

      const batch = writeBatch(db);

      if (all) {
        // Everyone returns
        // 1. Update groupExit status
        const groupRef = doc(db, 'groupExits', groupExit.id);
        batch.update(groupRef, {
          status: 'returned',
          returnTime: now,
          returnedMemberIds: groupExit.memberIds
        });

        // 2. Update each individual who is outside
        for (const mid of groupExit.memberIds) {
          const ind = unitMembers.find(m => m.id === mid);
          if (ind && ind.status === 'outside') {
            const indRef = doc(db, 'individuals', mid);
            batch.update(indRef, {
              status: 'inside',
              currentMovementId: null
            });

            // Update their individual movement log
            if (ind.currentMovementId) {
              const moveRef = doc(db, 'movements', ind.currentMovementId);
              batch.update(moveRef, {
                returnTime: now,
                durationOutside: diffMinutes,
                broughtItems: 'عودة جماعية للوحدة'
              });
            }
          }
        }
      } else {
        // Only partial return (simulate return of selected members)
        // For partial, we let them return one by one from the gatekeeper's interface as individuals,
        // which automatically updates groupExit. This is handled by Firestore and is more robust!
        alert('عند عودة الأفراد فرادى، يرجى تسجيل عودتهم فرداً فرداً من طرف البواب في واجهته لضمان الدقة في المدة الزمنية لكل فرد.');
      }

      await batch.commit();
    } catch (error) {
      console.error('Error recording group return:', error);
      alert('حدث خطأ أثناء تسجيل العودة الجماعية.');
    } finally {
      setLoading(false);
    }
  };

  const insideCount = unitMembers.filter(m => m.status === 'inside').length;
  const outsideCount = unitMembers.filter(m => m.status === 'outside').length;

  return (
    <div className="space-y-6">
      {/* Unit Stats Banner */}
      <div className="bg-emerald-800 text-white rounded-3xl p-6 shadow-lg relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-700 rounded-full opacity-30"></div>
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-600 rounded-full opacity-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-emerald-200 text-xs font-bold uppercase tracking-wider block">لوحة تحكم قائد الوحدة</span>
            <h2 className="text-2xl font-extrabold mt-1">وحدة الـ {unit}</h2>
            <p className="text-emerald-100 text-xs mt-1">تعديل طلبات خروج الوحدة الجماعية ومتابعة الطلائع لحظياً.</p>
          </div>

          <div className="flex gap-4">
            <div className="bg-emerald-900/40 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-emerald-700/50">
              <span className="block text-[10px] text-emerald-200">الأعضاء بالداخل</span>
              <span className="text-xl font-black font-mono">{insideCount}</span>
            </div>
            <div className="bg-amber-900/40 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-amber-700/50">
              <span className="block text-[10px] text-amber-200">الأعضاء بالخارج</span>
              <span className="text-xl font-black font-mono">{outsideCount}</span>
            </div>
            <div className="bg-indigo-900/40 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-indigo-700/50">
              <span className="block text-[10px] text-indigo-200">المجموع بالوحدة</span>
              <span className="text-xl font-black font-mono">{unitMembers.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster & Group Exit Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-emerald-500" />
                طلب خروج جماعي جديد للوحدة
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleSelectAllInside}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all"
                >
                  تحديد الكل بالداخل
                </button>
                <button 
                  onClick={handleDeselectAll}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {requestStatus && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-700 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{requestStatus}</span>
              </div>
            )}

            {/* Roster Grid */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                اختر أفراد الوحدة المعنيين بالخروج:
              </label>
              
              {unitMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                  لا يوجد أفراد مسجلين في هذه الوحدة حالياً.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-100">
                  {unitMembers.map((member) => {
                    const isInside = member.status === 'inside';
                    const isSelected = selectedMemberIds.includes(member.id);
                    
                    return (
                      <div 
                        key={member.id}
                        onClick={() => isInside && toggleMemberSelection(member.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all select-none ${
                          !isInside 
                            ? 'bg-amber-50/50 border-amber-100 opacity-60 cursor-not-allowed' 
                            : isSelected 
                              ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400 cursor-pointer' 
                              : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isInside}
                            onChange={() => {}} // handled by div click
                            className="text-emerald-600 focus:ring-emerald-500 h-4 w-4 rounded-sm"
                          />
                          <div>
                            <span className="font-bold text-xs text-slate-800 block">{member.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">PIN: {member.pinCode}</span>
                          </div>
                        </div>

                        <div>
                          {isInside ? (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">
                              بالداخل
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">
                              بالخارج
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Request Settings Form */}
            <form onSubmit={handleRequestGroupExit} className="mt-6 space-y-4 pt-6 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب الخروج الجماعي</label>
                <input
                  type="text"
                  required
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  placeholder="مثال: رحلة خلوية في الغابة، نشاط تدريبي، مشاركة في استعراض..."
                  className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-1 font-bold text-slate-800">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>آلية تمرير الخروج الجماعي:</span>
                </div>
                <p>
                  1. يرسل قائد الوحدة هذا الطلب مع الأعضاء المحددين بالداخل.
                  <br />
                  2. يظهر التنبيه فورياً لقائد النظام أو المخيم للموافقة عليه.
                  <br />
                  3. بمجرد موافقة القائد، تظهر الموافقة تلقائياً للبواب (البوابة).
                  <br />
                  4. يقوم البواب بعمل كليك واحد لتسجيل خروج الجميع دفعة واحدة وتحديث حالاتهم.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || selectedMemberIds.length === 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                إرسال طلب الخروج الجماعي الذكي ({selectedMemberIds.length} كشاف)
              </button>
            </form>
          </div>
        </div>

        {/* Active and History Group Exits */}
        <div className="space-y-6">
          {/* Active Outings */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              الخروجات الجماعية النشطة حالياً
            </h3>

            {activeGroupExits.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                لا توجد خروجات جماعية نشطة بالخارج حالياً للوحدة.
              </div>
            ) : (
              <div className="space-y-3">
                {activeGroupExits.map((group) => (
                  <div key={group.id} className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs space-y-3 text-right">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-amber-950">{group.reason}</span>
                      <span className="text-[10px] font-mono bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                        {group.memberIds.length} كشاف خارج
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 font-medium">
                      <div>وقت الخروج: {formatDateTime(group.exitTime)}</div>
                      <div>بإذن معتمد من: {group.authorizedBy}</div>
                    </div>

                    {/* Return Group Button */}
                    <button
                      onClick={() => handleGroupReturn(group, true)}
                      disabled={loading}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      تسجيل عودة المجموعة بالكامل
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outings History */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              سجل الخروجات الجماعية السابقة
            </h3>

            {recentGroupExits.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                لا يوجد سجل خروجات جماعية سابقة مسجل للوحدة.
              </div>
            ) : (
              <div className="space-y-2">
                {recentGroupExits.map((group) => {
                  const exitDate = group.exitTime?.toDate ? group.exitTime.toDate() : new Date(group.exitTime);
                  const returnDate = group.returnTime?.toDate ? group.returnTime.toDate() : new Date(group.returnTime);
                  const diffMins = Math.max(1, Math.floor((returnDate.getTime() - exitDate.getTime()) / 60000));
                  
                  return (
                    <div key={group.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-800">{group.reason}</span>
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold">
                          {group.memberIds.length} كشاف
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 space-y-0.5">
                        <div>خروج: {formatTime(group.exitTime)} | عودة: {formatTime(group.returnTime)}</div>
                        <div className="font-bold text-slate-700">المدة الكلية خارجاً: {formatDuration(diffMins)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
