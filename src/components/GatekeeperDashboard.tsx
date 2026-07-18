import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { 
  Search, 
  UserCheck, 
  UserX, 
  UserPlus, 
  PhoneCall, 
  Clock, 
  History, 
  X, 
  FileText, 
  Phone, 
  ShieldAlert, 
  PackageOpen, 
  CornerDownLeft, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { db } from '../firebase';
import { Individual, Movement, SystemUser, LiveRequest, Guest, UnitType } from '../types';
import { formatDuration, formatTime, formatDateTime } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface GatekeeperProps {
  currentUser: SystemUser;
}

const COMMON_REASONS = [
  'زيارة عائلية',
  'شراء أغراض من البقالة',
  'عارض صحي / زيارة طبيب',
  'خروج مع الأهل',
  'مهمة تنظيمية للمخيم',
  'أخرى'
];

export default function GatekeeperDashboard({ currentUser }: GatekeeperProps) {
  // Database states
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [leaders, setLeaders] = useState<SystemUser[]>([]);
  const [liveApprovals, setLiveApprovals] = useState<LiveRequest[]>([]);
  const [activeGuests, setActiveGuests] = useState<Guest[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);

  // Search & Select states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndividual, setSelectedIndividual] = useState<Individual | null>(null);
  const [selectedIndividualMovements, setSelectedIndividualMovements] = useState<Movement[]>([]);

  // Check-out Form states
  const [authType, setAuthType] = useState<'paper_permit' | 'live_approval' | 'phone_call'>('paper_permit');
  const [authorizedByLeaderId, setAuthorizedByLeaderId] = useState('');
  const [customLeaderName, setCustomLeaderName] = useState('');
  const [exitReason, setExitReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // Check-in Form states
  const [broughtItems, setBroughtItems] = useState('');

  // Guest Form state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestReason, setGuestReason] = useState('');
  const [contactedLeaderId, setContactedLeaderId] = useState('');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load individuals, leaders, approved live requests, and active guests
  useEffect(() => {
    // 1. Live individuals list
    const unsubInd = onSnapshot(collection(db, 'individuals'), (snapshot) => {
      const list: Individual[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Individual);
      });
      setIndividuals(list);
    });

    // 2. Load leaders
    const leadersQuery = query(collection(db, 'users'), where('role', 'in', ['camp_leader', 'general_order_leader', 'admin', 'unit_leader']));
    const unsubLeaders = onSnapshot(leadersQuery, (snapshot) => {
      const list: SystemUser[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SystemUser);
      });
      setLeaders(list);
    });

    // 3. Live approved requests that haven't been fulfilled yet (where individual status is still inside)
    const approvalsQuery = query(
      collection(db, 'liveRequests'), 
      where('status', '==', 'approved')
    );
    const unsubApprovals = onSnapshot(approvalsQuery, (snapshot) => {
      const list: LiveRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LiveRequest);
      });
      setLiveApprovals(list);
    });

    // 4. Active guests
    const guestsQuery = query(collection(db, 'guests'), where('departureTime', '==', null));
    const unsubGuests = onSnapshot(guestsQuery, (snapshot) => {
      const list: Guest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Guest);
      });
      setActiveGuests(list);
    });

    // 5. Recent 10 movements for log
    const movementsQuery = query(collection(db, 'movements'), orderBy('exitTime', 'desc'));
    const unsubMovements = onSnapshot(movementsQuery, (snapshot) => {
      const list: any[] = [];
      let count = 0;
      snapshot.forEach((doc) => {
        if (count < 10) {
          list.push({ id: doc.id, ...doc.data() });
          count++;
        }
      });
      setRecentMovements(list);
    });

    return () => {
      unsubInd();
      unsubLeaders();
      unsubApprovals();
      unsubGuests();
      unsubMovements();
    };
  }, []);

  // Update selected individual's details if individual updates in real-time
  useEffect(() => {
    if (selectedIndividual) {
      const updated = individuals.find(ind => ind.id === selectedIndividual.id);
      if (updated) {
        setSelectedIndividual(updated);
      }
    }
  }, [individuals]);

  // Load individual's movement history when selected
  useEffect(() => {
    if (selectedIndividual) {
      const q = query(collection(db, 'movements'), where('individualId', '==', selectedIndividual.id));
      getDocs(q).then((snapshot) => {
        const list: Movement[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Movement);
        });
        // Sort by exitTime descending
        list.sort((a, b) => {
          const aTime = a.exitTime?.seconds || 0;
          const bTime = b.exitTime?.seconds || 0;
          return bTime - aTime;
        });
        setSelectedIndividualMovements(list);
      });
    } else {
      setSelectedIndividualMovements([]);
    }
  }, [selectedIndividual]);

  // Filter individuals based on PIN or Name
  const filteredIndividuals = searchQuery.trim() === '' 
    ? [] 
    : individuals.filter(ind => 
        ind.pinCode.includes(searchQuery) || 
        ind.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Self-healing: automatically create individual records for any leaders (not gatekeeper)
  // so they can be searched, scanned, and logged for exit/entry like standard individuals under unit 'قادة'
  useEffect(() => {
    if (leaders.length === 0 || individuals.length === 0) return;

    const syncLeadersToIndividuals = async () => {
      const missingLeaders = leaders.filter(leader => {
        if (leader.role === 'gatekeeper') return false;
        // Check if there is already an individual with the exact same name
        return !individuals.some(ind => ind.fullName.trim().toLowerCase() === leader.name.trim().toLowerCase());
      });

      if (missingLeaders.length === 0) return;

      const generatePinCode = (existing: string[]): string => {
        let code = '';
        do {
          code = Math.floor(1000 + Math.random() * 9000).toString();
        } while (existing.includes(code));
        return code;
      };

      const existingPins = individuals.map(i => i.pinCode);

      for (const leader of missingLeaders) {
        try {
          const pinCode = generatePinCode(existingPins);
          existingPins.push(pinCode);
          await addDoc(collection(db, 'individuals'), {
            fullName: leader.name.trim(),
            birthDate: '1995-01-01',
            gender: 'male',
            unit: 'قادة',
            pinCode: pinCode,
            status: 'inside',
            currentMovementId: null,
            createdAt: new Date()
          });
          console.log(`Auto-created individual record for leader ${leader.name} with PIN ${pinCode}`);
        } catch (err) {
          console.error(`Failed to auto-create individual record for leader ${leader.name}:`, err);
        }
      }
    };

    syncLeadersToIndividuals();
  }, [leaders, individuals]);

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

  const getLeaderRoleArabic = (leader: SystemUser) => {
    if (leader.role === 'camp_leader') return 'قائد المخيم';
    if (leader.role === 'general_order_leader') return 'قائد النظام';
    if (leader.role === 'admin') return 'إدارة';
    if (leader.role === 'unit_leader') return `قائد فرقة ${leader.unit || ''}`;
    return 'مستخدم';
  };

  // 1. Submit Exit/Check-out
  const handleCheckOut = async () => {
    if (!selectedIndividual) return;
    if (selectedIndividual.status === 'outside') {
      alert('الفرد متواجد بالفعل خارج المخيم!');
      return;
    }

    setFormError(null);

    // Validate Authorizer
    let authorizerName = '';
    if (authType === 'paper_permit') {
      authorizerName = 'بطاقة خروج ورقية ممهورة';
    } else if (authType === 'phone_call') {
      if (!authorizedByLeaderId && !customLeaderName) {
        setFormError('الرجاء إدخال اسم القائد أو اختياره لتسجيل الإذن الهاتفي');
        return;
      }
      if (authorizedByLeaderId) {
        const leaderObj = leaders.find(l => l.id === authorizedByLeaderId);
        authorizerName = leaderObj ? `اتصال هاتفي: ${leaderObj.name}` : 'اتصال هاتفي بقائد';
      } else {
        authorizerName = `اتصال هاتفي: ${customLeaderName}`;
      }
    } else if (authType === 'live_approval') {
      if (!authorizedByLeaderId) {
        setFormError('الرجاء اختيار الطلب الحي المعتمد من القائمة');
        return;
      }
      const matchedApproval = liveApprovals.find(app => app.id === authorizedByLeaderId);
      authorizerName = matchedApproval ? `إذن تطبيق: ${matchedApproval.approvedByName}` : 'إذن تطبيق حي';
    }

    setActionLoading(true);

    try {
      const finalReason = exitReason === 'أخرى' ? customReason : exitReason;
      
      // Create movement
      const movementRef = await addDoc(collection(db, 'movements'), {
        individualId: selectedIndividual.id,
        individualName: selectedIndividual.fullName,
        individualUnit: selectedIndividual.unit,
        type: 'exit',
        exitTime: Timestamp.now(),
        returnTime: null,
        durationOutside: null,
        reason: finalReason || 'غير محدد',
        authorizationType: authType,
        authorizedBy: authorizerName,
        groupExitId: null,
        recordedByGatekeeper: currentUser.name
      });

      // Update Individual status
      const indRef = doc(db, 'individuals', selectedIndividual.id);
      await updateDoc(indRef, {
        status: 'outside',
        currentMovementId: movementRef.id
      });

      // If it was a live approval request, mark it as closed/fulfilled
      if (authType === 'live_approval' && authorizedByLeaderId) {
        const approvalRef = doc(db, 'liveRequests', authorizedByLeaderId);
        await updateDoc(approvalRef, {
          status: 'fulfilled'
        });
      }

      // Reset form states
      setAuthType('paper_permit');
      setAuthorizedByLeaderId('');
      setCustomLeaderName('');
      setExitReason(COMMON_REASONS[0]);
      setCustomReason('');
      
      // Select updated individual to show correct states
      const updatedInd = individuals.find(ind => ind.id === selectedIndividual.id);
      if (updatedInd) {
        setSelectedIndividual(updatedInd);
      }

    } catch (error: any) {
      console.error('Error recording check-out:', error);
      setFormError('حدث خطأ أثناء حفظ حركة الخروج. يرجى المحاولة لاحقاً.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Submit Entry/Check-in
  const handleCheckIn = async () => {
    if (!selectedIndividual || !selectedIndividual.currentMovementId) return;

    setActionLoading(true);
    setFormError(null);

    try {
      const movementId = selectedIndividual.currentMovementId;
      const movementRef = doc(db, 'movements', movementId);
      
      // Retrieve the movement to get the exitTime
      const movementSnap = await getDocs(query(collection(db, 'movements')));
      let exitTime: Timestamp = Timestamp.now();
      movementSnap.forEach((doc) => {
        if (doc.id === movementId) {
          exitTime = doc.data().exitTime;
        }
      });

      const now = Timestamp.now();
      const diffMs = now.toMillis() - exitTime.toMillis();
      const diffMinutes = Math.max(1, Math.floor(diffMs / 60000)); // minimum 1 min

      // 1. Update movement
      await updateDoc(movementRef, {
        returnTime: now,
        durationOutside: diffMinutes,
        broughtItems: broughtItems || 'لا شيء'
      });

      // 2. Update individual status
      const indRef = doc(db, 'individuals', selectedIndividual.id);
      await updateDoc(indRef, {
        status: 'inside',
        currentMovementId: null
      });

      setBroughtItems('');
      
      // Refresh current selected individual
      const updatedInd = individuals.find(ind => ind.id === selectedIndividual.id);
      if (updatedInd) {
        setSelectedIndividual(updatedInd);
      }

    } catch (error: any) {
      console.error('Error recording check-in:', error);
      setFormError('حدث خطأ أثناء حفظ حركة الدخول.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Register Guest
  const handleRegisterGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFormError(null);

    try {
      let leaderName = 'غير محدد';
      if (contactedLeaderId) {
        const leaderObj = leaders.find(l => l.id === contactedLeaderId);
        leaderName = leaderObj ? leaderObj.name : 'قائد';
      }

      await addDoc(collection(db, 'guests'), {
        name: guestName || 'ضيف غير مسمى',
        visitReason: guestReason || 'زيارة عامة',
        contactedLeaderId: contactedLeaderId,
        contactedLeaderName: leaderName,
        arrivalTime: Timestamp.now(),
        departureTime: null
      });

      setGuestName('');
      setGuestReason('');
      setContactedLeaderId('');
      setShowGuestModal(false);
    } catch (error) {
      console.error('Error adding guest:', error);
      setFormError('فشل تسجيل الضيف.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Guest Departure
  const handleGuestDeparture = async (guestId: string) => {
    try {
      const guestRef = doc(db, 'guests', guestId);
      await updateDoc(guestRef, {
        departureTime: Timestamp.now()
      });
    } catch (error) {
      console.error('Error signing out guest:', error);
    }
  };

  // 5. Submit Group Exit Check-out from Approved Live Request
  const handleGroupCheckOut = async (request: LiveRequest) => {
    if (!request.memberIds || request.memberIds.length === 0) return;
    
    setActionLoading(true);
    setFormError(null);

    try {
      const authorizerName = `إذن تطبيق: ${request.approvedByName}`;
      const now = Timestamp.now();

      // Create Group Exit Log
      const groupExitRef = await addDoc(collection(db, 'groupExits'), {
        unitLeaderId: request.requesterId,
        unitLeaderName: request.requesterName,
        unit: request.unit,
        authorizedBy: authorizerName,
        exitTime: now,
        returnTime: null,
        memberIds: request.memberIds,
        returnedMemberIds: [],
        status: 'out',
        reason: request.reason
      });

      // Update each individual status and write their movement logs
      for (const mid of request.memberIds) {
        const ind = individuals.find(i => i.id === mid);
        if (ind && ind.status === 'inside') {
          // Create individual movement linked to the group exit
          const movementRef = await addDoc(collection(db, 'movements'), {
            individualId: ind.id,
            individualName: ind.fullName,
            individualUnit: ind.unit,
            type: 'exit',
            exitTime: now,
            returnTime: null,
            durationOutside: null,
            reason: `${request.reason} (خروج جماعي)`,
            authorizationType: 'group_exit',
            authorizedBy: authorizerName,
            groupExitId: groupExitRef.id,
            recordedByGatekeeper: currentUser.name
          });

          // Update individual status
          const indRef = doc(db, 'individuals', ind.id);
          await updateDoc(indRef, {
            status: 'outside',
            currentMovementId: movementRef.id
          });
        }
      }

      // Mark request as fulfilled
      const requestRef = doc(db, 'liveRequests', request.id);
      await updateDoc(requestRef, {
        status: 'fulfilled'
      });

      alert(`تم تسجيل الخروج الجماعي لوحدة الـ ${request.unit} بنجاح!`);
    } catch (error) {
      console.error('Error in group check-out:', error);
      alert('حدث خطأ أثناء الخروج الجماعي.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Quick Scan Box */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-emerald-500" />
          البحث عن فرد أو فحص الكود (PIN)
        </h3>

        <div className="relative">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
            placeholder="ابحث بالاسم بالكامل أو أدخل الـ PIN المكون من 4 أرقام..."
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Autocomplete Search Dropdown */}
        <AnimatePresence>
          {searchQuery.trim() !== '' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-2 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-20 relative divide-y divide-slate-100"
            >
              {filteredIndividuals.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  لا توجد نتائج مطابقة لبحثك "{searchQuery}"
                </div>
              ) : (
                filteredIndividuals.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => {
                      setSelectedIndividual(ind);
                      setSearchQuery('');
                    }}
                    className="w-full text-right p-4 hover:bg-slate-50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{ind.fullName}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          PIN: {ind.pinCode}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getUnitColor(ind.unit)}`}>
                          {ind.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ind.status === 'inside' ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                          <UserCheck className="w-3.5 h-3.5" />
                          بالداخل
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                          <UserX className="w-3.5 h-3.5" />
                          بالخارج
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Selection/Action Area */}
        <div className="lg:col-span-2 space-y-6">
          {selectedIndividual ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-900">{selectedIndividual.fullName}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getUnitColor(selectedIndividual.unit)}`}>
                      وحدة: {selectedIndividual.unit}
                    </span>
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                      كود المرور: {selectedIndividual.pinCode}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      تاريخ الميلاد: {selectedIndividual.birthDate}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedIndividual(null)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* ACTION: OUTSIDE (Check-In) OR INSIDE (Check-Out) */}
              {selectedIndividual.status === 'inside' ? (
                // CHECK-OUT FORM
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <UserCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-emerald-900">هذا الفرد متواجد حالياً داخل المخيم</h4>
                      <p className="text-xs text-emerald-700">الرجاء إدخال تفاصيل الإذن وسبب الخروج لتسجيل حركته بالخارج.</p>
                    </div>
                  </div>

                  {/* Authorization Type Selection */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">نوع إذن الخروج</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setAuthType('paper_permit'); setAuthorizedByLeaderId(''); }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center ${
                          authType === 'paper_permit' 
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-bold' 
                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <FileText className="w-5 h-5 mb-1" />
                        <span className="text-xs">بطاقة ورقية</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setAuthType('live_approval'); setAuthorizedByLeaderId(''); }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center ${
                          authType === 'live_approval' 
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-bold' 
                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Sparkles className="w-5 h-5 mb-1" />
                        <span className="text-xs">إذن ذكي (حي)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setAuthType('phone_call'); setAuthorizedByLeaderId(''); }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center ${
                          authType === 'phone_call' 
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-bold' 
                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <PhoneCall className="w-5 h-5 mb-1" />
                        <span className="text-xs">اتصال هاتفي</span>
                      </button>
                    </div>
                  </div>

                  {/* Leader Authorization Details based on selection */}
                  {authType === 'phone_call' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">اختر القائد المتصل به</label>
                        <select
                          value={authorizedByLeaderId}
                          onChange={(e) => {
                            setAuthorizedByLeaderId(e.target.value);
                            setCustomLeaderName('');
                          }}
                          className="block w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none"
                        >
                          <option value="">-- اختر من القيادة المتاحة --</option>
                          {leaders.map((leader) => (
                            <option key={leader.id} value={leader.id}>
                              {leader.name} ({getLeaderRoleArabic(leader)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">أو اكتب اسم القائد يدوياً</label>
                        <input
                          type="text"
                          value={customLeaderName}
                          onChange={(e) => {
                            setCustomLeaderName(e.target.value);
                            setAuthorizedByLeaderId('');
                          }}
                          placeholder="مثال: القائد عادل"
                          className="block w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {authType === 'live_approval' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-700 mb-2">اختر الإذن الذكي الموافق عليه من القادة</label>
                      
                      {/* Filter live approvals for this individual */}
                      {(() => {
                        const individualApprovals = liveApprovals.filter(app => app.individualId === selectedIndividual.id);
                        if (individualApprovals.length === 0) {
                          return (
                            <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100 flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4" />
                              <span>لا يوجد طلب إذن حي معتمد حالياً لهذا الفرد بالذات. الرجاء مراجعة القادة للموافقة أو اختيار إذن هاتفي/ورقي.</span>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            {individualApprovals.map((app) => (
                              <label 
                                key={app.id} 
                                className={`flex items-center gap-3 p-3 bg-white rounded-xl border cursor-pointer transition-all ${
                                  authorizedByLeaderId === app.id ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="live_approval_select"
                                  checked={authorizedByLeaderId === app.id}
                                  onChange={() => setAuthorizedByLeaderId(app.id)}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <div className="text-xs">
                                  <span className="font-bold block text-slate-800">
                                    معتمد بواسطة: {app.approvedByName} ({app.approvedBy === 'camp_leader' ? 'قائد المخيم' : 'النظام العام'})
                                  </span>
                                  <span className="text-slate-500 block mt-0.5">سبب الإذن: {app.reason}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Reason of Exit */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">سبب الخروج</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {COMMON_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setExitReason(r)}
                          className={`py-2 px-3 text-xs rounded-xl border transition-all text-center ${
                            exitReason === r 
                              ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-bold' 
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    {exitReason === 'أخرى' && (
                      <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="اكتب سبب الخروج بالتفصيل..."
                        className="mt-3 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading || (authType === 'live_approval' && !authorizedByLeaderId)}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    <UserX className="w-5 h-5" />
                    تسجيل الخروج الآن
                  </button>
                </div>
              ) : (
                // CHECK-IN FORM
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                    <UserX className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-amber-900">هذا الفرد متواجد حالياً خارج المخيم</h4>
                      
                      {/* Calculate current elapsed time */}
                      {(() => {
                        const currentMovement = selectedIndividualMovements.find(m => m.id === selectedIndividual.currentMovementId);
                        if (!currentMovement || !currentMovement.exitTime) return null;
                        const exitDate = currentMovement.exitTime.toDate ? currentMovement.exitTime.toDate() : new Date(currentMovement.exitTime);
                        const durationMins = Math.max(1, Math.floor((new Date().getTime() - exitDate.getTime()) / 60000));
                        return (
                          <div className="text-xs text-amber-700 mt-1 space-y-1">
                            <span className="block font-medium">سبب الخروج: {currentMovement.reason}</span>
                            <span className="block font-medium">بإذن من: {currentMovement.authorizedBy}</span>
                            <span className="flex items-center gap-1 mt-1 font-mono text-[11px] font-bold">
                              <Clock className="w-3.5 h-3.5" />
                              منذ {formatDuration(durationMins)} (وقت الخروج: {formatTime(currentMovement.exitTime)})
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* What did they bring with them */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">
                      <PackageOpen className="w-4 h-4 text-amber-500" />
                      ماذا أحضر معه عند العودة؟ (اختياري)
                    </label>
                    <input
                      type="text"
                      value={broughtItems}
                      onChange={(e) => setBroughtItems(e.target.value)}
                      placeholder="أغراض شخصية، حلويات، أغراض للبوابة..."
                      className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Submit Return */}
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-600/10 transition-colors disabled:opacity-50 text-base"
                  >
                    <UserCheck className="w-5 h-5" />
                    تسجيل العودة إلى المخيم
                  </button>
                </div>
              )}

              {/* Individual personal movement history */}
              {selectedIndividualMovements.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    آخر التحركات والزيارات الخاصة بالفرد
                  </h4>
                  <div className="divide-y divide-slate-100 overflow-hidden border border-slate-100 rounded-2xl max-h-56 overflow-y-auto">
                    {selectedIndividualMovements.map((move) => (
                      <div key={move.id} className="p-3 bg-slate-50 text-xs flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1 font-bold text-slate-800">
                            <span>{move.reason}</span>
                            <span className="text-slate-400 font-normal">•</span>
                            <span className="text-slate-500 font-medium">{move.authorizedBy}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            خروج: {formatDateTime(move.exitTime)}
                            {move.returnTime && ` | عودة: ${formatDateTime(move.returnTime)}`}
                          </div>
                        </div>
                        {move.durationOutside && (
                          <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold text-[10px]">
                            {formatDuration(move.durationOutside)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <UserCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h4 className="font-bold text-lg text-slate-700 mb-1">لم يتم اختيار أي فرد</h4>
              <p className="text-sm max-w-sm mx-auto">
                استخدم شريط البحث أو كود الـ PIN المكون من 4 أرقام بالأعلى للبحث عن كشاف أو قائد وتسجيل حركته.
              </p>
            </div>
          )}

          {/* Guest management Area */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-500" />
                استقبال وإدارة الضيوف
              </h3>
              <button
                onClick={() => setShowGuestModal(true)}
                className="py-1.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                تسجيل ضيف جديد
              </button>
            </div>

            {activeGuests.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                لا يوجد زوار أو ضيوف داخل المخيم حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeGuests.map((guest) => (
                  <div key={guest.id} className="p-4 bg-sky-50/50 border border-sky-100 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-slate-800">{guest.name}</span>
                        <span className="text-[10px] font-mono bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">
                          {formatTime(guest.arrivalTime)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">السبب: {guest.visitReason}</p>
                      <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                        <span>قائد التنسيق:</span>
                        <span className="font-semibold text-slate-700">{guest.contactedLeaderName}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGuestDeparture(guest.id)}
                      className="mt-3 w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      تسجيل مغادرة الضيف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info Panels */}
        <div className="space-y-6">
          {/* Quick Approvals Queue for Gatekeeper */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
              قائمة طلبات الخروج الحية المعتمدة
            </h3>

            {/* Filter requests for individuals inside camp or group exits */}
            {(() => {
              const insideApproved = liveApprovals.filter(app => {
                if (app.individualId) {
                  const ind = individuals.find(i => i.id === app.individualId);
                  return ind && ind.status === 'inside';
                } else if (app.memberIds && app.memberIds.length > 0) {
                  // Show group exit if at least one member is inside
                  return app.memberIds.some(mid => {
                    const ind = individuals.find(i => i.id === mid);
                    return ind && ind.status === 'inside';
                  });
                }
                return false;
              });

              if (insideApproved.length === 0) {
                return (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    لا توجد طلبات موافقة نشطة معلقة للبوابة حالياً.
                  </div>
                );
              }

              return (
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {insideApproved.map((app) => {
                    const isGroup = !app.individualId;
                    const ind = isGroup ? null : individuals.find(i => i.id === app.individualId);
                    
                    return (
                      <div 
                        key={app.id} 
                        className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl text-right flex flex-col justify-between"
                      >
                        <div 
                          className={isGroup ? "" : "cursor-pointer"}
                          onClick={() => !isGroup && ind && setSelectedIndividual(ind)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold text-xs text-purple-950">
                              {isGroup ? `خروج جماعي: ${app.unit}` : app.individualName}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getUnitColor(app.unit as UnitType)}`}>
                              {app.unit}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-tight">السبب: {app.reason}</p>
                          <div className="mt-2 text-[9px] text-purple-700 font-semibold flex items-center justify-between">
                            <span>بواسطة: {app.approvedByName}</span>
                            <span>{formatTime(app.createdAt)}</span>
                          </div>
                        </div>

                        {isGroup && (
                          <button
                            onClick={() => handleGroupCheckOut(app)}
                            className="mt-2.5 w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-all"
                          >
                            تأكيد وتسجيل الخروج الجماعي ({app.memberIds?.length || 0} كشاف)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Quick Call Phone List for Guard */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-500" />
              اتصال سريع بقيادة المخيم
            </h3>
            
            {leaders.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">لا توجد أرقام هواتف مسجلة للقيادة.</div>
            ) : (
              <div className="space-y-2">
                {leaders.map((leader) => (
                  <div key={leader.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-800">{leader.name}</span>
                      <span className="block text-[10px] text-slate-500">
                        {getLeaderRoleArabic(leader)}
                      </span>
                    </div>
                    {leader.phone ? (
                      <a
                        href={`tel:${leader.phone}`}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors flex items-center justify-center"
                        title="اتصال مباشر"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400">بلا هاتف</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent movements history */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              آخر 10 تحركات على البوابة
            </h3>

            {recentMovements.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">لا توجد حركات مسجلة مؤخراً.</div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recentMovements.map((move) => (
                  <div key={move.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{move.individualName}</span>
                      {move.type === 'exit' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                          خروج
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          دخول
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-[10px]">السبب: {move.reason}</p>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                      <span>الإذن: {move.authorizedBy}</span>
                      <span>{formatTime(move.exitTime)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GUEST REGISTRATION MODAL */}
      {showGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 relative text-right"
          >
            <button
              onClick={() => setShowGuestModal(false)}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-sky-500" />
              تسجيل وصول ضيف / زائر جديد
            </h3>

            <form onSubmit={handleRegisterGuest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الضيف (اختياري)</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="مثال: السيد صالح"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب الزيارة (اختياري)</label>
                <input
                  type="text"
                  value={guestReason}
                  onChange={(e) => setGuestReason(e.target.value)}
                  placeholder="مثال: زيارة ابن، تسليم أغراض، تفقد البنية..."
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">القائد المستدعى للتنسيق</label>
                <select
                  required
                  value={contactedLeaderId}
                  onChange={(e) => setContactedLeaderId(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="">-- اختر القائد المسؤول --</option>
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name} ({getLeaderRoleArabic(leader)})
                    </option>
                  ))}
                </select>
              </div>

              {contactedLeaderId && (
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-sky-600" />
                    <span className="font-medium text-sky-900">يمكنك الاتصال بالقائد لتأكيد الزيارة:</span>
                  </div>
                  {(() => {
                    const lObj = leaders.find(l => l.id === contactedLeaderId);
                    return lObj?.phone ? (
                      <a 
                        href={`tel:${lObj.phone}`}
                        className="px-2 py-1 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg font-bold font-mono text-[11px]"
                      >
                        {lObj.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">لا يوجد رقم</span>
                    );
                  })()}
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? 'جاري الحفظ...' : 'تسجيل الدخول والوصول'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
