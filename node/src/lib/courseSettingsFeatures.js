/**
 * 课程环节 features_json 归一化（市场调研等子功能开关）
 */

/** @param {unknown} raw @param {string} [moduleKey] */
export function normalizeModuleFeatures(raw, moduleKey = '') {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (moduleKey === 'market') {
    return {
      // 线上问卷为本环节必需，始终开启
      surveyEnabled: true,
      // 缺省开启调研数据上传
      uploadEnabled: o.uploadEnabled !== false,
    };
  }
  return {};
}

/**
 * 读取班级市场调研功能开关
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {number} classId
 */
export async function loadMarketFeatures(pool, classId) {
  const id = Number(classId);
  if (!Number.isFinite(id) || id <= 0) {
    return normalizeModuleFeatures({}, 'market');
  }
  try {
    const { rows } = await pool.query(
      `SELECT features_json
       FROM teacher_personal_class_course_settings
       WHERE teacher_personal_class_id = $1 AND module_key = 'market'
       LIMIT 1`,
      [id]
    );
    return normalizeModuleFeatures(rows[0]?.features_json, 'market');
  } catch {
    // 列未迁移时兜底双开，避免阻断主流程
    return normalizeModuleFeatures({}, 'market');
  }
}

/** 将写入体规范为可落库的 market features（拒绝关问卷） */
export function coerceMarketFeaturesForWrite(bodyFeatures) {
  const o =
    bodyFeatures && typeof bodyFeatures === 'object' && !Array.isArray(bodyFeatures)
      ? bodyFeatures
      : {};
  if (o.surveyEnabled === false) {
    return { error: '线上问卷为市场调研必需功能，不可关闭' };
  }
  return {
    features: {
      surveyEnabled: true,
      uploadEnabled: o.uploadEnabled !== false,
    },
  };
}
