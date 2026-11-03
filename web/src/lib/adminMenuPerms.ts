/** 子管理员默认菜单；可额外勾选学院/班级管理 */
export const SUB_ADMIN_DEFAULT_MENUS = ['overview', 'system-config', 'operation-log'] as const;

export const SUB_ADMIN_OPTIONAL_MENUS = ['college-management', 'class-management'] as const;

export type SubAdminOptionalMenu = (typeof SUB_ADMIN_OPTIONAL_MENUS)[number];

export function resolveAdminVisibleMenus(
  role: string | undefined,
  extraPerms: string[] | null | undefined
): Set<string> {
  if (role === 'admin') {
    return new Set([
      'overview',
      'college-management',
      'class-management',
      'dictionary',
      'system-config',
      'ai-model',
      'operation-log',
      'class-demo-files',
      'college-teachers',
      'class-students',
      'dictionary-items',
      'course-resource',
    ]);
  }
  const set = new Set<string>(SUB_ADMIN_DEFAULT_MENUS);
  const extra = Array.isArray(extraPerms) ? extraPerms : [];
  for (const m of extra) {
    if ((SUB_ADMIN_OPTIONAL_MENUS as readonly string[]).includes(m)) set.add(m);
  }
  // 下钻页跟随可选权限
  if (set.has('college-management')) set.add('college-teachers');
  if (set.has('class-management')) {
    set.add('class-students');
    set.add('course-resource');
  }
  return set;
}
