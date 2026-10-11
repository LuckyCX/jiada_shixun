/**
 * 市场调研演示接口。问卷、画像、对抗和报告都在 session；上传文件进演示目录。
 */
import { generateDemoAi, uploadDemoFile } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, patchFlow, readFlow } from './demoFlow';
import {
  MARKET_UPLOAD_METHODS,
  buildPublicSurveyUrl,
  totalChallengeRounds,
  type ChallengeFinalReport,
  type ChallengeSessionRecord,
  type MarketAnalysisResult,
  type MarketPersona,
  type MarketPlanResponse,
  type MarketResearchPlan,
  type MarketSurvey,
  type MarketSurveyQuestion,
  type MethodUploadItem,
  type MyLatestChallengeSession,
  type SurveyQuestionType,
  type SurveyResponseItem,
  type TeamMarketReportUploadStatus,
} from '../../../../lib/studentMarketResearchApi';

export {
  MARKET_PRESET_ROLES,
  MARKET_RESEARCH_METHODS,
  MARKET_UPLOAD_METHODS,
  METHOD_FORMAT_GUIDES,
  SURVEY_QUESTION_TYPES,
  buildPublicSurveyUrl,
  filterPlanUploadMethods,
  totalChallengeRounds,
} from '../../../../lib/studentMarketResearchApi';

export type {
  ChallengeFinalReport,
  ChallengeSessionRecord,
  MarketAnalysisResult,
  MarketPersona,
  MarketPlanAssignment,
  MarketResearchPlan,
  MarketSurvey,
  MarketSurveyQuestion,
  MarketTeamMember,
  MethodUploadItem,
  SurveyQuestionType,
  SurveyResponseItem,
  UploadTeamMarketReportError,
} from '../../../../lib/studentMarketResearchApi';

type StoredUpload = MethodUploadItem & { method: string; url: string };

type MarketBag = {
  /** 是否已经写入过演示预制，避免老师删掉后再次自动补回 */
  seeded?: boolean;
  plan: MarketResearchPlan | null;
  surveys: MarketSurvey[];
  responses: Record<string, SurveyResponseItem[]>;
  personas: MarketPersona[];
  analysis: { result: MarketAnalysisResult | null; generatedAt: string };
  uploads: StoredUpload[];
  sessions: MyLatestChallengeSession[];
  report: TeamMarketReportUploadStatus;
};

function emptyAnalysis(): MarketAnalysisResult {
  return {
    score: 0,
    conclusions: [],
    opportunities: [],
    risks: [],
    suggestions: [],
    stats: { totalCollected: 0, validSamples: null, activeSurveyCount: 0 },
    charts: {
      ageDistribution: [],
      spendingDistribution: [],
      satisfactionDistribution: [],
      improvementRanking: [],
    },
    keyFindings: [],
  };
}

