export interface Class {
  id: string;
  name: string;
  code: string;
  /** 所属学院 colleges.id */
  collegeId: string;
  /** 与 collegeId 一致，用于兼容旧筛选字段 */
  department: string;
  academicYear: string;
  /** 学期字典 semester 的 data_key 字符串（如 0 春季、9 秋季） */
  semester: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  studentCount: number;
  /** 班级状态字典 class_status：0 待开班 / 1 进行中 / 2 已结束 */
  status: '0' | '1' | '2';
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