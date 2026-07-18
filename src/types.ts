import { Timestamp } from 'firebase/firestore';

export type UserRole = 'gatekeeper' | 'unit_leader' | 'general_order_leader' | 'camp_leader' | 'admin';

export type UnitType = 'أشبال' | 'زهرات' | 'كشافة' | 'مرشدات' | 'قادة';

export interface SystemUser {
  id: string; // Auth UID
  email: string;
  role: UserRole;
  unit?: UnitType; // Only for unit_leader
  name: string;
  phone?: string;
  createdAt?: any;
}

export interface Individual {
  id: string;
  fullName: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'male' | 'female';
  unit: UnitType; // Auto-calculated
  pinCode: string; // 4 digits, unique
  status: 'inside' | 'outside';
  currentMovementId: string | null;
  createdAt: any;
}

export type AuthorizationType = 'paper_permit' | 'live_approval' | 'phone_call' | 'group_exit';

export interface Movement {
  id: string;
  individualId: string;
  individualName: string;
  individualUnit: UnitType;
  type: 'exit' | 'entry';
  exitTime: any; // Timestamp
  returnTime: any | null; // Timestamp or null
  durationOutside: number | null; // in minutes (calculated on return)
  reason: string;
  broughtItems?: string;
  authorizationType: AuthorizationType;
  authorizedBy: string; // Name/Role of leader authorizing
  groupExitId: string | null;
  recordedByGatekeeper: string; // Gatekeeper UID/Name
}

export interface GroupExit {
  id: string;
  unitLeaderId: string;
  unitLeaderName: string;
  unit: UnitType;
  authorizedBy: string;
  exitTime: any; // Timestamp
  returnTime: any | null; // Timestamp or null
  memberIds: string[];
  returnedMemberIds: string[];
  status: 'out' | 'returned' | 'partially_returned';
  reason: string;
}

export interface Guest {
  id: string;
  name?: string;
  visitReason?: string;
  contactedLeaderId: string; // Leader UID/Name
  contactedLeaderName: string;
  arrivalTime: any; // Timestamp
  departureTime: any | null; // Timestamp or null
}

export interface LiveRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: UserRole;
  individualId?: string; // empty if group
  individualName?: string;
  unit?: UnitType;
  memberIds?: string[]; // for group
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  approvedBy?: string;
  approvedByName?: string;
}