function emptyBag(): MarketBag {
  return {
    plan: null,
    surveys: [],
    responses: {},
    personas: [],
    analysis: { result: null, generatedAt: '' },
    uploads: [],
    sessions: [],
    report: { uploaded: false, uploadedAt: '', uploadedBy: '', payload: null },
  };
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateTime(d: Date) {
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 演示不读课程环节配置，固定给一段可编辑的时间窗 */
function demoStagePeriod(plan?: MarketResearchPlan | null) {
  if (plan?.startDate && plan?.endDate) {
    return { startDate: plan.startDate, deadlineDate: plan.endDate };
  }
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const end = new Date();
  end.setDate(end.getDate() + 60);
  return { startDate: formatDate(start), deadlineDate: formatDate(end) };
}

function textFileUrl(body: string) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
}

function presetUpload(method: string, filename: string, body: string, daysAgo: number): StoredUpload {
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  return {
    id: demoId(),
    originalFilename: filename,
    fileSize: body.length,
    createdAt: created.toISOString(),
    uploaderName: DEMO_STUDENT_NAME,
    uploadedBy: DEMO_STUDENT_ID,
    method,
    url: textFileUrl(body),
  };
}

function presetResponses(
  surveyId: string,
  questions: MarketSurveyQuestion[],
  rows: Array<Record<string, string | number | string[]>>
): SurveyResponseItem[] {
  return rows.map((answers, index) => {
    const submitted = new Date();
    submitted.setDate(submitted.getDate() - (index + 1));
    const mapped: Record<string, string | number | string[]> = {};
    questions.forEach((q, qi) => {
      mapped[q.id] = answers[String(qi)] ?? '';
    });
    return {
      id: demoId(),
      respondentToken: `demo-${surveyId}-${index + 1}`,
      submittedAt: submitted.toISOString(),
      answers: mapped,
    };
  });
}

/**
 * 课堂演示第一次打开市场调研时写入预制：
 * 已保存的调研计划、各方法上传记录、线上问卷（含回收）、用户画像和一份可直接看的分析结果。
 */
function presetBag(): MarketBag {
  const period = demoStagePeriod();
  const published = new Date();
  published.setDate(published.getDate() - 3);
  const closes = new Date();
  closes.setDate(closes.getDate() + 21);

  const coffeeQuestions: MarketSurveyQuestion[] = [
    { id: demoId(), text: '您的年龄段是？', type: '单选', options: ['18岁以下', '18-22岁', '23-26岁', '27岁以上'] },
    { id: demoId(), text: '您平均每周在咖啡或茶饮上的花费是？', type: '单选', options: ['30元以下', '30-80元', '80-150元', '150元以上'] },
    { id: demoId(), text: '您对现有校园饮品的整体满意度是？', type: '评分' },
    { id: demoId(), text: '您最希望改进的是哪些方面？', type: '多选', options: ['价格', '出餐速度', '口味', '营业时间', '座位环境'] },
    { id: demoId(), text: '如果有一款「课后专注套餐」，您愿意尝试的原因是？', type: '填空' },
  ];
  const rivalQuestions: MarketSurveyQuestion[] = [
    { id: demoId(), text: '您最近一个月最常去的饮品店是？', type: '单选', options: ['校内食堂窗口', '瑞幸', '蜜雪冰城', '独立咖啡馆'] },
    { id: demoId(), text: '选择时您更看重？', type: '多选', options: ['价格', '距离', '口味稳定', '会员优惠'] },
    { id: demoId(), text: '对该店的满意度打几分？', type: '评分' },
    { id: demoId(), text: '您的年龄段是？', type: '单选', options: ['18-22岁', '23-26岁', '27岁以上'] },
  ];
  const priceQuestions: MarketSurveyQuestion[] = [
    { id: demoId(), text: '一杯美式您能接受的最高价格是？', type: '单选', options: ['8元', '12元', '15元', '18元以上'] },
    { id: demoId(), text: '什么情况下您愿意多付 3 元？', type: '多选', options: ['更好的豆子', '更快取餐', '可预约座位', '环保杯折扣'] },
    { id: demoId(), text: '请补充您对定价的看法', type: '填空' },
  ];

  const coffeeId = 'demo-survey-coffee';
  const rivalId = 'demo-survey-rival';
  const priceId = 'demo-survey-price';
  const coffeeResponses = presetResponses(coffeeId, coffeeQuestions, [
    { 0: '18-22岁', 1: '30-80元', 2: 4, 3: ['价格', '出餐速度'], 4: '课间十分钟能取到，不想排队' },
    { 0: '23-26岁', 1: '80-150元', 2: 3, 3: ['口味', '座位环境'], 4: '自习时需要稳定的插座和安静座位' },
    { 0: '18-22岁', 1: '30元以下', 2: 2, 3: ['价格', '营业时间'], 4: '晚上图书馆闭馆前还想买一杯' },
    { 0: '27岁以上', 1: '80-150元', 2: 5, 3: ['口味'], 4: '豆子新鲜、少糖就愿意复购' },
  ]);
  const rivalResponses = presetResponses(rivalId, rivalQuestions, [
    { 0: '瑞幸', 1: ['价格', '会员优惠'], 2: 4, 3: '23-26岁' },
    { 0: '校内食堂窗口', 1: ['距离', '价格'], 2: 3, 3: '18-22岁' },
    { 0: '独立咖啡馆', 1: ['口味稳定'], 2: 5, 3: '27岁以上' },
  ]);

  const surveys: MarketSurvey[] = [
    {
      id: coffeeId,
      title: '校园咖啡消费习惯问卷',
      status: '进行中',
      questions: coffeeQuestions,
      collected: coffeeResponses.length,
      link: buildPublicSurveyUrl('demo-coffee'),
      publicSlug: 'demo-coffee',
      fromPlan: false,
      createdAt: published.toISOString(),
      publishedAt: published.toISOString(),
      publishedAtDisplay: formatDateTime(published),
      closesAt: closes.toISOString(),
      closesAtDisplay: formatDateTime(closes),
    },
    {
      id: rivalId,
      title: '竞品门店体验问卷',
      status: '进行中',
      questions: rivalQuestions,
      collected: rivalResponses.length,
      link: buildPublicSurveyUrl('demo-rival'),
      publicSlug: 'demo-rival',
      fromPlan: true,
      createdAt: published.toISOString(),
      publishedAt: published.toISOString(),
      publishedAtDisplay: formatDateTime(published),
      closesAt: closes.toISOString(),
      closesAtDisplay: formatDateTime(closes),
    },
    {
      id: priceId,
      title: '价格敏感度问卷（草稿）',
      status: '草稿',
      questions: priceQuestions,
      collected: 0,
      link: '',
      createdAt: nowIso(),
      closesAt: closes.toISOString(),
      closesAtDisplay: formatDateTime(closes),
    },
  ];

  const personas: MarketPersona[] = [
    {
      id: 'demo-persona-lin',
      name: '林晓晨',
      age: 21,
      occupation: '在校本科生',
      major: '市场营销',
      painPoints: ['课间排队超过 8 分钟就会放弃购买', '校内窗口口味不稳定', '晚上 9 点后几乎买不到热饮'],
      needs: ['10 分钟内可取的专注套餐', '明确的低糖选项', '自习区附近的取餐点'],
      habits: ['工作日下午买 1 杯', '更看重价格和距离', '愿意为会员第二杯半价复购'],
      borderColor: 'border-green-400',
      accentColor: 'text-green-600',
      fromSurvey: true,
      source: '校园咖啡消费习惯问卷',
    },
    {
      id: 'demo-persona-zhou',
      name: '周子涵',
      age: 27,
      occupation: '互联网产品经理',
      major: '工商管理',
      painPoints: ['连锁品牌同质化严重', '座位嘈杂，不适合线上会议', '会员券规则复杂'],
      needs: ['安静角落和电源', '风味稳定的单品', '可提前预约取餐'],
      habits: ['工作日早晚各一杯', '月消费 150 元左右', '优先选择评分高的独立店'],
      borderColor: 'border-teal-400',
      accentColor: 'text-teal-600',
      fromSurvey: true,
      source: '竞品门店体验问卷',
    },
    {
      id: 'demo-persona-chen',
      name: '陈一诺',
      age: 34,
      occupation: '自由职业者',
      major: '计算机',
      painPoints: ['找不到能久坐的位置', '甜度默认偏高', '高峰期出餐慢'],
      needs: ['可久坐的下午茶场景', '豆子产地信息透明', '支持自带杯折扣'],
      habits: ['下午集中工作 3 小时', '对价格不敏感、对口味敏感', '愿意为环保杯再付 2 元'],
      borderColor: 'border-blue-400',
      accentColor: 'text-blue-600',
      fromSurvey: false,
      source: '课堂演示预制',
    },
  ];

  return {
    seeded: true,
    plan: {
      goal: '验证「课后专注咖啡」在本校及周边年轻用户中的需求：弄清价格带、取餐时效、竞品差距，并形成可写进商业计划书的用户画像。',
      methods: [...MARKET_UPLOAD_METHODS],
      startDate: period.startDate,
      endDate: period.deadlineDate,
      assignments: [
        { role: '问卷设计', memberIds: [DEMO_STUDENT_ID] },
        { role: '数据收集', memberIds: [DEMO_STUDENT_ID] },
        { role: '报告撰写', memberIds: [DEMO_STUDENT_ID] },
      ],
      savedAt: formatDateTime(published),
    },
    surveys,
    responses: {
      [coffeeId]: coffeeResponses,
      [rivalId]: rivalResponses,
    },
    personas,
    analysis: {
      generatedAt: nowIso(),
      result: {
        score: 82,
        conclusions: [
          '18-26 岁用户是主力，价格带集中在 30-80 元/周',
          '放弃购买的首要原因是排队和晚上买不到',
          '竞品里连锁靠优惠、校内窗口靠距离，口味稳定性是空隙',
        ],
        opportunities: ['课间 10 分钟取餐', '低糖专注套餐', '晚间延时供应'],
        risks: ['价格高于食堂窗口时转化下降', '座位供给不足会拉低复购'],
        suggestions: ['先做单一美式和低糖拿铁', '用预约取餐避开课间高峰', '把画像写进计划书的目标客户章节'],
        stats: {
          totalCollected: coffeeResponses.length + rivalResponses.length,
          validSamples: coffeeResponses.length + rivalResponses.length,
          activeSurveyCount: 2,
        },
        charts: {
          ageDistribution: [
            { label: '18-22岁', value: 3 },
            { label: '23-26岁', value: 2 },
            { label: '27岁以上', value: 2 },
          ],
          spendingDistribution: [
            { label: '30元以下', value: 1 },
            { label: '30-80元', value: 1 },
            { label: '80-150元', value: 2 },
          ],
          satisfactionDistribution: [
            { label: '2分', value: 1 },
            { label: '3分', value: 2 },
            { label: '4分', value: 2 },
            { label: '5分', value: 2 },
          ],
          improvementRanking: [
            { label: '价格', value: 3 },
            { label: '出餐速度', value: 2 },
            { label: '口味', value: 2 },
            { label: '营业时间', value: 1 },
          ],
        },
        keyFindings: [
          { title: '时效优先', desc: '课间场景里，超过 8 分钟排队就会流失。' },
          { title: '价格带清晰', desc: '学生用户周消费多在 80 元以内，套餐定价宜落在 12-15 元。' },
          { title: '竞品空隙', desc: '连锁靠优惠、食堂靠距离，稳定低糖和安静座位尚未被占住。' },
        ],
      },
    },
    uploads: [
      presetUpload('用户访谈', '用户访谈-林同学.txt', '受访者：林晓晨，大三。课间只接受 8 分钟内取餐，晚上图书馆附近没有热饮。愿意为第二杯半价办会员。', 2),
      presetUpload('用户访谈', '用户访谈-周先生.txt', '受访者：周子涵，产品经理。工作日两杯，在意座位是否安静、能否开会。会员规则复杂会直接换店。', 1),
      presetUpload('竞品分析', '竞品分析-校内与连锁.txt', '食堂窗口：距离近、均价 8 元，口味波动大。瑞幸：优惠多、出餐快、座位少。独立咖啡馆：口味好、客单 22 元、高峰排队 15 分钟。', 2),
      presetUpload('竞品分析', '竞品分析-价格带.txt', '本校周边美式价格：食堂 6-8 元，连锁 9.9-15 元，独立店 18-28 元。12-15 元有明确空档。', 1),
      presetUpload('行业报告', '行业报告-校园饮品摘要.txt', '校园即时饮品复购看取餐时长和甜度可选。晚间档供给不足，专注学习场景的套餐尚未标准化。', 3),
      presetUpload('数据爬取', '数据爬取-评论关键词.txt', '近 30 天公开评论高频词：排队、太甜、没座位、会员、出餐快。负面集中在高峰时段。', 2),
      presetUpload('实地观察', '实地观察-食堂窗口.txt', '周二 12:10-12:30 观察：窗口排队 11 人，平均等待 9 分钟，3 人放弃。座位占用率约 90%。', 1),
    ],
    sessions: [],
    report: { uploaded: false, uploadedAt: '', uploadedBy: '', payload: null },
  };
}

function loadBag(classId: string) {
  const bag = readFlow(classId, 'market', emptyBag());
  bag.surveys = bag.surveys || [];
  bag.responses = bag.responses || {};
  bag.personas = bag.personas || [];
  bag.uploads = bag.uploads || [];
  bag.sessions = bag.sessions || [];
  bag.analysis = bag.analysis || { result: null, generatedAt: '' };
  bag.report = bag.report || { uploaded: false, uploadedAt: '', uploadedBy: '', payload: null };
  return bag;
}

/** 缺哪块补哪块；老师改过或删过之后不再自动补回 */
function ensureSeed(classId: string) {
  const bag = loadBag(classId);
  if (bag.seeded) return bag;
  const preset = presetBag();
  if (!bag.plan) bag.plan = preset.plan;
  if (!bag.surveys.length) {
    bag.surveys = preset.surveys;
    bag.responses = { ...preset.responses, ...bag.responses };
  }
  if (!bag.personas.length) bag.personas = preset.personas;
  if (!bag.uploads.length) bag.uploads = preset.uploads;
  if (!bag.analysis?.result) bag.analysis = preset.analysis;
  bag.seeded = true;
  return write(classId, bag);
}

function read(classId: string) {
  return ensureSeed(classId);
}

function write(classId: string, bag: MarketBag) {
  return patchFlow(classId, 'market', emptyBag(), () => bag);
}

function planResponse(bag: MarketBag): MarketPlanResponse {
  return {
    plan: bag.plan,
    isTeamLeader: true,
    teamMembers: [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME }],
    stagePeriod: demoStagePeriod(bag.plan),
  };
}

