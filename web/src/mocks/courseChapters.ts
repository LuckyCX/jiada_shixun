
export interface CourseResource {
  id: string;
  name: string;
  type: 'video' | 'pdf' | 'image' | 'case';
  size: string;
  uploadTime: string;
  url: string;
}

export interface CourseSection {
  id: string;
  title: string;
  resources: CourseResource[];
  published: boolean;
  knowledgePoints: string[];
}

export interface CourseChapter {
  id: string;
  title: string;
  sections: CourseSection[];
  expanded: boolean;
}

export const SHARED_COURSE_CHAPTERS: CourseChapter[] = [
  {
    id: '1',
    title: '第一章：创新思维训练',
    expanded: true,
    sections: [
      {
        id: '1-1',
        title: '1.1 SCAMPER创新思维方法',
        published: true,
        knowledgePoints: ['创新思维方法', 'SCAMPER技法'],
        resources: [
          { id: 'r1', name: 'SCAMPER方法详解.mp4', type: 'video', size: '125.6 MB', uploadTime: '2025-01-15 14:30', url: '' },
          { id: 'r2', name: 'SCAMPER实践案例.pdf', type: 'pdf', size: '3.2 MB', uploadTime: '2025-01-15 15:20', url: '' },
        ],
      },
      {
        id: '1-2',
        title: '1.2 头脑风暴与思维导图',
        published: true,
        knowledgePoints: ['创新思维方法'],
        resources: [
          { id: 'r3', name: '头脑风暴实战演练.mp4', type: 'video', size: '98.4 MB', uploadTime: '2025-01-18 10:15', url: '' },
        ],
      },
    ],
  },
  {
    id: '2',
    title: '第二章：市场调研方法',
    expanded: false,
    sections: [
      {
        id: '2-1',
        title: '2.1 用户访谈技巧',
        published: true,
        knowledgePoints: ['用户访谈技巧'],
        resources: [
          { id: 'r4', name: '用户访谈完整指南.pdf', type: 'pdf', size: '5.8 MB', uploadTime: '2025-01-20 09:30', url: '' },
          { id: 'r5', name: '访谈问题设计模板.pdf', type: 'pdf', size: '1.2 MB', uploadTime: '2025-01-20 09:45', url: '' },
        ],
      },
      {
        id: '2-2',
        title: '2.2 问卷设计与数据分析',
        published: false,
        knowledgePoints: ['问卷设计', '市场分析'],
        resources: [],
      },
    ],
  },
  {
    id: '3',
    title: '第三章：产品设计实践',
    expanded: false,
    sections: [
      {
        id: '3-1',
        title: '3.1 Figma原型设计入门',
        published: true,
        knowledgePoints: ['Figma原型设计'],
        resources: [
          { id: 'r6', name: 'Figma基础教程.mp4', type: 'video', size: '156.3 MB', uploadTime: '2025-02-05 16:00', url: '' },
        ],
      },
      {
        id: '3-2',
        title: '3.2 用户体验设计原则',
        published: true,
        knowledgePoints: ['Figma原型设计', '用户访谈技巧'],
        resources: [
          { id: 'r7', name: 'UX设计原则精讲.mp4', type: 'video', size: '112.0 MB', uploadTime: '2025-02-08 11:00', url: '' },
          { id: 'r8', name: 'UX设计检查清单.pdf', type: 'pdf', size: '2.4 MB', uploadTime: '2025-02-08 11:30', url: '' },
        ],
      },
    ],
  },
  {
    id: '4',
    title: '第四章：商业模式设计',
    expanded: false,
    sections: [
      {
        id: '4-1',
        title: '4.1 商业模式画布详解',
        published: true,
        knowledgePoints: ['精益画布', '商业模式画布'],
        resources: [
          { id: 'r9', name: '商业模式画布讲解.mp4', type: 'video', size: '143.7 MB', uploadTime: '2025-02-12 14:00', url: '' },
          { id: 'r10', name: '商业画布填写模板.pdf', type: 'pdf', size: '1.8 MB', uploadTime: '2025-02-12 14:30', url: '' },
        ],
      },
      {
        id: '4-2',
        title: '4.2 精益创业与MVP验证',
        published: true,
        knowledgePoints: ['精益画布', '市场分析'],
        resources: [
          { id: 'r11', name: '精益创业方法论.mp4', type: 'video', size: '98.2 MB', uploadTime: '2025-02-15 10:00', url: '' },
        ],
      },
    ],
  },
  {
    id: '5',
    title: '第五章：商业计划书撰写',
    expanded: false,
    sections: [
      {
        id: '5-1',
        title: '5.1 商业计划书结构与要素',
        published: true,
        knowledgePoints: ['路演技巧'],
        resources: [
          { id: 'r12', name: '商业计划书写作指南.pdf', type: 'pdf', size: '6.5 MB', uploadTime: '2025-02-20 09:00', url: '' },
          { id: 'r13', name: '优秀商业计划书范本.pdf', type: 'pdf', size: '4.2 MB', uploadTime: '2025-02-20 09:30', url: '' },
        ],
      },
      {
        id: '5-2',
        title: '5.2 路演技巧与投资人沟通',
        published: false,
        knowledgePoints: ['路演技巧', '团队协作'],
        resources: [],
      },
    ],
  },
];
