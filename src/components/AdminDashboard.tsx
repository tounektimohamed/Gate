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
  X,
  Upload,
  Printer,
  FileText
} from 'lucide-react';
import { db } from '../firebase';
import { Individual, SystemUser, UnitType, UserRole } from '../types';
import { classifyUnit, generatePinCode, calculateAge } from '../utils';
import { motion } from 'motion/react';

const DEFAULT_BULK_NAMES = [
  "أيات الحاجي",
  "فاطمة زهراء الهوش",
  "محمد ياسين الهوش",
  "محمد لنور",
  "بنغنية",
  "نضال بنغنية",
  "برهام لزرق",
  "إسراء جليطي",
  "يوسف بنحامد",
  "فريال نكوع",
  "نور حداد",
  "دلال لهول",
  "عبد الرحمان الشملالي",
  "آدم التوهامي",
  "يوسف التوهامي",
  "يوسف نصيبي",
  "سجود رحومة",
  "حمدي 1",
  "حمدي 2",
  "حمدي 3",
  "ريان الحاجي",
  "محمد الحكيم",
  "أحمد عزيز الورغمي",
  "آية الورغمي",
  "يوسف الحاجي",
  "سلمان الشبلي",
  "محمد هاجد لطرش",
  "حمزة العوني",
  "محمد لشهب",
  "يوسف كعيب",
  "ياسين حندورة",
  "هشام حندورة",
  "عامر بن عمر",
  "إيمان الهوش",
  "كنان الذيب",
  "إياد الذيب",
  "مريم الشبيلي",
  "آدم الهوش",
  "يوسف الهوش",
  "محمد الشبلي",
  "إيلاف كعيب",
  "محمد كعيب",
  "باديس دقنيش",
  "قصي لهول",
  "محمد الصادق الصيفي",
  "علي بن طاهر",
  "إياد بن طاهر",
  "سجود لهول",
  "ريتاج لهول",
  "محمد لهول",
  "هيكل لهول",
  "رياض لهول",
  "أسيل لهول",
  "رما لهول",
  "فاطمة الحاجي",
  "محمد المستيسر"
];