function withIds(questions: Omit<MarketSurveyQuestion, 'id'>[]): MarketSurveyQuestion[] {
  return questions.map((item) => ({ ...item, id: demoId() }));
}

export async function fetchMarketResearchPlan(classId: string) {
  return planResponse(read(classId));
}

export async function saveMarketResearchPlan(classId: string, plan: MarketResearchPlan) {
  const bag = read(classId);
  bag.plan = { ...plan, savedAt: nowIso() };
  write(classId, bag);
  return planResponse(bag);
}

export async function listMarketSurveys(classId: string) {
  return read(classId).surveys;
}

export async function createMarketSurvey(
  classId: string,
  payload: { title: string; questions: Omit<MarketSurveyQuestion, 'id'>[]; source?: 'manual' | 'ai'; closesAt: string }
) {
  const survey: MarketSurvey = {
    id: demoId(),
    title: payload.title,
    status: '草稿',
    questions: withIds(payload.questions),
    collected: 0,
    link: '',
    fromPlan: payload.source === 'ai',
    createdAt: nowIso(),
    closesAt: payload.closesAt,
  };
  const bag = read(classId);
  bag.surveys = [survey, ...bag.surveys];
  write(classId, bag);
  return survey;
}

export async function updateMarketSurvey(
  classId: string,
  surveyId: string,
  payload: { title: string; questions: Omit<MarketSurveyQuestion, 'id'>[]; closesAt: string }
) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (!survey) throw new Error('问卷不存在');
  survey.title = payload.title;
  survey.questions = withIds(payload.questions);
  survey.closesAt = payload.closesAt;
  write(classId, bag);
  return survey;
}

