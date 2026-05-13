import { Class, Student, Teacher } from './types';

export const mockClasses: Class[] = [
  {
    id: 'class-001',
    name: '创新创业实训A班',
    department: '计算机学院',
    academicYear: '2023-2024',
    semester: '春季学期',
    teacher: {
      id: 'teacher-001',
      name: '张教授',
      email: 'zhang@university.edu'
    },
    studentCount: 30,
    status: 'active',
    createdAt: '2024-02-15'
  },
  {
    id: 'class-002',
    name: '创新创业实训B班',
    department: '计算机学院',
    academicYear: '2023-2024',
    semester: '春季学期',
    teacher: {
      id: 'teacher-001',
      name: '张教授',
      email: 'zhang@university.edu'
    },
    studentCount: 28,
    status: 'active',
    createdAt: '2024-02-20'
  }
];

export const mockStudents: Student[] = [
  { id: 'stu-001', name: '张明', studentId: '2021001', email: 'zhangming@student.edu', status: 'active', classId: 'class-001', department: '计算机学院' },
  { id: 'stu-002', name: '李娜', studentId: '2021002', email: 'lina@student.edu', status: 'active', classId: 'class-001', department: '计算机学院' },
  { id: 'stu-003', name: '王强', studentId: '2021003', email: 'wangqiang@student.edu', status: 'active', classId: 'class-001', department: '计算机学院' },
  { id: 'stu-004', name: '陈雪', studentId: '2021004', email: 'chenxue@student.edu', status: 'active', classId: 'class-001', department: '计算机学院' },
  { id: 'stu-005', name: '刘洋', studentId: '2021005', email: 'liuyang@student.edu', status: 'active', classId: 'class-001', department: '计算机学院' },
  { id: 'stu-006', name: '赵敏', studentId: '2021006', email: 'zhaomin@student.edu', status: 'active', classId: 'class-002', department: '计算机学院' },
  { id: 'stu-007', name: '孙杰', studentId: '2021007', email: 'sunjie@student.edu', status: 'active', classId: 'class-002', department: '计算机学院' },
  { id: 'stu-008', name: '周芳', studentId: '2021008', email: 'zhoufang@student.edu', status: 'active', classId: 'class-002', department: '计算机学院' },
  { id: 'stu-009', name: '吴涛', studentId: '2021009', email: 'wutao@student.edu', status: 'active', classId: 'class-002', department: '计算机学院' },
  { id: 'stu-010', name: '郑浩', studentId: '2021010', email: 'zhenghao@student.edu', status: 'active', department: '计算机学院' },
  { id: 'stu-011', name: '钱丽', studentId: '2021011', email: 'qianli@student.edu', status: 'active', department: '计算机学院' },
  { id: 'stu-012', name: '孙明', studentId: '2021012', email: 'sunming@student.edu', status: 'active', department: '计算机学院' },
  { id: 'stu-013', name: '李芳', studentId: '2021013', email: 'lifang@student.edu', status: 'active', department: '计算机学院' },
  { id: 'stu-014', name: '林晓', studentId: '2021014', email: 'linxiao@student.edu', status: 'active', department: '计算机学院' },
  { id: 'stu-015', name: '黄磊', studentId: '2021015', email: 'huanglei@student.edu', status: 'active', department: '计算机学院' }
];

export const mockTeachers: Teacher[] = [
  { id: 'teacher-001', name: '张教授', email: 'zhang@university.edu', department: '计算机学院' },
  { id: 'teacher-002', name: '李老师', email: 'li@university.edu', department: '经济管理学院' },
  { id: 'teacher-003', name: '王副教授', email: 'wang@university.edu', department: '设计学院' }
];