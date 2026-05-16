/** 教师端个性化教学分组（与服务端 GET /api/teacher/personal-classes 一致，需在页面使用 `teacherPortalApi` 类型时可 re-export） */
export type TeacherPersonalClass = {
  id: string;
  name: string;
  academicYear: string;
  /** 学期字典 `semester` 的 data_key 字符串（与后台班级一致） */
  semester: string;
  createdAt: string;
  studentCount: number;
};

/** @deprecated 仅 mock 数据演示用 */
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
  department?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  department: string;
}