export async function deleteMarketSurvey(classId: string, surveyId: string) {
  const bag = read(classId);
  bag.surveys = bag.surveys.filter((item) => item.id !== surveyId);
  delete bag.responses[surveyId];
  write(classId, bag);
}

export async function publishMarketSurvey(classId: string, surveyId: string) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (!survey) throw new Error('问卷不存在');
  survey.status = '进行中';
  survey.publicSlug = survey.publicSlug || demoId();
  survey.link = buildPublicSurveyUrl(survey.publicSlug);
  survey.publishedAt = nowIso();
  write(classId, bag);
  return survey;
}

export async function withdrawMarketSurvey(classId: string, surveyId: string) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (!survey) throw new Error('问卷不存在');
  survey.status = '已撤回';
  write(classId, bag);
  return survey;
}

export async function generateMarketSurveyByAi(
  classId: string,
  payload: { questionCount: number; includeTypes: SurveyQuestionType[] }
) {
  const count = Math.max(1, Math.min(12, payload.questionCount || 5));
  const text = await generateDemoAi(classId, 'market-analysis', `请给出 ${count} 个中文调研问题，每行一个。`);
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^[\d.\-、\s]+/, '').trim())
    .filter((line) => line.length > 3)
    .slice(0, count);
  const type = payload.includeTypes[0] || '单选';
  while (lines.length < count) lines.push(`您对这个方向的看法是？（${lines.length + 1}）`);
  const questions: MarketSurveyQuestion[] = lines.map((line) => ({
    id: demoId(),
    text: line,
    type,
    options: type === '填空' || type === '评分' ? undefined : ['同意', '一般', '不同意'],
  }));
  return {
    title: '课堂演示问卷',
    questions,
    promptEcho: { system: '演示', user: `生成 ${count} 题` },
  };
}

