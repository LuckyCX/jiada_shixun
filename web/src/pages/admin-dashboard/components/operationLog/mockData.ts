export interface OperationLog {
  type: 'user' | 'class' | 'course' | 'system';
  typeLabel: string;
  action: string;
  detail: string;
  operator: string;
  time: string;
  timestamp: string;
}

export const operationLogs: OperationLog[] = [
  {
    type: 'user',
    typeLabel: '用户管理',
    action: '新增学生账号',
    detail: '批量导入学生账号 50 个，所属班级：软件工程2024级1班',
    operator: '管理员张老师',
    time: '2分钟前',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  },
  {
    type: 'class',
    typeLabel: '班级管理',
    action: '创建班级',
    detail: '创建班级"软件工程2024级1班"，指派教师：陈教授',
    operator: '管理员李老师',
    time: '15分钟前',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    type: 'course',
    typeLabel: '课程资源',
    action: '发布课程章节',
    detail: '发布章节"第3章 市场调研方法"下的 5 个小节',
    operator: '管理员王老师',
    time: '1小时前',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  },
  {
    type: 'class',
    typeLabel: '班级管理',
    action: '指派教师',
    detail: '将教师"陈教授"指派到班级"创新创业基础2024春"',
    operator: '管理员张老师',
    time: '2小时前',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'system',
    typeLabel: '系统操作',
    action: '清理过期数据',
    detail: '自动清理 30 天前的临时文件和日志，释放空间 2.3GB',
    operator: '系统自动',
    time: '3小时前',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'user',
    typeLabel: '用户管理',
    action: '批量导入学生',
    detail: '从Excel文件导入学生名单 120 人，所属院系：计算机学院',
    operator: '管理员李老师',
    time: '5小时前',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'course',
    typeLabel: '课程资源',
    action: '上传课件',
    detail: '上传视频课件"商业模式画布详解.mp4"到第2章第3节',
    operator: '管理员王老师',
    time: '6小时前',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'class',
    typeLabel: '班级管理',
    action: '修改班级信息',
    detail: '修改班级"计算机科学2023级2班"的学年学期信息',
    operator: '管理员王老师',
    time: '昨天 18:30',
    timestamp: new Date(Date.now() - 29.5 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'user',
    typeLabel: '用户管理',
    action: '新增教师账号',
    detail: '创建教师账号"刘教授"，所属院系：经济管理学院',
    operator: '管理员张老师',
    time: '昨天 16:45',
    timestamp: new Date(Date.now() - 31.25 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'system',
    typeLabel: '系统操作',
    action: '发布系统公告',
    detail: '发布公告"期末考试安排通知"，面向全体学生和教师',
    operator: '管理员李老师',
    time: '昨天 14:20',
    timestamp: new Date(Date.now() - 33.67 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'course',
    typeLabel: '课程资源',
    action: '删除课件',
    detail: '删除过期课件"旧版商业计划书模板.pdf"',
    operator: '管理员王老师',
    time: '昨天 10:15',
    timestamp: new Date(Date.now() - 37.75 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'system',
    typeLabel: '系统操作',
    action: '数据备份',
    detail: '执行系统数据全量备份，备份文件大小：15.6GB',
    operator: '系统自动',
    time: '昨天 02:00',
    timestamp: new Date(Date.now() - 46 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'user',
    typeLabel: '用户管理',
    action: '重置密码',
    detail: '为学生"张三（学号：2024001）"重置登录密码',
    operator: '管理员李老师',
    time: '2天前',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'class',
    typeLabel: '班级管理',
    action: '添加学生到班级',
    detail: '将 15 名学生添加到班级"数据科学2024级3班"',
    operator: '管理员张老师',
    time: '2天前',
    timestamp: new Date(Date.now() - 2.2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'course',
    typeLabel: '课程资源',
    action: '创建课程章节',
    detail: '创建新章节"第5章 产品原型设计"，包含 6 个小节',
    operator: '管理员王老师',
    time: '3天前',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'user',
    typeLabel: '用户管理',
    action: '停用账号',
    detail: '停用已毕业学生账号 80 个，保留学习记录',
    operator: '管理员李老师',
    time: '3天前',
    timestamp: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'system',
    typeLabel: '系统操作',
    action: '系统维护',
    detail: '执行系统维护，优化数据库索引，提升查询性能',
    operator: '系统自动',
    time: '4天前',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'class',
    typeLabel: '班级管理',
    action: '更换班级教师',
    detail: '将班级"人工智能2023级1班"的指派教师从"李教授"更换为"王教授"',
    operator: '管理员张老师',
    time: '5天前',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'course',
    typeLabel: '课程资源',
    action: '批量上传课件',
    detail: '批量上传 12 个PDF课件到"第4章 商业计划书撰写"',
    operator: '管理员王老师',
    time: '5天前',
    timestamp: new Date(Date.now() - 5.5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'user',
    typeLabel: '用户管理',
    action: '修改用户权限',
    detail: '将教师"赵老师"的权限从"普通教师"升级为"课程管理员"',
    operator: '管理员张老师',
    time: '6天前',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'class',
    typeLabel: '班级管理',
    action: '删除班级',
    detail: '删除已结束的班级"创新创业2023秋"，学生已全部转移',
    operator: '管理员李老师',
    time: '7天前',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'system',
    typeLabel: '系统操作',
    action: '更新系统配置',
    detail: '更新系统邮件服务器配置，启用SSL加密传输',
    operator: '管理员张老师',
    time: '7天前',
    timestamp: new Date(Date.now() - 7.5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'course',
    typeLabel: '课程资源',
    action: '取消发布章节',
    detail: '将章节"第6章 融资路演技巧"设为未发布状态',
    operator: '管理员王老师',
    time: '8天前',
    timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'user',
    typeLabel: '用户管理',
    action: '批量激活账号',
    detail: '激活新学期学生账号 200 个，发送激活邮件',
    operator: '管理员李老师',
    time: '9天前',
    timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    type: 'class',
    typeLabel: '班级管理',
    action: '创建班级',
    detail: '创建班级"电子商务2024级2班"，指派教师：孙教授',
    operator: '管理员张老师',
    time: '10天前',
    timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  }
];