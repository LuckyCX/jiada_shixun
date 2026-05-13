export interface Class {
  id: string;
  name: string;
  department: string;
  academicYear: string;
  semester: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  studentCount: number;
  status: 'active' | 'ended';
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  studentId: string;
  email: string;
  status: 'active' | 'inactive';
  classId?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  department: string;
}