export async function listMarketMethodUploads(classId: string, method: string) {
  return read(classId).uploads.filter((item) => item.method === method);
}

export async function uploadMarketMethodFile(classId: string, method: string, file: File) {
  const saved = await uploadDemoFile(classId, file);
  const item: StoredUpload = {
    id: demoId(),
    originalFilename: saved.name || file.name,
    fileSize: file.size,
    createdAt: nowIso(),
    uploaderName: DEMO_STUDENT_NAME,
    uploadedBy: DEMO_STUDENT_ID,
    method,
    url: saved.url,
  };
  const bag = read(classId);
  bag.uploads = [item, ...bag.uploads];
  write(classId, bag);
  return { id: item.id };
}

export async function downloadMarketMethodFile(classId: string, uploadId: string, filename: string) {
  const item = read(classId).uploads.find((row) => row.id === uploadId);
  if (!item?.url) throw new Error('文件不存在');
  const a = document.createElement('a');
  a.href = item.url;
  a.download = filename || item.originalFilename;
  a.target = '_blank';
  a.click();
}

export async function deleteMarketMethodUpload(classId: string, uploadId: string) {
  const bag = read(classId);
  bag.uploads = bag.uploads.filter((item) => item.id !== uploadId);
  write(classId, bag);
}

export async function fetchMarketSurveyResponses(classId: string, surveyId: string) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  return {
    surveyTitle: survey?.title || '',
    questions: survey?.questions || [],
    responses: bag.responses[surveyId] || [],
  };
}

