
export type CourseStatus = 'pending' | 'approved' | 'rejected' | 'offline';
export type ResourceType = 'video' | 'document' | 'graphic';
export type ResourceStatus = 'pending' | 'approved' | 'rejected';

export interface Course {
  id: number;
  name: string;
  teacher: string;
  department: string;
  submitTime: string;
  status: CourseStatus;
  studentCount: number;
  modules: number;
  knowledgePoints: number;
  description: string;
  tags: string[];
  rejectReason?: string;
}

export interface KnowledgePoint {
  id: number;
  title: string;
  module: string;
  type: ResourceType;
  abilityPoint: string;
  duration: string;
  views: number;
  status: 'published' | 'draft';
  uploader: string;
  uploadTime: string;
  isPublic: boolean;
  description: string;
}

export interface CaseItem {
  id: number;
  title: string;
  industry: string;
  caseType: 'success' | 'failure';
  module: string;
  knowledgePoints: string[];
  abilityPoints: string[];
  views: number;
  status: 'published' | 'draft';
  uploader: string;
  uploadTime: string;
  isRecommended: boolean;
  description: string;
}

export interface PendingResource {
  id: number;
  title: string;
  type: 'knowledge' | 'case';
  resourceType?: ResourceType;
  uploader: string;
  uploaderRole: 'teacher' | 'student';
  uploadTime: string;
  module: string;
  status: ResourceStatus;
  description: string;
  rejectReason?: string;
}

export const MODULES = [
  '创新思维与创意生成',
  '市场调研与用户画像',
  '产品设计与原型',
  '商业模式设计',
  '商业计划书与PPT',
  '迭代优化',
];

export const INDUSTRIES = [
  'AI+生活服务',
  'AI+智慧养老',
  'AI+乡村振兴',
  'AI+校园服务',
  'AI+医疗健康',
  '文化创意',
];

export const TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  video: { label: '视频', icon: 'ri-video-line', color: 'bg-red-100 text-red-600' },
  document: { label: '文档', icon: 'ri-file-text-line', color: 'bg-teal-100 text-teal-600' },
  graphic: { label: '图文', icon: 'ri-image-line', color: 'bg-orange-100 text-orange-600' },
};

export const COURSE_STATUS_MAP: Record<CourseStatus, { label: string; color: string; dot: string }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  approved: { label: '已上线', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  offline: { label: '已下架', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
};

export const RESOURCE_STATUS_MAP: Record<ResourceStatus, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
};