export default function AdminDashboard() {
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  // Individual Form States
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('2014-01-01');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [manualUnit, setManualUnit] = useState<UnitType | 'auto'>('auto');
  
  // Bulk upload states
  const [bulkNamesText, setBulkNamesText] = useState(DEFAULT_BULK_NAMES.join('\n'));
  const [bulkUnit, setBulkUnit] = useState<UnitType | 'auto'>('auto');
  const [bulkGender, setBulkGender] = useState<'male' | 'female'>('male');
  const [bulkBirthDate, setBulkBirthDate] = useState('2014-01-01');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Interactive Smart Bulk Classifier States
  const [bulkDrafts, setBulkDrafts] = useState<{ id: string; name: string; unit: UnitType }[]>(() => {
    return DEFAULT_BULK_NAMES.map((name, index) => ({
      id: `draft-${index}-${Date.now()}`,
      name,
      unit: 'كشافة' as UnitType
    }));
  });
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkFilterUnit, setBulkFilterUnit] = useState<string>('all');
  const [newDraftName, setNewDraftName] = useState('');

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
  const [editUnit, setEditUnit] = useState<UnitType>('كشافة');

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

      // 2. Calculate Unit dynamically or use manual override
      const unit = manualUnit === 'auto' ? classifyUnit(birthDate, gender) : manualUnit;

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
      setManualUnit('auto');
      setSuccess('تم تسجيل الفرد وتوليد كود المرور (PIN) وتصنيفه بنجاح!');
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
    setEditUnit(ind.unit);
  };

  // Save Edit
  const saveEditIndividual = async (id: string) => {
    if (!editFullName.trim() || !editBirthDate) {
      alert('الرجاء تعبئة اسم الفرد وتاريخ ميلاده');
      return;
    }

    try {
      const indRef = doc(db, 'individuals', id);
      await updateDoc(indRef, {
        fullName: editFullName.trim(),
        birthDate: editBirthDate,
        gender: editGender,
        unit: editUnit
      });
      setEditingIndividualId(null);
      setSuccess('تم تحديث بيانات الفرد وتصنيفه الكشفي بنجاح!');
    } catch (err) {
      console.error('Error updating individual:', err);
      alert('فشل تحديث الفرد.');
    }
  };

  // Bulk upload handler from interactive drafts
  const handleBulkUploadDrafts = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (bulkDrafts.length === 0) {
      setError('الرجاء إضافة أسماء إلى مسودة التصنيف أولاً');
      return;
    }

    setBulkLoading(true);

    try {
      const existingPins = individuals.map(i => i.pinCode);
      let successCount = 0;

      for (const draft of bulkDrafts) {
        const pinCode = generatePinCode(existingPins);
        existingPins.push(pinCode);

        // Infer default birth date & gender based on the selected unit
        let gender: 'male' | 'female' = 'male';
        let birthDate = '2014-01-01'; // Default

        if (draft.unit === 'زهرات' || draft.unit === 'مرشدات') {
          gender = 'female';
        }
        if (draft.unit === 'أشبال' || draft.unit === 'زهرات') {
          birthDate = '2016-01-01'; // Under 12
        } else if (draft.unit === 'كشافة' || draft.unit === 'مرشدات') {
          birthDate = '2012-01-01'; // 12-18
        } else {
          birthDate = '2000-01-01'; // Leaders / older
        }

        await addDoc(collection(db, 'individuals'), {
          fullName: draft.name.trim(),
          birthDate: birthDate,
          gender: gender,
          unit: draft.unit,
          pinCode: pinCode,
          status: 'inside', // Default inside
          currentMovementId: null,
          createdAt: new Date()
        });
        successCount++;
      }

      setSuccess(`🎉 تم بنجاح تسجيل ${successCount} عضواً وتصنيفهم حسب الأقسام وتوليد أكواد المرور (PIN) الخاصة بهم في قاعدة البيانات!`);
      // Reset draft list so they don't accidentally submit again
      setBulkDrafts([]);
      setShowBulkUpload(false);
    } catch (err: any) {
      console.error('Error in bulk upload drafts:', err);
      setError('فشل في عملية الرفع الجماعي للأعضاء. يرجى مراجعة الاتصال وإعادة المحاولة.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Change draft unit
  const handleUpdateDraftUnit = (id: string, unit: UnitType) => {
    setBulkDrafts(prev => prev.map(d => d.id === id ? { ...d, unit } : d));
  };

  // Delete from draft
  const handleDeleteDraft = (id: string) => {
    setBulkDrafts(prev => prev.filter(d => d.id !== id));
  };

  // Add a name to draft
  const handleAddNameToDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDraftName.trim()) return;
    const newId = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setBulkDrafts(prev => [
      ...prev,
      { id: newId, name: newDraftName.trim(), unit: 'كشافة' as UnitType }
    ]);
    setNewDraftName('');
  };

  // Bulk set unit for current filtered names
  const handleBulkSetUnitForFiltered = (unit: UnitType) => {
    const filteredDrafts = bulkDrafts.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(bulkSearch.toLowerCase());
      const matchesUnit = bulkFilterUnit === 'all' || d.unit === bulkFilterUnit;
      return matchesSearch && matchesUnit;
    });
    const filteredIds = filteredDrafts.map(d => d.id);

    setBulkDrafts(prev => prev.map(d => filteredIds.includes(d.id) ? { ...d, unit } : d));
  };

  // Reset drafts to default 56 names
  const handleResetDrafts = () => {
    setBulkDrafts(
      DEFAULT_BULK_NAMES.map((name, index) => ({
        id: `draft-${index}-${Date.now()}`,
        name,
        unit: 'كشافة' as UnitType
      }))
    );
    setSuccess('تم إعادة تعيين القائمة وتعبئتها بالـ 56 اسماً الافتراضية!');
  };

  // Parse raw pasted text to drafts
  const handleParseRawTextToDrafts = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    setBulkDrafts(lines.map((name, index) => ({
      id: `draft-pasted-${index}-${Date.now()}`,
      name,
      unit: 'كشافة' as UnitType
    })));
    setSuccess(`تم تحميل وتفسير ${lines.length} اسماً جديداً في مسودة التصنيف التفاعلية بنجاح!`);
  };

  // Download all participant names categorized by Scout departments as a PDF
  const downloadRosterPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة (Pop-ups) لتنزيل وعرض ملف الـ PDF الكشفي.');
      return;
    }

    // Group participants by unit
    const grouped: Record<UnitType, Individual[]> = {
      'أشبال': [],
      'زهرات': [],
      'كشافة': [],
      'مرشدات': [],
      'قادة': []
    };

    individuals.forEach(ind => {
      if (grouped[ind.unit]) {
        grouped[ind.unit].push(ind);
      }
    });

    const currentDate = new Date().toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشوف أسماء المشاركين حسب الأقسام الكشفية</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
          
          body {
            font-family: 'Cairo', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 30px;
            color: #1e293b;
            background-color: #ffffff;
            direction: rtl;
          }

          /* Print branding and header */
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px double #cbd5e1;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }

          .header-title-section {
            text-align: right;
          }

          header h1 {
            font-size: 24px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 6px 0;
          }

          header p {
            font-size: 13px;
            color: #475569;
            margin: 0;
            font-weight: 600;
          }

          .header-meta {
            text-align: left;
            font-size: 11px;
            color: #64748b;
            line-height: 1.6;
          }

          .date-badge {
            background-color: #f1f5f9;
            padding: 5px 12px;
            border-radius: 8px;
            font-weight: bold;
            color: #334155;
            display: inline-block;
            margin-top: 5px;
          }

          /* Sections and units */
          .unit-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }

          .unit-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }

          .unit-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .unit-title {
            font-size: 16px;
            font-weight: 800;
            margin: 0;
            color: #0f172a;
          }

          .unit-badge {
            font-size: 11px;
            font-weight: 800;
            padding: 4px 12px;
            border-radius: 6px;
            color: #ffffff;
            text-transform: uppercase;
          }

          .badge-أشبال { background-color: #ea580c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .badge-زهرات { background-color: #db2777 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .badge-كشافة { background-color: #16a34a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .badge-مرشدات { background-color: #4f46e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .badge-قادة { background-color: #475569 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          .count-badge {
            background-color: #f1f5f9;
            color: #334155;
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 20px;
            font-weight: bold;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Tables formatting */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            text-align: right;
          }

          th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 800;
            padding: 10px 14px;
            border-bottom: 2px solid #cbd5e1;
            font-size: 11px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          td {
            padding: 9px 14px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
          }

          tr:nth-child(even) td {
            background-color: #f8fafc/60;
          }

          .pin-cell {
            font-family: monospace;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-align: center;
            font-size: 13px;
            color: #0f172a;
          }

          .status-inside { color: #15803d; font-weight: bold; }
          .status-outside { color: #b91c1c; font-weight: bold; }

          .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
            page-break-inside: avoid;
          }

          /* Printable optimizations */
          @media print {
            body {
              padding: 0;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
            .unit-section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="header-title-section">
            <h1>المخيم الكشفي الذكي ⛺</h1>
            <p>سجل وجداول الأفراد والمشاركين المعتمدين بالمخيم</p>
          </div>
          <div class="header-meta">
            <div>إجمالي المقيدين بالمخيم: <strong>${individuals.length} فرداً</strong></div>
            <div class="date-badge">تاريخ الاستخراج: ${currentDate}</div>
          </div>
        </header>

        <main>
    `;

    const unitsOrder: UnitType[] = ['أشبال', 'زهرات', 'كشافة', 'مرشدات', 'قادة'];

    unitsOrder.forEach(unit => {
      const list = grouped[unit];
      if (list.length > 0) {
        htmlContent += `
          <section class="unit-section">
            <div class="unit-header">
              <div class="unit-title-group">
                <span class="unit-badge badge-${unit}">قسم ${unit}</span>
                <h2 class="unit-title">كشف الفرقة</h2>
              </div>
              <span class="count-badge">العدد: ${list.length} عضو كشفي</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 60px; text-align: center;">#</th>
                  <th>اسم المشارك</th>
                  <th style="width: 200px; text-align: center;">رمز الدخول الخاص (PIN)</th>
                </tr>
              </thead>
              <tbody>
        `;

        list.forEach((ind, index) => {
          htmlContent += `
            <tr>
              <td style="text-align: center; font-weight: bold; color: #94a3b8;">${index + 1}</td>
              <td style="font-weight: 700; color: #1e293b; font-size: 14px;">${ind.fullName}</td>
              <td class="pin-cell" style="font-size: 15px; text-align: center; font-weight: bold; font-family: monospace; letter-spacing: 2px; color: #0f172a;">${ind.pinCode}</td>
            </tr>
          `;
        });

        htmlContent += `
              </tbody>
            </table>
          </section>
        `;
      }
    });

    htmlContent += `
        </main>

        <div class="footer">
          تم إصدار وتوليد هذا الكشف الكشفي الرسمي إلكترونياً وتلقائياً عبر نظام إدارة المخيم الكشفي الذكي.
        </div>

        <script>
          window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
              window.print();
            }, 600);
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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

              {/* Unit manual override selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">القسم / الوحدة الكشفية</label>
                <select
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value as UnitType | 'auto')}
                  className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-700"
                >
                  <option value="auto">تلقائي (حسب تاريخ الميلاد والجنس)</option>
                  <option value="أشبال">أشبال (ذكور أقل من 12 سنة)</option>
                  <option value="زهرات">زهرات (إناث أقل من 12 سنة)</option>
                  <option value="كشافة">كشافة (ذكور 12-18 سنة)</option>
                  <option value="مرشدات">مرشدات (إناث 12-18 سنة)</option>
                  <option value="قادة">قادة (أكبر من 18 سنة)</option>
                </select>
              </div>

              {/* Classification Preview box */}
              {birthDate && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1 font-bold text-emerald-800">
                    <span>التصنيف الكشفي المعتمد:</span>
                  </div>
                  <div className="text-slate-600">
                    العمر المحسوب: <span className="font-bold">{calculateAge(birthDate)} سنة</span> | 
                    الوحدة النهائية: <span className="font-bold text-emerald-700">
                      {manualUnit === 'auto' ? classifyUnit(birthDate, gender) : manualUnit}
                    </span>
                    {manualUnit !== 'auto' && (
                      <span className="text-amber-600 block mt-1 font-bold">⚠️ تم تحديد القسم يدوياً وتخطي التصنيف التلقائي</span>
                    )}
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

          {/* SMART BULK ROSTER UPLOAD */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-500" />
                لوحة الرفع الجماعي والتصنيف الذكي للأعضاء
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkUpload(!showBulkUpload)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-indigo-600 px-3 py-1.5 rounded-xl font-bold transition-all border border-slate-200 flex items-center gap-1"
              >
                {showBulkUpload ? 'إخفاء لوحة التصنيف' : 'عرض لوحة التصنيف السريع 🚀'}
              </button>
            </div>

            {showBulkUpload ? (
              <div className="space-y-4 border-t border-slate-50 pt-4 text-right">
                
                {/* Information Header */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-[11px] text-slate-700 leading-relaxed space-y-1.5">
                  <p className="font-bold text-emerald-800 flex items-center gap-1">
                    <span>💡 مُصنّف العضوية التفاعلي الذكي:</span>
                  </p>
                  <p>
                    لقد قمنا بتحميل قائمة الـ <strong>{DEFAULT_BULK_NAMES.length} اسماً</strong> التي أرسلتها في مسودة تفاعلية بالأسفل. 
                    يمكنك الآن تصنيف كل شخص بـ <strong>كليك واحدة</strong> فقط، أو تصنيف الجميع دفعة واحدة، وحذف أو إضافة أسماء جديدة بسهولة تامة!
                  </p>
                </div>

                {/* Live Stats Indicators */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <div className="bg-white p-2 rounded-xl text-center border border-slate-100">
                    <span className="block text-[10px] text-slate-500 font-bold">المجموع</span>
                    <span className="text-xs font-black text-slate-800">{bulkDrafts.length}</span>
                  </div>
                  <div className="bg-orange-50/60 p-2 rounded-xl text-center border border-orange-100">
                    <span className="block text-[10px] text-orange-600 font-bold">أشبال</span>
                    <span className="text-xs font-black text-orange-700">{bulkDrafts.filter(d => d.unit === 'أشبال').length}</span>
                  </div>
                  <div className="bg-pink-50/60 p-2 rounded-xl text-center border border-pink-100">
                    <span className="block text-[10px] text-pink-600 font-bold">زهرات</span>
                    <span className="text-xs font-black text-pink-700">{bulkDrafts.filter(d => d.unit === 'زهرات').length}</span>
                  </div>
                  <div className="bg-emerald-50/60 p-2 rounded-xl text-center border border-emerald-100">
                    <span className="block text-[10px] text-emerald-600 font-bold">كشافة</span>
                    <span className="text-xs font-black text-emerald-700">{bulkDrafts.filter(d => d.unit === 'كشافة').length}</span>
                  </div>
                  <div className="bg-indigo-50/60 p-2 rounded-xl text-center border border-indigo-100">
                    <span className="block text-[10px] text-indigo-600 font-bold">مرشدات</span>
                    <span className="text-xs font-black text-indigo-700">{bulkDrafts.filter(d => d.unit === 'مرشدات').length}</span>
                  </div>
                  <div className="bg-slate-100 p-2 rounded-xl text-center border border-slate-200">
                    <span className="block text-[10px] text-slate-600 font-bold">قادة</span>
                    <span className="text-xs font-black text-slate-800">{bulkDrafts.filter(d => d.unit === 'قادة').length}</span>
                  </div>
                </div>

                {/* Quick Add and Search section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  
                  {/* Search and Category Filter */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600">البحث والتصفية بالمسودة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={bulkSearch}
                        onChange={(e) => setBulkSearch(e.target.value)}
                        placeholder="🔍 ابحث عن اسم بالمسودة..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-700"
                      />
                      <select
                        value={bulkFilterUnit}
                        onChange={(e) => setBulkFilterUnit(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                      >
                        <option value="all">كل الأقسام</option>
                        <option value="أشبال">أشبال</option>
                        <option value="زهرات">زهرات</option>
                        <option value="كشافة">كشافة</option>
                        <option value="مرشدات">مرشدات</option>
                        <option value="قادة">قادة</option>
                      </select>
                    </div>
                  </div>

                  {/* Add single name to draft */}
                  <form onSubmit={handleAddNameToDraft} className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600">إضافة اسم جديد للمسودة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDraftName}
                        onChange={(e) => setNewDraftName(e.target.value)}
                        placeholder="اكتب الاسم هنا واضغط إضافة..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-slate-700"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        إضافة
                      </button>
                    </div>
                  </form>

                </div>

                {/* Instant Bulk action toolbar */}
                <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-2">
                  <span className="block text-[11px] font-bold text-indigo-800">
                    ⚡ أزرار تصنيف جماعي فوري (لتصنيف كل الأسماء المفلترة المعروضة بنقرة واحدة):
                  </span>
                  <div className="flex flex-wrap gap-1.5 justify-start">
                    <button
                      type="button"
                      onClick={() => handleBulkSetUnitForFiltered('أشبال')}
                      className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-[10px] font-bold transition-all border border-orange-200"
                    >
                      تصنيف الظاهرين كـ أشبال
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetUnitForFiltered('زهرات')}
                      className="px-2.5 py-1 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-lg text-[10px] font-bold transition-all border border-pink-200"
                    >
                      تصنيف الظاهرين كـ زهرات
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetUnitForFiltered('كشافة')}
                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-[10px] font-bold transition-all border border-emerald-200"
                    >
                      تصنيف الظاهرين كـ كشافة
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetUnitForFiltered('مرشدات')}
                      className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold transition-all border border-indigo-200"
                    >
                      تصنيف الظاهرين كـ مرشدات
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetUnitForFiltered('قادة')}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[10px] font-bold transition-all border border-slate-300"
                    >
                      تصنيف الظاهرين كـ قادة
                    </button>
                  </div>
                </div>

                {/* The Draft List Component */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-inner">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center text-xs text-slate-500 font-bold">
                    <span>قائمة الأعضاء في المسودة ({
                      bulkDrafts.filter(d => {
                        const matchesSearch = d.name.toLowerCase().includes(bulkSearch.toLowerCase());
                        const matchesUnit = bulkFilterUnit === 'all' || d.unit === bulkFilterUnit;
                        return matchesSearch && matchesUnit;
                      }).length
                    } ظاهراً)</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleResetDrafts}
                        className="text-[10px] text-indigo-600 hover:underline"
                      >
                        إعادة تعيين القائمة الافتراضية
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={() => setBulkDrafts([])}
                        className="text-[10px] text-red-600 hover:underline"
                      >
                        مسح الكل
                      </button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-50 text-right px-1">
                    {bulkDrafts.filter(d => {
                      const matchesSearch = d.name.toLowerCase().includes(bulkSearch.toLowerCase());
                      const matchesUnit = bulkFilterUnit === 'all' || d.unit === bulkFilterUnit;
                      return matchesSearch && matchesUnit;
                    }).length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 font-bold">
                        لا يوجد أسماء تطابق معايير البحث والفلترة حالياً.
                      </div>
                    ) : (
                      bulkDrafts
                        .filter(d => {
                          const matchesSearch = d.name.toLowerCase().includes(bulkSearch.toLowerCase());
                          const matchesUnit = bulkFilterUnit === 'all' || d.unit === bulkFilterUnit;
                          return matchesSearch && matchesUnit;
                        })
                        .map((draft, idx) => (
                          <div key={draft.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-all rounded-xl">
                            
                            {/* Member Name */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center font-mono">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-700">{draft.name}</span>
                            </div>

                            {/* Easy One-Click Unit Toggles */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleUpdateDraftUnit(draft.id, 'أشبال')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                  draft.unit === 'أشبال'
                                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/10'
                                    : 'bg-orange-50/40 text-orange-700 border-orange-100 hover:bg-orange-100/50'
                                }`}
                              >
                                أشبال
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDraftUnit(draft.id, 'زهرات')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                  draft.unit === 'زهرات'
                                    ? 'bg-pink-600 text-white border-pink-600 shadow-sm shadow-pink-600/10'
                                    : 'bg-pink-50/40 text-pink-700 border-pink-100 hover:bg-pink-100/50'
                                }`}
                              >
                                زهرات
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDraftUnit(draft.id, 'كشافة')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                  draft.unit === 'كشافة'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/10'
                                    : 'bg-emerald-50/40 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50'
                                }`}
                              >
                                كشافة
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDraftUnit(draft.id, 'مرشدات')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                  draft.unit === 'مرشدات'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/10'
                                    : 'bg-indigo-50/40 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50'
                                }`}
                              >
                                مرشدات
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDraftUnit(draft.id, 'قادة')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                  draft.unit === 'قادة'
                                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm shadow-slate-700/10'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-200/50'
                                }`}
                              >
                                قادة
                              </button>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteDraft(draft.id)}
                                className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg hover:text-red-700 transition-all mr-2"
                                title="حذف من المسودة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Raw Paste Text Box Option for custom imports */}
                <details className="text-xs text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <summary className="cursor-pointer font-bold text-slate-600 select-none">
                    📋 هل تود لصق قائمة أسماء جديدة ومختلفة؟ اضغط هنا
                  </summary>
                  <div className="mt-3 space-y-2 text-right">
                    <p className="text-[10px] text-slate-400">الصق الأسماء هنا (اسم واحد في كل سطر) وسيتم تحميلهم في اللوحة التفاعلية أعلاه لتصنيفهم:</p>
                    <textarea
                      rows={5}
                      onChange={(e) => handleParseRawTextToDrafts(e.target.value)}
                      placeholder="عبدالله محمد&#10;خالد السعيد&#10;سارة فهد..."
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-medium text-right leading-loose"
                    />
                  </div>
                </details>

                {/* Final Submission Button */}
                <button
                  type="button"
                  onClick={handleBulkUploadDrafts}
                  disabled={bulkLoading || bulkDrafts.length === 0}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10"
                >
                  <Upload className="w-4 h-4" />
                  {bulkLoading ? 'جاري تسجيل الأعضاء وتوليد رموز المرور...' : `تأكيد وحفظ الـ ${bulkDrafts.length} عضواً بالكامل في قاعدة البيانات 💾`}
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-500 leading-relaxed">
                لقد قمنا بتوفير لوحة تصنيف تفاعلية فائقة السهولة والسرعة للأعضاء الـ 56. اضغط على <strong>"عرض لوحة التصنيف السريع 🚀"</strong> لتنظيمهم وتصنيفهم بلمح البصر.
              </div>
            )}
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    سجل وإدارة الأفراد المعتمدين بالمخيم ({individuals.length})
                  </h3>
                  <p className="text-xs text-slate-400">قائمة الأعضاء المسجلين وتصنيفهم الكشفي</p>
                </div>

                {/* PDF Download Button */}
                <button
                  type="button"
                  onClick={downloadRosterPDF}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/10 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  تنزيل كشف الأقسام كـ PDF 📥
                </button>
              </div>
            </div>

            {/* Unit Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
              <span className="text-xs font-bold text-slate-500 mr-2">تصفية حسب الفرقة الكشفية:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {['all', 'أشبال', 'زهرات', 'كشافة', 'مرشدات', 'قادة'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveUnitTab(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeUnitTab === tab 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
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
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
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
                        <select
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value as UnitType)}
                          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                        >
                          <option value="أشبال">أشبال</option>
                          <option value="زهرات">زهرات</option>
                          <option value="كشافة">كشافة</option>
                          <option value="مرشدات">مرشدات</option>
                          <option value="قادة">قادة</option>
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