export async function deleteMarketSurveyResponse(classId: string, surveyId: string, responseId: string) {
  const bag = read(classId);
  const list = (bag.responses[surveyId] || []).filter((item) => item.id !== responseId);
  bag.responses[surveyId] = list;
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (survey) survey.collected = list.length;
  write(classId, bag);
  return { collected: list.length };
}

function analysisFromText(text: string, bag: MarketBag): MarketAnalysisResult {
  const collected = bag.surveys.reduce((sum, item) => sum + item.collected, 0);
  return {
    ...emptyAnalysis(),
    score: 78,
    conclusions: [text],
    suggestions: text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3),
    stats: {
      totalCollected: collected,
      validSamples: collected,
      activeSurveyCount: bag.surveys.filter((item) => item.status === '进行中').length,
    },
    keyFindings: [{ title: '调研结论', desc: text.slice(0, 180) }],
  };
}

export async function fetchMarketAnalysis(classId: string) {
  return read(classId).analysis;
}

export async function streamMarketAnalysis(
  classId: string,
  surveyIds: string[],
  handlers: {
    onStatus?: (message: string) => void;
    onThinking?: (text: string) => void;
    onContent?: (text: string) => void;
    onError?: (message: string) => void;
    onDone?: (result: MarketAnalysisResult) => void;
  }
) {
  try {
    handlers.onStatus?.('正在整理调研结论…');
    const bag = read(classId);
    const titles = bag.surveys.filter((item) => surveyIds.includes(item.id)).map((item) => item.title);
    const text = await generateDemoAi(classId, 'market-analysis', titles.join('、') || '请写一份课堂调研结论');
    handlers.onContent?.(text);
    const result = analysisFromText(text, bag);
    bag.analysis = { result, generatedAt: nowIso() };
    write(classId, bag);
    handlers.onDone?.(result);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function listMarketPersonas(classId: string) {
  return read(classId).personas;
}

export async function createMarketPersona(classId: string, payload: Omit<MarketPersona, 'id' | 'source'>) {
  const persona: MarketPersona = { ...payload, id: demoId(), source: 'manual' };
  const bag = read(classId);
  bag.personas = [persona, ...bag.personas];
  write(classId, bag);
  return persona;
}

export async function updateMarketPersona(classId: string, personaId: string, payload: Partial<MarketPersona>) {
  const bag = read(classId);
  const persona = bag.personas.find((item) => item.id === personaId);
  if (!persona) throw new Error('画像不存在');
  Object.assign(persona, payload, { id: personaId });
  write(classId, bag);
  return persona;
}

export async function deleteMarketPersona(classId: string, personaId: string) {
  const bag = read(classId);
  bag.personas = bag.personas.filter((item) => item.id !== personaId);
  write(classId, bag);
}

export async function streamGeneratePersonas(
  classId: string,
  _surveyIds: string[],
  handlers: {
    onStatus?: (message: string) => void;
    onThinking?: (text: string) => void;
    onContent?: (text: string) => void;
    onError?: (message: string) => void;
    onDone?: (personas: MarketPersona[]) => void;
  }
) {
  try {
    handlers.onStatus?.('正在生成用户画像…');
    const text = await generateDemoAi(classId, 'market-persona', '请生成 2 个课堂用用户画像');
    handlers.onContent?.(text);
    const parsed = (() => {
      try {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start < 0 || end <= start) return [];
        return JSON.parse(text.slice(start, end + 1)) as Partial<MarketPersona>[];
      } catch (e) {
        console.error('[classDemo] 画像解析失败', e);
        return [];
      }
    })();
    const personas: MarketPersona[] = (parsed.length ? parsed : [{ name: '演示用户', occupation: '学生' }]).map((item) => ({
      id: demoId(),
      name: String(item.name || '演示用户'),
      age: Number(item.age || 20),
      occupation: String(item.occupation || ''),
      major: String(item.major || ''),
      painPoints: Array.isArray(item.painPoints) ? item.painPoints.map(String) : [String(item.painPoints || text.slice(0, 40))],
      needs: Array.isArray(item.needs) ? item.needs.map(String) : [],
      habits: Array.isArray(item.habits) ? item.habits.map(String) : [],
      borderColor: '#22c55e',
      accentColor: '#16a34a',
      fromSurvey: true,
      source: 'ai',
    }));
    const bag = read(classId);
    bag.personas = [...personas, ...bag.personas];
    write(classId, bag);
    handlers.onDone?.(personas);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function listChallengeSessions(classId: string): Promise<ChallengeSessionRecord[]> {
  return read(classId).sessions.map((item) => ({
    id: item.id,
    studentId: DEMO_STUDENT_ID,
    studentName: DEMO_STUDENT_NAME,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    finalReport: item.finalReport,
  }));
}

export async function fetchMyLatestChallengeSession(classId: string) {
  return read(classId).sessions[0] || null;
}

export async function createChallengeSession(
  classId: string,
  payload: { projectInfo: Record<string, unknown>; selectedAgents: string[] }
) {
  const session: MyLatestChallengeSession = {
    id: demoId(),
    status: 'in_progress',
    projectInfo: payload.projectInfo,
    selectedAgents: payload.selectedAgents,
    rounds: [],
    finalReport: null,
    createdAt: nowIso(),
    completedAt: '',
  };
  const bag = read(classId);
  bag.sessions = [session, ...bag.sessions];
  write(classId, bag);
  return { sessionId: session.id, totalRounds: totalChallengeRounds(payload.selectedAgents.length), createdAt: session.createdAt };
}

export async function streamChallengeRound(
  classId: string,
  sessionId: string,
  payload: { roundIndex: number; answer?: string; agentId?: string },
  handlers: {
    onStatus?: (message: string) => void;
    onError?: (message: string) => void;
    onDone?: (data: { question: string; agentName: string; agentRole: string; briefFeedback?: string; roundIndex: number }) => void;
  }
) {
  try {
    handlers.onStatus?.('思考中…');
    const text = await generateDemoAi(classId, 'market-challenge', payload.answer || '请提出一个调研挑战问题');
    const bag = read(classId);
    const session = bag.sessions.find((item) => item.id === sessionId);
    const data = {
      question: text,
      agentName: '评审',
      agentRole: '挑剔的评审',
      briefFeedback: payload.answer ? '已收到你的回答。' : '',
      roundIndex: payload.roundIndex,
    };
    if (session) {
      session.rounds = [...session.rounds, { ...data, answer: payload.answer }];
      write(classId, bag);
    }
    handlers.onDone?.(data);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function streamChallengeFinalReport(
  classId: string,
  sessionId: string,
  answer: string,
  handlers: {
    onStatus?: (message: string) => void;
    onContent?: (text: string) => void;
    onError?: (message: string) => void;
    onDone?: (report: ChallengeFinalReport) => void;
  }
) {
  try {
    handlers.onStatus?.('正在生成挑战报告…');
    const text = await generateDemoAi(classId, 'market-challenge', answer || '请总结这场调研挑战');
    handlers.onContent?.(text);
    const report: ChallengeFinalReport = {
      totalScore: 80,
      strengths: ['能讲清调研目的'],
      weaknesses: text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3),
      suggestions: ['补一个可核对的样本说明'],
    };
    const bag = read(classId);
    const session = bag.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.finalReport = report;
      session.status = 'completed';
      session.completedAt = nowIso();
      write(classId, bag);
    }
    handlers.onDone?.(report);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function fetchTeamMarketReportUploadStatus(classId: string) {
  return read(classId).report;
}

export async function fetchTeamChallengeParticipation(classId: string) {
  const done = read(classId).sessions.some((item) => item.finalReport);
  return {
    members: [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME, hasChallengeSession: done }],
    missingMembers: [] as { id: string; name: string }[],
  };
}

export async function uploadTeamMarketReport(classId: string, body: { surveyIds: string[] }) {
  const bag = read(classId);
  bag.report = {
    uploaded: true,
    uploadedAt: nowIso(),
    uploadedBy: DEMO_STUDENT_NAME,
    payload: {
      surveyIds: body.surveyIds,
      personaIds: bag.personas.map((item) => item.id),
      analysisResult: bag.analysis.result || emptyAnalysis(),
      analysisGeneratedAt: bag.analysis.generatedAt,
    },
  };
  write(classId, bag);
  return { uploaded: true };
}
