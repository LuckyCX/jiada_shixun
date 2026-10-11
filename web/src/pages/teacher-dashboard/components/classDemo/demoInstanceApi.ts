/**
 * 演示页里的实例库：优先读教师只读接口；若为空或缺少演示分类，则补上预制案例，
 * 方便课堂直接点开「实例库 / 原型案例库」。不写学生业务表。
 */
import {
  downloadTeacherInstanceResource,
  fetchTeacherInstanceLibrary,
  getTeacherInstanceCaseCoverUrl,
  getTeacherInstanceResourcePreviewUrl,
  type InstanceLibraryCase,
  type InstanceLibraryCategory,
  type InstanceLibraryPayload,
} from '../../../../lib/teacherInstanceLibraryApi';

export type {
  InstanceLibraryCase,
  InstanceLibraryCategory,
  InstanceLibraryPayload,
} from '../../../../lib/teacherInstanceLibraryApi';

const DEMO_CAT_PREFIX = 'demo-instance-cat-';

function nowIso() {
  return new Date().toISOString();
}

function html(...paragraphs: string[]) {
  return paragraphs.map((p) => `<p>${p}</p>`).join('');
}

function makeCase(
  categoryId: string,
  id: string,
  title: string,
  outcome: string,
  tags: string[],
  detail: string[],
  sortOrder: number
): InstanceLibraryCase {
  const ts = nowIso();
  return {
    id,
    categoryId,
    title,
    detailHtml: html(...detail),
    tags,
    projectOutcome: outcome,
    sortOrder,
    hasCoverImage: false,
    resources: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeCategory(
  id: string,
  name: string,
  icon: string,
  color: string,
  cases: InstanceLibraryCase[],
  sortOrder: number
): InstanceLibraryCategory {
  const ts = nowIso();
  return {
    id,
    name,
    icon,
    color,
    sortOrder,
    cases,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** 创新思维 · 实例库预制（2 个方向，共 3 个案例） */
function presetIdeationLibrary(): InstanceLibraryPayload {
  const campusId = `${DEMO_CAT_PREFIX}ideation-campus`;
  const greenId = `${DEMO_CAT_PREFIX}ideation-green`;
  return {
    categories: [
      makeCategory(
        campusId,
        '校园服务',
        'ri-school-line',
        '#14b8a6',
        [
          makeCase(
            campusId,
            'demo-ideation-case-book',
            '校园二手书流转平台',
            '完成选题答辩，形成可落地的 C2C 流转方案',
            ['二手交易', '校园', '信任机制'],
            [
              '面向本校学生，解决教材买贵、卖难、信息不对称问题。',
              '核心创意：课程表智能匹配 + 同宿舍取书，降低信任与物流成本。',
              '可讲解点：痛点验证、最小可行产品、冷启动策略。',
            ],
            1
          ),
          makeCase(
            campusId,
            'demo-ideation-case-coffee',
            '课后专注咖啡',
            '形成「预约取餐 + 低糖套餐」的课堂选题材料',
            ['新消费', '即时零售', '学习场景'],
            [
              '针对课间排队久、晚上买不到热饮的痛点。',
              '价值主张：10 分钟内取餐、甜度可控、靠近自习区。',
              '适合演示从用户观察走到项目选题的完整叙事。',
            ],
            2
          ),
        ],
        1
      ),
      makeCategory(
        greenId,
        '绿色低碳',
        'ri-leaf-line',
        '#22c55e',
        [
          makeCase(
            greenId,
            'demo-ideation-case-cup',
            '共享环保杯订阅',
            '完成绿色消费方向的创意草案与可行性评估',
            ['环保', '订阅制', '行为激励'],
            [
              '用押金 + 积分激励学生自带杯，减少一次性纸杯。',
              '合作对象可为校内饮品窗口与连锁品牌。',
              '讨论新颖性与可行性时，可对比押金模式与会员折扣。',
            ],
            1
          ),
        ],
        2
      ),
    ],
  };
}

/** 产品设计 · 原型案例库预制（2 个方向，共 3 个案例） */
function presetProductLibrary(): InstanceLibraryPayload {
  const appId = `${DEMO_CAT_PREFIX}product-app`;
  const toolId = `${DEMO_CAT_PREFIX}product-tool`;
  return {
    categories: [
      makeCategory(
        appId,
        '移动应用原型',
        'ri-smartphone-line',
        '#f97316',
        [
          makeCase(
            appId,
            'demo-product-case-match',
            '二手书智能匹配 App',
            '高保真原型含首页、发布、匹配、聊天四条主路径',
            ['原型', '匹配算法', 'MVP'],
            [
              '信息架构：首页推荐、我的书架、发布闲置、消息中心。',
              '关键交互：拍照识书 → 自动填课程标签 → 一键匹配同班买家。',
              '演示时可对照墨刀/ Figma 页面讲清核心功能优先级。',
            ],
            1
          ),
          makeCase(
            appId,
            'demo-product-case-coffee',
            '专注咖啡预约小程序',
            '完成预约、取餐码、会员三页可点击原型',
            ['小程序', '预约', '会员'],
            [
              '主流程：选门店 → 选套餐甜度 → 预约时段 → 取餐码核销。',
              '突出「课间 10 分钟」场景下的步骤压缩与状态反馈。',
              '可讲解空状态、高峰排队提示与失败重试。',
            ],
            2
          ),
        ],
        1
      ),
      makeCategory(
        toolId,
        '协作与工具',
        'ri-pencil-ruler-2-line',
        '#6366f1',
        [
          makeCase(
            toolId,
            'demo-product-case-board',
            '团队创意白板',
            '多端同步的卡片式创意墙交互说明',
            ['协作', '白板', '实时同步'],
            [
              '支持六顶思考帽分色卡片拖拽与投票。',
              '适合演示从创意发散到收敛选题的界面设计。',
              '技术侧可提及 WebSocket 同步与离线草稿。',
            ],
            1
          ),
        ],
        2
      ),
    ],
  };
}

function presetFor(moduleKey: string): InstanceLibraryPayload {
  return moduleKey === 'product' ? presetProductLibrary() : presetIdeationLibrary();
}

function countCases(categories: InstanceLibraryCategory[]) {
  return categories.reduce((sum, cat) => sum + (cat.cases?.length || 0), 0);
}

function hasDemoCategory(categories: InstanceLibraryCategory[]) {
  return categories.some((cat) => String(cat.id || '').startsWith(DEMO_CAT_PREFIX));
}

/**
 * 教师库有数据时保留并补演示分类；全空或请求失败时直接用预制。
 */
function withDemoSeed(moduleKey: string, payload: InstanceLibraryPayload | null): InstanceLibraryPayload {
  const preset = presetFor(moduleKey);
  const categories = payload?.categories || [];
  if (!categories.length || countCases(categories) === 0) {
    return preset;
  }
  if (hasDemoCategory(categories)) {
    return { categories };
  }
  return {
    categories: [
      ...categories,
      ...preset.categories.map((cat, index) => ({
        ...cat,
        sortOrder: categories.length + index + 1,
      })),
    ],
  };
}

export async function fetchStudentInstanceLibrary(_classId: string, moduleKey = 'ideation') {
  try {
    const remote = await fetchTeacherInstanceLibrary(moduleKey);
    return withDemoSeed(moduleKey, remote);
  } catch {
    // 演示不因教师实例库接口失败而空白
    return presetFor(moduleKey);
  }
}

export function getStudentInstanceCaseCoverUrl(_classId: string, caseId: string) {
  return getTeacherInstanceCaseCoverUrl(caseId);
}

export function getStudentInstanceResourcePreviewUrl(_classId: string, resourceId: string) {
  return getTeacherInstanceResourcePreviewUrl(resourceId);
}

export async function downloadStudentInstanceResource(_classId: string, resourceId: string, fileName: string) {
  return downloadTeacherInstanceResource(resourceId, fileName);
}
