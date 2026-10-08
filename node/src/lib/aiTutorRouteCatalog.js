/** 注入系统提示词的角色路由表（禁止管理端） */

export function routeCatalogForPrompt(audience) {
  if (audience === 'teacher') {
    return `教师端可用跳转标记（回答操作类问题时，可在文末附 1～3 个；禁止学生端与管理端路径）：
- [[route:/teacher-dashboard?tab=monitor|全局项目监控]]
- [[route:/teacher-dashboard?tab=guidance|动态引导工具]]
- [[route:/teacher-dashboard?tab=classManagement|班级管理]]
- [[route:/teacher-dashboard?tab=courseSettings|课程设置]]
- [[route:/teacher-dashboard?tab=teamReview|组队管理]]
- [[route:/teacher-dashboard?tab=teamReview&sub=questions|组队问题预设]]
- [[route:/teacher-dashboard?tab=topicReview|选题审核]]
- [[route:/teacher-dashboard?tab=businessPlanReview|商业计划书审核]]
- [[route:/teacher-dashboard?tab=teacherGuide|教学指南]]`;
  }
  return `学生端可用跳转标记（回答操作类问题时，可在文末附 1～3 个；禁止教师端与管理端路径）：
- [[route:/student-center?tab=overview|进度看板]]
- [[route:/student-center?tab=knowledge|实践课程]]
- [[route:/student-center?tab=guide|实训指南]]
- [[route:/student-center?tab=archive|学习档案]]
- [[route:/student-center?tab=notifications|通知]]
- [[route:/student-center?tab=module-team|组队与团队管理]]
- [[route:/student-center?tab=module-ideation|创新思维与创意生成]]
- [[route:/student-center?tab=module-market|市场调研与用户画像]]
- [[route:/student-center?tab=module-product|产品设计与原型]]
- [[route:/student-center?tab=module-business|商业模式设计]]
- [[route:/student-center?tab=module-simulation|项目仿真]]
- [[route:/student-center?tab=module-plan|商业计划书]]`;
}
