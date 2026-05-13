export interface Student {
  id: string;
  name: string;
  studentId: string;
  email: string;
  status: 'active' | 'inactive';
  classId?: string;
  className?: string;
  department?: string;
  teamName?: string;
  progress?: number;
  lastActive?: string;
  joinDate?: string;
}
