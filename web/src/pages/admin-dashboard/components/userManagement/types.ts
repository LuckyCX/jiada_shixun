export type UserRole = 'student' | 'teacher' | 'admin';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  name: string;
  studentId?: string; // 学号（学生）
  employeeId?: string; // 工号（教师/管理员）
  email: string;
  department: string; // 院系
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  classId?: string; // 班级ID
  className?: string; // 班级名称
  createdAt: string;
}

export interface UserStats {
  totalUsers: number;
  teachers: number;
  students: number;
  activeUsers: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    reason: string;
  }>;
}