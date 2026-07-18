import { UnitType } from './types';

/**
 * Calculates age from birth date string (YYYY-MM-DD)
 */
export function calculateAge(birthDateString: string): number {
  if (!birthDateString) return 0;
  const today = new Date();
  const birthDate = new Date(birthDateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Classify unit automatically based on birthdate and gender
 */
export function classifyUnit(birthDateString: string, gender: 'male' | 'female'): UnitType {
  const age = calculateAge(birthDateString);
  if (age < 12) {
    return gender === 'male' ? 'أشبال' : 'زهرات';
  } else if (age <= 18) {
    return gender === 'male' ? 'كشافة' : 'مرشدات';
  } else {
    return 'قادة';
  }
}

/**
 * Generates a random 4 digit PIN code that is not in the excluded list
 */
export function generatePinCode(existingPins: string[]): string {
  let pin = '';
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (existingPins.includes(pin));
  return pin;
}

/**
 * Format a Firestore timestamp or JS Date to a readable Arabic string
 */
export function formatTime(timestamp: any): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' });
}

export function formatDate(timestamp: any): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', numberingSystem: 'latn' });
}

export function formatDateTime(timestamp: any): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Format duration in minutes to readable Arabic text (e.g. 15 دقيقة, ساعتان...)
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return 'أقل من دقيقة';
  if (minutes === 1) return 'دقيقة واحدة';
  if (minutes === 2) return 'دقيقتان';
  if (minutes < 11) return `${minutes} دقائق`;
  if (minutes < 60) return `${minutes} دقيقة`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  let hoursText = '';
  if (hours === 1) hoursText = 'ساعة';
  else if (hours === 2) hoursText = 'ساعتان';
  else if (hours < 11) hoursText = `${hours} ساعات`;
  else hoursText = `${hours} ساعة`;
  
  if (remainingMinutes === 0) return hoursText;
  
  let minsText = '';
  if (remainingMinutes === 1) minsText = 'دقيقة';
  else if (remainingMinutes === 2) minsText = 'دقيقتان';
  else if (remainingMinutes < 11) minsText = `${remainingMinutes} دقائق`;
  else minsText = `${remainingMinutes} دقيقة`;
  
  return `${hoursText} و ${minsText}`;
}

export const DEMO_USERS = [
  {
    email: 'gatekeeper@camp.com',
    password: 'password123',
    name: 'أحمد البواب',
    role: 'gatekeeper' as const,
    phone: '0500000001'
  },
  {
    email: 'leader@camp.com',
    password: 'password123',
    name: 'القائد خالد',
    role: 'unit_leader' as const,
    unit: 'كشافة' as const,
    phone: '0500000002'
  },
  {
    email: 'general@camp.com',
    password: 'password123',
    name: 'القائد عادل (النظام العام)',
    role: 'general_order_leader' as const,
    phone: '0500000003'
  },
  {
    email: 'camp@camp.com',
    password: 'password123',
    name: 'القائد سليمان (قائد المخيم)',
    role: 'camp_leader' as const,
    phone: '0500000004'
  },
  {
    email: 'admin@camp.com',
    password: 'password123',
    name: 'الإداري يوسف',
    role: 'admin' as const,
    phone: '0500000005'
  }
];

export const DEMO_INDIVIDUALS = [
  { fullName: 'ياسر الحربي', birthDate: '2016-05-12', gender: 'male' as const }, // ~10 years (أشبال)
  { fullName: 'ريان العتيبي', birthDate: '2015-11-20', gender: 'male' as const }, // ~10 years (أشبال)
  { fullName: 'سارة المطيري', birthDate: '2017-02-04', gender: 'female' as const }, // ~9 years (زهرات)
  { fullName: 'نورة السديري', birthDate: '2016-08-15', gender: 'female' as const }, // ~9 years (زهرات)
  { fullName: 'عبدالعزيز الزهراني', birthDate: '2011-04-30', gender: 'male' as const }, // ~15 years (كشافة)
  { fullName: 'فيصل الغامدي', birthDate: '2010-09-12', gender: 'male' as const }, // ~15 years (كشافة)
  { fullName: 'أريج القحطاني', birthDate: '2012-01-25', gender: 'female' as const }, // ~14 years (مرشدات)
  { fullName: 'رهف الشمري', birthDate: '2011-07-18', gender: 'female' as const }, // ~14 years (مرشدات)
  { fullName: 'القائد فهد الشريف', birthDate: '1995-12-05', gender: 'male' as const }, // ~30 years (قادة)
  { fullName: 'القائدة فاطمة العلي', birthDate: '1998-03-22', gender: 'female' as const } // ~28 years (قادة)
];
