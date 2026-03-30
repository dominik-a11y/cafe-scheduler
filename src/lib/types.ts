export type UserRole = 'admin' | 'employee';

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftDefinition {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CafeHours {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEntry {
  id: string;
  user_id: string;
  shift_definition_id: string;
  date: string;
  custom_start_time: string | null;
  custom_end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  token: string;
  role: UserRole;
  used: boolean;
  created_at: string;
  updated_at: string;
}
