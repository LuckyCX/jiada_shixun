import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  message,
  QRCode,
} from 'antd';
import VersionControl, { Version } from '../../../components/feature/VersionControl';
import MarketResearchMethodUpload from './MarketResearchMethodUpload';
import SurveyAIGenerateModal from './SurveyAIGenerateModal';
import SurveyEditorModal from './SurveyEditorModal';
import MarketResearchSurveySelectModal from './MarketResearchSurveySelectModal';
import SurveyResponsesModal from './SurveyResponsesModal';
import MarketAnalysisStreamPanel from './MarketAnalysisStreamPanel';
import ChallengeRecordsDialog from './ChallengeRecordsDialog';
import ChallengeTab from './ChallengeTab';
import {
  MARKET_PRESET_ROLES,
  MARKET_UPLOAD_METHODS,
  METHOD_FORMAT_GUIDES,
  filterPlanUploadMethods,
  buildPublicSurveyUrl,
  createMarketSurvey,
  deleteMarketSurvey,
  fetchMarketResearchPlan,
  listMarketSurveys,
  publishMarketSurvey,
  saveMarketResearchPlan,
  updateMarketSurvey,
  withdrawMarketSurvey,
  fetchMarketAnalysis,
  listMarketPersonas,
  createMarketPersona,
  updateMarketPersona,
  deleteMarketPersona,
  streamMarketAnalysis,
  streamGeneratePersonas,
  listChallengeSessions,
  listMarketMethodUploads,
  fetchTeamMarketReportUploadStatus,
  fetchTeamChallengeParticipation,
  uploadTeamMarketReport,
  type UploadTeamMarketReportError,
  type MarketAnalysisResult,
  type MarketPersona,
  type MarketPlanAssignment,
  type MarketResearchPlan,
  type MarketSurvey,
  type MarketTeamMember,
} from '../../../lib/studentMarketResearchApi';

// ─── Types ───────────────────────────────────────────────────────────────────
type Survey = MarketSurvey;
type SurveyQuestion = MarketSurvey['questions'][number];

interface ResearchPlan extends MarketResearchPlan {}

interface UserPersona extends MarketPersona {}

const PIE_PALETTE_GREEN = ['#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#10b981'];
const PIE_PALETTE_AMBER = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#d97706'];
const PIE_PALETTE_MIXED = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

function chartWithColors(items: { label: string; value: number }[], colors: string[]) {
  return items.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
}

// ─── Constants ───────────────────────────────────────────────────────────────
const METHODS = [...MARKET_UPLOAD_METHODS];

function presetAssignments(): MarketPlanAssignment[] {
  return MARKET_PRESET_ROLES.map((role) => ({ role, memberIds: [] }));
}

function emptyPlan(): ResearchPlan {
  return {
    goal: '',
    methods: [],
    startDate: '',
    endDate: '',
    assignments: presetAssignments(),
  };
}

function normalizeAssignments(raw: MarketPlanAssignment[] | undefined): MarketPlanAssignment[] {
  if (!raw?.length) return presetAssignments();
  const list = raw.map((a) => ({
    role: String(a.role || '').trim(),
    memberIds: Array.isArray(a.memberIds) ? [...a.memberIds] : [],
  }));
  return list.length > 0 ? list : presetAssignments();
}

const BORDER_COLORS = ['border-green-200', 'border-teal-200', 'border-pink-200', 'border-amber-200', 'border-orange-200'];
const ACCENT_COLORS = ['text-green-500', 'text-teal-500', 'text-pink-500', 'text-amber-500', 'text-orange-500'];

function personaInitial(name: string) {
  return [...(name || '用')][0] || '用';
}

// ─── SVG Charts ──────────────────────────────────────────────────────────────
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function PieChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  let cumulative = 0;
  const radius = 75;
  const cx = 95;
  const cy = 95;

  const slices = items.map((item) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += item.value;
    const endAngle = (cumulative / total) * 360;
    const start = polarToCartesian(cx, cy, radius, startAngle - 90);
    const end = polarToCartesian(cx, cy, radius, endAngle - 90);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    return { ...item, d, percent: Math.round((item.value / total) * 100) };
  });

  return (
    <div className="flex items-center gap-5">
      <svg width="190" height="190" viewBox="0 0 190 190" className="flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="2">
            <title>{s.label}: {s.percent}%</title>
          </path>
        ))}
      </svg>
      <div className="space-y-2 flex-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-gray-600 flex-1">{s.label}</span>
            <span className="text-xs font-bold text-gray-900">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-20 flex-shrink-0 text-right">{item.label}</span>
          <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-teal-400 rounded-lg flex items-center justify-end pr-2 transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%` }}
            >
              <span className="text-xs text-white font-bold">{item.value}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QRCodeModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = survey.link || (survey.publicSlug ? buildPublicSurveyUrl(survey.publicSlug) : '');

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">发放问卷</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 mb-4">扫描二维码填写问卷</p>
          <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
            {link ? <QRCode value={link} size={200} /> : null}
          </div>
          <p className="text-xs text-gray-400 mt-2">《{survey.title}》</p>
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">或复制链接发送给受访者</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <span className="flex-1 text-xs text-gray-600 truncate">{link}</span>
            <button
              onClick={handleCopy}
              disabled={!link}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${copied ? 'bg-green-500 text-white' : 'bg-green-500 text-white hover:bg-green-600 disabled:opacity-50'}`}
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Generate Persona Modal ────────────────────────────────────────────────
function AIGeneratePersonaModal({
  classId,
  surveyIds,
  totalCollected,
  onComplete,
  onClose,
}: {
  classId: string;
  surveyIds: string[];
  totalCollected: number;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [streamThinking, setStreamThinking] = useState('');
  const [generatedPersonas, setGeneratedPersonas] = useState<MarketPersona[]>([]);
  const [done, setDone] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setStreamThinking('');
    setStreamStatus('');
    setGeneratedPersonas([]);
    void streamGeneratePersonas(classId, surveyIds, {
      onStatus: setStreamStatus,
      onThinking: (t) => setStreamThinking((s) => s + t),
      onDone: (list) => {
        setGeneratedPersonas(list);
        setDone(true);
        setGenerating(false);
      },
      onError: (m) => {
        message.error(m);
        setGenerating(false);
      },
    }).catch((e) => {
      message.error(e instanceof Error ? e.message : '生成失败');
      setGenerating(false);
    });
  };

  const handleConfirm = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-xl">
              <i className="ri-robot-line text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">AI 生成用户画像</h3>
              <p className="text-xs text-gray-500 mt-0.5">基于调研数据智能生成典型用户画像</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1 px-6">
          {!done ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm mb-6">
                <i className="ri-database-2-line"></i>
                <span>问卷回收：<strong>{totalCollected}</strong> 份</span>
              </div>
              <MarketAnalysisStreamPanel
                visible={generating}
                status={streamStatus}
                thinking={streamThinking}
                content=""
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl disabled:opacity-60 cursor-pointer"
              >
                {generating ? '生成中…' : 'AI 一键生成画像'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {generatedPersonas.map((persona) => (
                  <div key={persona.id} className={`bg-white border-2 ${persona.borderColor} rounded-2xl p-6`}>
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-xl font-bold ${persona.accentColor}`}>
                        {personaInitial(persona.name)}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">{persona.name}</h4>
                        <p className="text-xs text-gray-600">{persona.age}岁 · {persona.occupation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {done && (
          <div className="p-6 border-t border-gray-100 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl cursor-pointer"
            >
              关闭
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl cursor-pointer"
            >
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Persona Modal ───────────────────────────────────────────────────────
function EditPersonaModal({ persona, onSave, onClose }: { persona: UserPersona; onSave: (p: UserPersona) => void; onClose: () => void }) {
  const [form, setForm] = useState<UserPersona>({ ...persona });
  const [saving, setSaving] = useState(false);

  const updateList = (field: 'painPoints' | 'needs' | 'habits', idx: number, val: string) => {
    const arr = [...form[field]];
    arr[idx] = val;
    setForm({ ...form, [field]: arr });
  };

  const addItem = (field: 'painPoints' | 'needs' | 'habits') => {
    setForm({ ...form, [field]: [...form[field], ''] });
  };

  const removeItem = (field: 'painPoints' | 'needs' | 'habits', idx: number) => {
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); onSave(form); }, 600);
  };

  const fieldLabels: Record<string, string> = { painPoints: '核心痛点', needs: '核心诉求', habits: '消费习惯' };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">编辑用户画像</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1 px-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '姓名', field: 'name' as const, type: 'text' },
              { label: '年龄', field: 'age' as const, type: 'number' },
              { label: '职业', field: 'occupation' as const, type: 'text' },
              { label: '专业', field: 'major' as const, type: 'text' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[field] as string | number}
                  onChange={(e) => setForm({ ...form, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
          {(['painPoints', 'needs', 'habits'] as const).map((field) => (
            <div key={field}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">{fieldLabels[field]}</label>
                <button onClick={() => addItem(field)} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer">
                  <i className="ri-add-line"></i>添加
                </button>
              </div>
              <div className="space-y-2">
                {form[field].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateList(field, idx, e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button onClick={() => removeItem(field, idx)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 rounded cursor-pointer">
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><i className="ri-loader-4-line animate-spin"></i>保存中...</> : <><i className="ri-save-line"></i>保存修改</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Persona Modal ─────────────────────────────────────────────────────
function CreatePersonaModal({ onSave, onClose }: { onSave: (p: Omit<UserPersona, 'id'>) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', age: 20, occupation: '', major: '', painPoints: [''], needs: [''], habits: [''] });

  const updateList = (field: 'painPoints' | 'needs' | 'habits', idx: number, val: string) => {
    const arr = [...form[field]];
    arr[idx] = val;
    setForm({ ...form, [field]: arr });
  };

  const addItem = (field: 'painPoints' | 'needs' | 'habits') => {
    setForm({ ...form, [field]: [...form[field], ''] });
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const colorIdx = Math.floor(Math.random() * BORDER_COLORS.length);
    const newPersona: Omit<UserPersona, 'id'> = {
      ...form,
      painPoints: form.painPoints.filter(Boolean),
      needs: form.needs.filter(Boolean),
      habits: form.habits.filter(Boolean),
      borderColor: BORDER_COLORS[colorIdx],
      accentColor: ACCENT_COLORS[colorIdx],
      fromSurvey: false,
    };
    onSave(newPersona);
  };

  const fieldLabels: Record<string, string> = { painPoints: '核心痛点', needs: '核心诉求', habits: '消费习惯' };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">创建新用户画像</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1 px-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '姓名 *', field: 'name' as const, type: 'text' },
              { label: '年龄', field: 'age' as const, type: 'number' },
              { label: '职业', field: 'occupation' as const, type: 'text' },
              { label: '专业', field: 'major' as const, type: 'text' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[field] as string | number}
                  onChange={(e) => setForm({ ...form, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
          {(['painPoints', 'needs', 'habits'] as const).map((field) => (
            <div key={field}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">{fieldLabels[field]}</label>
                <button onClick={() => addItem(field)} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer">
                  <i className="ri-add-line"></i>添加
                </button>
              </div>
              <div className="space-y-2">
                {form[field].map((item, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={item}
                    onChange={(e) => updateList(field, idx, e.target.value)}
                    placeholder={`输入${fieldLabels[field]}...`}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
          <button onClick={handleSave} disabled={!form.name.trim()} className="flex-1 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors cursor-pointer disabled:opacity-50">
            <i className="ri-add-line mr-1"></i>创建画像
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
type MarketResearchModuleProps = {
  classId?: string;
  isTeamLeader?: boolean;
  stagePeriod?: { startDate: string; deadlineDate: string } | null;
  teamMembers?: MarketTeamMember[];
  hasConfirmedTeam?: boolean;
  onTaskComplete?: () => void;
  studentMarketChallengeDone?: boolean;
  onMarketChallengeReportComplete?: () => void;
  onMarketTabProgress?: (doneCount: number, total?: number) => void;
  onTeamMarketReportUploaded?: () => void;
};

export default function MarketResearchModule({
  classId = '',
  isTeamLeader = false,
  stagePeriod: stagePeriodProp = null,
  teamMembers: teamMembersProp = [],
  hasConfirmedTeam = false,
  onTaskComplete,
  studentMarketChallengeDone = false,
  onMarketChallengeReportComplete,
  onMarketTabProgress,
  onTeamMarketReportUploaded,
}: MarketResearchModuleProps) {
  const [searchParams] = useSearchParams();
  const marketTabParam = searchParams.get('marketTab');
  const [activeTab, setActiveTab] = useState<
    'plan' | 'methods' | 'survey' | 'analysis' | 'persona' | 'challenge'
  >(marketTabParam === 'methods' ? 'methods' : marketTabParam === 'survey' ? 'survey' : 'plan');
  const [toast, setToast] = useState('');

  // Plan state
  const [plan, setPlan] = useState<ResearchPlan>(emptyPlan);
  const [planLoading, setPlanLoading] = useState(false);
  const [apiTeamMembers, setApiTeamMembers] = useState<MarketTeamMember[]>([]);
  const [apiStagePeriod, setApiStagePeriod] = useState<{ startDate: string; deadlineDate: string } | null>(null);
  const [apiIsTeamLeader, setApiIsTeamLeader] = useState(false);
  const [saving, setSaving] = useState(false);

  // Survey state
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [showQR, setShowQR] = useState<Survey | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [surveyEditor, setSurveyEditor] = useState<{
    mode: 'create' | 'edit' | 'view';
    survey: Survey | null;
  } | null>(null);
  const [surveySaving, setSurveySaving] = useState(false);
  const [responsesSurvey, setResponsesSurvey] = useState<Survey | null>(null);

  // Persona state
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(null);
  const [showCreatePersona, setShowCreatePersona] = useState(false);
  const [showAIGeneratePersona, setShowAIGeneratePersona] = useState(false);
  const [personaSurveyIds, setPersonaSurveyIds] = useState<string[]>([]);
  const [surveySelectMode, setSurveySelectMode] = useState<'analysis' | 'persona' | null>(null);

  const [analysisResult, setAnalysisResult] = useState<MarketAnalysisResult | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [analysisStreamStatus, setAnalysisStreamStatus] = useState('');
  const [analysisStreamThinking, setAnalysisStreamThinking] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const [challengeRecordsOpen, setChallengeRecordsOpen] = useState(false);
  const [challengeRecords, setChallengeRecords] = useState<Awaited<ReturnType<typeof listChallengeSessions>>>([]);
  const [challengeRecordsLoading, setChallengeRecordsLoading] = useState(false);
  const [hasMethodUpload, setHasMethodUpload] = useState(false);
  const [teamReportUploaded, setTeamReportUploaded] = useState(false);
  const [reportUploadModalOpen, setReportUploadModalOpen] = useState(false);
  const [reportUploading, setReportUploading] = useState(false);
  const [reportUploadSurveyIds, setReportUploadSurveyIds] = useState<string[]>([]);

  const totalCollected = surveys.reduce((s, sv) => s + sv.collected, 0);
  const activeSurveyCount = surveys.filter((s) => s.status === '进行中').length;
  const validSamplesDisplay =
    analysisResult?.stats?.validSamples != null ? `${analysisResult.stats.validSamples}份` : '—';

  const ageData = useMemo(
    () => chartWithColors(analysisResult?.charts?.ageDistribution ?? [], PIE_PALETTE_GREEN),
    [analysisResult]
  );
  const spendingData = useMemo(
    () => chartWithColors(analysisResult?.charts?.spendingDistribution ?? [], PIE_PALETTE_AMBER),
    [analysisResult]
  );
  const satisfactionData = useMemo(
    () => chartWithColors(analysisResult?.charts?.satisfactionDistribution ?? [], PIE_PALETTE_MIXED),
    [analysisResult]
  );
  const improvementData = useMemo(
    () => analysisResult?.charts?.improvementRanking ?? [],
    [analysisResult]
  );
  const hasChartData = useMemo(
    () =>
      Boolean(
        ageData.length ||
          spendingData.length ||
          satisfactionData.length ||
          improvementData.length
      ),
    [ageData.length, spendingData.length, satisfactionData.length, improvementData.length]
  );
  const keyFindings = analysisResult?.keyFindings ?? [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const teamMembers = apiTeamMembers.length ? apiTeamMembers : teamMembersProp;
  const stagePeriod = apiStagePeriod ?? stagePeriodProp;
  const canEditPlan = (apiTeamMembers.length ? apiIsTeamLeader : isTeamLeader) && hasConfirmedTeam;

  const loadPlan = useCallback(async () => {
    if (!classId || !hasConfirmedTeam) return;
    setPlanLoading(true);
    try {
      const res = await fetchMarketResearchPlan(classId);
      setApiTeamMembers(res.teamMembers || []);
      setApiStagePeriod(res.stagePeriod);
      setApiIsTeamLeader(res.isTeamLeader);
      if (res.plan) {
        setPlan({
          goal: res.plan.goal || '',
          methods: filterPlanUploadMethods(res.plan.methods || []),
          startDate: res.plan.startDate || '',
          endDate: res.plan.endDate || '',
          assignments: normalizeAssignments(res.plan.assignments),
          savedAt: res.plan.savedAt,
        });
      } else {
        setPlan(emptyPlan());
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载调研计划失败');
    } finally {
      setPlanLoading(false);
    }
  }, [classId, hasConfirmedTeam]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const loadSurveys = useCallback(async () => {
    if (!classId || !hasConfirmedTeam) {
      setSurveys([]);
      return;
    }
    setSurveysLoading(true);
    try {
      const list = await listMarketSurveys(classId);
      setSurveys(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载问卷失败');
      setSurveys([]);
    } finally {
      setSurveysLoading(false);
    }
  }, [classId, hasConfirmedTeam]);

  useEffect(() => {
    void loadSurveys();
  }, [loadSurveys]);

  const loadPersonas = useCallback(async () => {
    if (!classId || !hasConfirmedTeam) {
      setPersonas([]);
      return;
    }
    try {
      setPersonas(await listMarketPersonas(classId));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载画像失败');
      setPersonas([]);
    }
  }, [classId, hasConfirmedTeam]);

  useEffect(() => {
    void loadPersonas();
  }, [loadPersonas]);

  const loadStoredAnalysis = useCallback(async () => {
    if (!classId || !hasConfirmedTeam) {
      setAnalysisResult(null);
      return;
    }
    try {
      const { result } = await fetchMarketAnalysis(classId);
      setAnalysisResult(result);
    } catch {
      setAnalysisResult(null);
    }
  }, [classId, hasConfirmedTeam]);

  useEffect(() => {
    void loadStoredAnalysis();
  }, [loadStoredAnalysis]);

  const loadReportUploadStatus = useCallback(async () => {
    if (!classId || !hasConfirmedTeam) {
      setTeamReportUploaded(false);
      return;
    }
    try {
      const st = await fetchTeamMarketReportUploadStatus(classId);
      setTeamReportUploaded(Boolean(st.uploaded));
    } catch {
      setTeamReportUploaded(false);
    }
  }, [classId, hasConfirmedTeam]);

  useEffect(() => {
    void loadReportUploadStatus();
  }, [loadReportUploadStatus]);

  const formatMissingChallengeNames = (list: { id: string; name: string }[]) =>
    list.map((m) => m.name || m.id).join('、');

  const reportUploadDialogOkProps = {
    okText: '确定',
    okButtonProps: { className: '!bg-teal-500 !border-teal-500 hover:!bg-teal-600' },
  } as const;

  const showReportUploadDialog = (title: string, content: string) => {
    Modal.info({
      title,
      content,
      centered: true,
      ...reportUploadDialogOkProps,
    });
  };

  const showMissingChallengeDialog = (missingMembers: { id: string; name: string }[]) => {
    showReportUploadDialog(
      '无法上传调研报告',
      `小组成员 ${formatMissingChallengeNames(missingMembers)} 还未完成对抗优化分析，请先通知成员完成对抗优化分析吧。`
    );
  };

  const ensureAllMembersHaveChallengeSession = async (): Promise<boolean> => {
    if (!classId) return false;
    const { missingMembers } = await fetchTeamChallengeParticipation(classId);
    if (missingMembers.length) {
      showMissingChallengeDialog(missingMembers);
      return false;
    }
    return true;
  };

  const handleOpenReportUpload = async () => {
    if (!classId) return;
    if (!surveys.length) {
      showReportUploadDialog('无法上传调研报告', '请先在「线上问卷」中创建至少 1 份问卷。');
      return;
    }
    try {
      const okMembers = await ensureAllMembersHaveChallengeSession();
      if (!okMembers) return;
    } catch (e) {
      showReportUploadDialog('校验失败', e instanceof Error ? e.message : '请稍后重试');
      return;
    }
    setReportUploadSurveyIds(surveys.map((s) => s.id));
    setReportUploadModalOpen(true);
  };

  const handleConfirmReportUpload = async () => {
    if (!classId) return;
    if (reportUploadSurveyIds.length < 1) {
      showReportUploadDialog('无法上传调研报告', '请至少选择 1 份线上问卷调查记录。');
      return;
    }
    setReportUploading(true);
    try {
      const okMembers = await ensureAllMembersHaveChallengeSession();
      if (!okMembers) {
        setReportUploading(false);
        return;
      }
      await uploadTeamMarketReport(classId, { surveyIds: reportUploadSurveyIds });
      setTeamReportUploaded(true);
      setReportUploadModalOpen(false);
      showToast('调研报告已上传');
      onTeamMarketReportUploaded?.();
    } catch (e) {
      const err = e as UploadTeamMarketReportError;
      if (err.missingMembers?.length) {
        showMissingChallengeDialog(err.missingMembers);
      } else {
        showReportUploadDialog('上传失败', err.message || '请稍后重试');
      }
    } finally {
      setReportUploading(false);
    }
  };

  const openChallengeRecords = () => {
    if (!classId) return;
    setChallengeRecordsOpen(true);
    setChallengeRecordsLoading(true);
    void listChallengeSessions(classId)
      .then(setChallengeRecords)
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setChallengeRecordsLoading(false));
  };

  const planUploadMethods = useMemo(
    () => filterPlanUploadMethods(plan.methods),
    [plan.methods]
  );

  useEffect(() => {
    if (!classId || !planUploadMethods.length) {
      setHasMethodUpload(false);
      return;
    }
    void Promise.all(planUploadMethods.map((m) => listMarketMethodUploads(classId, m)))
      .then((lists) => setHasMethodUpload(lists.some((l) => l.length > 0)))
      .catch(() => setHasMethodUpload(false));
  }, [classId, planUploadMethods, activeTab]);

  useEffect(() => {
    if (!onMarketTabProgress) return;
    let done = 0;
    if (plan.savedAt) done += 1;
    if (hasMethodUpload) done += 1;
    if (surveys.length > 0) done += 1;
    if (teamReportUploaded) done += 1;
    if (personas.length > 0) done += 1;
    if (studentMarketChallengeDone) done += 1;
    onMarketTabProgress(done, 6);
  }, [
    plan.savedAt,
    hasMethodUpload,
    surveys.length,
    teamReportUploaded,
    personas.length,
    studentMarketChallengeDone,
    onMarketTabProgress,
  ]);

  // ── Plan handlers ──
  const handleSavePlan = async () => {
    if (!classId) return;
    if (!canEditPlan) {
      message.warning('仅队长可编辑调研计划');
      return;
    }
    if (!plan.goal.trim()) {
      message.warning('请填写调研目标');
      return;
    }
    if (!plan.methods.length) {
      message.warning('请至少选择一种调研方法');
      return;
    }
    if (!stagePeriod?.startDate || !stagePeriod?.deadlineDate) {
      message.warning('本实训环节尚未配置开始与结束时间，请联系教师');
      return;
    }
    if (!plan.assignments.length) {
      message.warning('请至少保留一项任务分工');
      return;
    }
    if (plan.assignments.some((a) => !a.role.trim())) {
      message.warning('请填写分工名称');
      return;
    }
    setSaving(true);
    try {
      const res = await saveMarketResearchPlan(classId, {
        ...plan,
        methods: filterPlanUploadMethods(plan.methods),
        startDate: stagePeriod.startDate,
        endDate: stagePeriod.deadlineDate,
      });
      if (res.plan) {
        setPlan({
          goal: res.plan.goal,
          methods: filterPlanUploadMethods(res.plan.methods),
          startDate: res.plan.startDate,
          endDate: res.plan.endDate,
          assignments: normalizeAssignments(res.plan.assignments),
          savedAt: res.plan.savedAt,
        });
      }
      message.success('调研计划已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateAssignmentRole = (index: number, role: string) => {
    if (!canEditPlan) return;
    setPlan({
      ...plan,
      assignments: plan.assignments.map((a, i) => (i === index ? { ...a, role } : a)),
    });
  };

  const updateAssignmentMembers = (index: number, memberIds: string[]) => {
    if (!canEditPlan) return;
    setPlan({
      ...plan,
      assignments: plan.assignments.map((a, i) => (i === index ? { ...a, memberIds } : a)),
    });
  };

  const addAssignment = () => {
    if (!canEditPlan) return;
    setPlan({ ...plan, assignments: [...plan.assignments, { role: '', memberIds: [] }] });
  };

  const removeAssignment = (index: number) => {
    if (!canEditPlan) return;
    if (plan.assignments.length <= 1) {
      message.warning('至少保留一项任务分工');
      return;
    }
    setPlan({ ...plan, assignments: plan.assignments.filter((_, i) => i !== index) });
  };

  // ── Survey handlers ──
  const handlePublish = async (id: string) => {
    if (!classId) return;
    try {
      const updated = await publishMarketSurvey(classId, id);
      setSurveys((prev) => prev.map((s) => (s.id === id ? updated : s)));
      showToast('问卷已发布');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发布失败');
    }
  };

  const handleWithdraw = async (id: string) => {
    if (!classId) return;
    try {
      const updated = await withdrawMarketSurvey(classId, id);
      setSurveys((prev) => prev.map((s) => (s.id === id ? updated : s)));
      showToast('问卷已撤回');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '撤回失败');
    }
  };

  const handleDeleteSurvey = async (id: string) => {
    if (!classId) return;
    try {
      await deleteMarketSurvey(classId, id);
      setSurveys((prev) => prev.filter((s) => s.id !== id));
      showToast('问卷已删除');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleViewSurveyDetail = (survey: Survey) => {
    const readOnly = survey.status === '进行中';
    setSurveyEditor({ mode: readOnly ? 'view' : 'edit', survey });
  };

  // ── Persona handlers ──
  const handleSaveEdit = async (updated: UserPersona) => {
    if (!classId) return;
    try {
      const saved = await updateMarketPersona(classId, updated.id, updated);
      setPersonas(personas.map((p) => (p.id === saved.id ? saved : p)));
      setEditingPersona(null);
      showToast('画像已更新');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const handleCreatePersona = async (newP: Omit<UserPersona, 'id'>) => {
    if (!classId) return;
    try {
      const saved = await createMarketPersona(classId, newP);
      setPersonas([...personas, saved]);
      setShowCreatePersona(false);
      showToast('新画像已创建');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!classId) return;
    try {
      await deleteMarketPersona(classId, id);
      setPersonas(personas.filter((p) => p.id !== id));
      showToast('画像已删除');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  // 版本控制状态
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [initialVersion, setInitialVersion] = useState<Version | null>(null);
  const initialVersionCapturedRef = useRef(false);

  // 保存当前版本
  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 2,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: {
        plan,
        surveys,
        personas,
        analysisResult,
      },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
    showToast('版本已保存');
  };

  // 回撤到指定版本
  const handleRestore = (versionId: string) => {
    const version =
      initialVersion?.id === versionId ? initialVersion : versions.find((v) => v.id === versionId);
    if (!version) return;
    
    const data = version.data;
    setPlan(data.plan ? { ...data.plan, assignments: normalizeAssignments(data.plan.assignments) } : emptyPlan());
    setSurveys(data.surveys || []);
    setPersonas(data.personas || []);
    setAnalysisResult(data.analysisResult ?? null);
    setCurrentVersion(version.versionNumber);
    showToast(`已回撤到版本 v${version.versionNumber}`);
  };

  // ── Export ──
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setExported(true);
      showToast('调研报告已导出 ✓');
      setTimeout(() => setExported(false), 3000);
    }, 1500);
  };

  useEffect(() => {
    initialVersionCapturedRef.current = false;
    setInitialVersion(null);
    setVersions([]);
    setCurrentVersion(1);
  }, [classId]);

  useEffect(() => {
    if (planLoading || initialVersionCapturedRef.current) return;
    if (!classId || !hasConfirmedTeam) return;
    initialVersionCapturedRef.current = true;
    setInitialVersion({
      id: 'version-initial-1',
      versionNumber: 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary: '初始版本',
      data: {
        plan,
        surveys,
        personas,
        analysisResult,
      },
    });
  }, [planLoading, classId, hasConfirmedTeam, plan, surveys, personas, analysisResult]);

  const tabs = [
    { key: 'plan' as const, label: '调研计划', icon: 'ri-file-list-3-line' },
    { key: 'methods' as const, label: '调研数据上传', icon: 'ri-upload-cloud-2-line' },
    { key: 'survey' as const, label: '线上问卷', icon: 'ri-questionnaire-line' },
    { key: 'persona' as const, label: '用户画像', icon: 'ri-user-heart-line' },
    { key: 'challenge' as const, label: '对抗优化分析', icon: 'ri-file-text-line' },
    { key: 'analysis' as const, label: '调研报告', icon: 'ri-bar-chart-box-line' },
  ];

  const runAiAnalysis = async (surveyIds: string[]) => {
    if (!classId) return;
    setIsAiAnalyzing(true);
    setAnalysisStreamThinking('');
    setAnalysisStreamStatus('');
    try {
      await streamMarketAnalysis(classId, surveyIds, {
        onStatus: setAnalysisStreamStatus,
        onThinking: (t) => setAnalysisStreamThinking((s) => s + t),
        onDone: (result) => {
          setAnalysisResult(result);
          showToast('分析完成');
        },
        onError: (m) => message.error(m),
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '分析失败');
    } finally {
      setIsAiAnalyzing(false);
      setAnalysisStreamStatus('');
    }
  };

  return (
    <div className="space-y-6">
      {/* 版本控制工具栏 */}
      <VersionControl
        enabled={false}
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="市场调研与用户画像"
        initialVersion={initialVersion}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2">
          <i className="ri-checkbox-circle-fill"></i>{toast}
        </div>
      )}

      {/* Modals */}
      {showQR && <QRCodeModal survey={showQR} onClose={() => setShowQR(null)} />}
      {classId && (
        <SurveyAIGenerateModal
          open={showAI}
          classId={classId}
          plan={plan}
          stageDeadlineDate={stagePeriod?.deadlineDate ?? null}
          onClose={() => setShowAI(false)}
          onCreated={() => void loadSurveys()}
        />
      )}
      <MarketResearchSurveySelectModal
        open={surveySelectMode !== null}
        title={surveySelectMode === 'persona' ? '选择问卷生成用户画像' : '选择问卷进行数据分析'}
        surveys={surveys}
        onCancel={() => setSurveySelectMode(null)}
        onConfirm={(ids) => {
          setSurveySelectMode(null);
          if (surveySelectMode === 'analysis') {
            void runAiAnalysis(ids);
          } else if (surveySelectMode === 'persona') {
            setPersonaSurveyIds(ids);
            setShowAIGeneratePersona(true);
          }
        }}
      />
      {surveyEditor && (
        <SurveyEditorModal
          open
          readOnly={surveyEditor.mode === 'view'}
          title={
            surveyEditor.mode === 'create'
              ? '创建问卷'
              : surveyEditor.mode === 'view'
                ? '查看问卷'
                : '编辑问卷'
          }
          initialTitle={surveyEditor.survey?.title || ''}
          initialQuestions={surveyEditor.survey?.questions || []}
          initialClosesAt={surveyEditor.survey?.closesAt ?? null}
          stageDeadlineDate={stagePeriod?.deadlineDate ?? null}
          saving={surveySaving}
          onCancel={() => setSurveyEditor(null)}
          onSave={
            surveyEditor.mode === 'view'
              ? undefined
              : async (payload) => {
                  if (!classId) return;
                  setSurveySaving(true);
                  try {
                    if (surveyEditor.mode === 'create') {
                      await createMarketSurvey(classId, {
                        title: payload.title,
                        questions: payload.questions,
                        closesAt: payload.closesAt,
                        source: 'manual',
                      });
                      showToast('问卷已创建');
                    } else if (surveyEditor.survey) {
                      await updateMarketSurvey(classId, surveyEditor.survey.id, payload);
                      showToast('问卷已保存');
                    }
                    setSurveyEditor(null);
                    await loadSurveys();
                  } catch (e) {
                    message.error(e instanceof Error ? e.message : '保存失败');
                  } finally {
                    setSurveySaving(false);
                  }
                }
          }
        />
      )}
      {classId && (
        <SurveyResponsesModal
          open={!!responsesSurvey}
          classId={classId}
          survey={responsesSurvey}
          onClose={() => setResponsesSurvey(null)}
          onCollectedChange={(surveyId, collected) => {
            setSurveys((prev) => prev.map((s) => (s.id === surveyId ? { ...s, collected } : s)));
          }}
        />
      )}
      {editingPersona && <EditPersonaModal persona={editingPersona} onSave={handleSaveEdit} onClose={() => setEditingPersona(null)} />}
      {showCreatePersona && <CreatePersonaModal onSave={handleCreatePersona} onClose={() => setShowCreatePersona(false)} />}
      {showAIGeneratePersona && classId && personaSurveyIds.length > 0 && (
        <AIGeneratePersonaModal
          classId={classId}
          surveyIds={personaSurveyIds}
          totalCollected={totalCollected}
          onComplete={() => void loadPersonas()}
          onClose={() => {
            setShowAIGeneratePersona(false);
            setPersonaSurveyIds([]);
          }}
        />
      )}
      <ChallengeRecordsDialog
        open={challengeRecordsOpen}
        loading={challengeRecordsLoading}
        records={challengeRecords}
        onClose={() => setChallengeRecordsOpen(false)}
      />

      <Modal
        title="上传调研报告"
        open={reportUploadModalOpen}
        onCancel={() => {
          if (!reportUploading) setReportUploadModalOpen(false);
        }}
        footer={
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={reportUploading}
              onClick={() => setReportUploadModalOpen(false)}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={reportUploading || reportUploadSurveyIds.length < 1}
              onClick={() => void handleConfirmReportUpload()}
              className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-teal-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {reportUploading ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  上传中…
                </>
              ) : (
                '确认上传'
              )}
            </button>
          </div>
        }
        destroyOnClose
      >
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          确认上传后，将提交本小组以下数据，用于完成市场调研环节并解锁下一实训流程（需满足流程开始时间）：
        </p>
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-800 mb-2">线上问卷调查记录（至少选择 1 份）</p>
          <Checkbox.Group
            className="flex flex-col gap-2"
            value={reportUploadSurveyIds}
            onChange={(vals) => setReportUploadSurveyIds(vals as string[])}
          >
            {surveys.map((s) => (
              <Checkbox key={s.id} value={s.id}>
                <span className="text-sm text-gray-700">{s.title}</span>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>用户画像（当前 {personas.length} 个，将全部上传）</li>
          <li>调研报告（AI 分析结果）</li>
        </ul>
      </Modal>

      {/* Module Header */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl px-8 py-4 text-white">
        <div className="flex items-start justify-between  ">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="ri-bar-chart-line text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">市场调研与用户画像</h2>
              <p className="text-white/80 text-sm">通过真实调研验证用户需求，构建典型用户画像</p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/20 text-white whitespace-nowrap">
            <i className="ri-play-circle-fill mr-1.5"></i>进行中
          </span>
        </div>
        {/* <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">6/8</div>
            <div className="text-sm text-white/70">知识点完成</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">4/5</div>
            <div className="text-sm text-white/70">任务完成</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">75%</div>
            <div className="text-sm text-white/70">整体进度</div>
          </div>
        </div> */}
      </div>

      {/* Data flow hint */}
      {/* <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <i className="ri-links-line text-green-400 text-base"></i>
        <span>数据流向：</span>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">调研计划</span>
        <i className="ri-arrow-right-line"></i>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">调研数据上传</span>
        <i className="ri-arrow-right-line"></i>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">AI生成问卷</span>
        <i className="ri-arrow-right-line"></i>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">数据分析图表</span>
        <i className="ri-arrow-right-line"></i>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">用户画像</span>
      </div> */}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer min-w-[100px] ${
                activeTab === tab.key
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">

          {/* ══ 调研计划 ══ */}
          {activeTab === 'plan' && (
            <Spin spinning={planLoading}>
              <div className="space-y-6">
                {!hasConfirmedTeam && (
                  <Alert type="warning" showIcon message="请先完成组队并等待教师确认后再制定调研计划" />
                )}
                {hasConfirmedTeam && !canEditPlan && (
                  <Alert type="info" showIcon message="仅队长可编辑调研计划，当前为查看模式" />
                )}
                {hasConfirmedTeam && !stagePeriod && (
                  <Alert type="warning" showIcon message="市场调研环节尚未配置开始与结束时间，请联系教师配置" />
                )}
                {stagePeriod && (
                  <Alert
                    type="info"
                    showIcon
                    message={`本环节时间范围：${stagePeriod.startDate} 至 ${stagePeriod.deadlineDate}`}
                  />
                )}

                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-green-900 mb-3">调研计划制定指南</h3>
                  <ul className="text-sm text-green-700 space-y-2">
                    <li>• 明确调研目标：围绕核心创意，了解市场需求、竞争情况</li>
                    <li>• 选择调研方法：访谈、竞品分析、行业报告等（线上问卷在后续步骤完成）</li>
                    <li>• 明确成员分工：可自定义分工项并指定负责成员</li>
                    <li>• 计划时间以本实训环节的开始、结束日期为准</li>
                  </ul>
                </div>

                {plan.savedAt && (
                  <Alert type="success" showIcon message={`计划已保存于 ${plan.savedAt}`} />
                )}

                <Form layout="vertical" disabled={!canEditPlan || !hasConfirmedTeam}>
                  <Form.Item label="调研目标" required>
                    <Input.TextArea
                      value={plan.goal}
                      onChange={(e) => setPlan({ ...plan, goal: e.target.value })}
                      placeholder="描述本次调研的核心目标和期望获得的信息"
                      rows={4}
                    />
                  </Form.Item>

                  <Form.Item label="调研数据上传" required>
                    <Checkbox.Group
                      value={plan.methods}
                      onChange={(vals) => setPlan({ ...plan, methods: vals as string[] })}
                      className="w-full"
                    >
                      <div className="grid md:grid-cols-3 gap-3 w-full">
                        {METHODS.map((method) => (
                          <Checkbox key={method} value={method} className="!ml-0 border border-gray-200 rounded-lg px-4 py-3">
                            {method}
                          </Checkbox>
                        ))}
                      </div>
                    </Checkbox.Group>
                  </Form.Item>

                  <Form.Item
                    className="[&_.ant-form-item-label]:!max-w-full [&_.ant-form-item-label>label]:!w-full"
                    label={
                      <div className="flex w-full items-center">
                        <span>任务分工</span>
                        {canEditPlan && (
                          <Button
                            type="link"
                            size="small"
                            onClick={addAssignment}
                            className="!px-0 ml-auto"
                          >
                            添加分工
                          </Button>
                        )}
                      </div>
                    }
                  >
                    <div className="space-y-3">
                      {plan.assignments.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <Input
                            className="sm:w-40 flex-shrink-0"
                            placeholder="分工名称"
                            value={item.role}
                            onChange={(e) => updateAssignmentRole(index, e.target.value)}
                            disabled={!canEditPlan}
                          />
                          <Select
                            mode="multiple"
                            className="flex-1"
                            placeholder="选择成员（可多选）"
                            value={item.memberIds}
                            onChange={(ids) => updateAssignmentMembers(index, ids)}
                            options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
                            disabled={!canEditPlan}
                          />
                          {canEditPlan && (
                            <Button
                              type="text"
                              danger
                              icon={<i className="ri-delete-bin-line" />}
                              onClick={() => removeAssignment(index)}
                              disabled={plan.assignments.length <= 1}
                              aria-label="删除分工"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </Form.Item>
                </Form>

                {canEditPlan && (
                  <Button
                    type="primary"
                    block
                    size="large"
                    loading={saving}
                    disabled={!stagePeriod}
                    onClick={() => void handleSavePlan()}
                    className="!bg-green-500 hover:!bg-green-600"
                  >
                    保存调研计划
                  </Button>
                )}
              </div>
            </Spin>
          )}

          {/* ══ 调研数据上传 ══ */}
          {activeTab === 'methods' && (
            <div className="space-y-6">
              {!plan.savedAt ? (
                <Alert type="warning" showIcon message="请队长先在「调研计划」中保存计划后再上传调研数据" />
              ) : (
                <>
                  {!planUploadMethods.length && (
                    <Alert type="info" showIcon message="调研计划中未选择调研方法" />
                  )}
                  {planUploadMethods.length > 0 && classId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {planUploadMethods.map((method) => {
                        const guide = METHOD_FORMAT_GUIDES[method];
                        return (
                          <div
                            key={method}
                            className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col min-h-[280px]"
                          >
                            <h3 className="text-base font-bold text-gray-900 mb-2">{method}</h3>
                            {guide && (
                              <p className="text-xs text-gray-500 mb-4 line-clamp-2">{guide.title}</p>
                            )}
                            <div className="mt-auto pt-2 border-t border-gray-100">
                              <MarketResearchMethodUpload classId={classId} method={method} compact />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ 线上问卷 ══ */}
          {activeTab === 'survey' && (
            <div className="space-y-8">
              {!plan.savedAt ? (
                <Alert type="warning" showIcon message="请队长先在「调研计划」中保存计划后再开展线上问卷" />
              ) : (
                <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">问卷管理</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAI(true)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer flex items-center gap-2"
                  >
                    <i className="ri-robot-line"></i>AI 生成问卷
                  </button>
                  <button
                    onClick={() => setSurveyEditor({ mode: 'create', survey: null })}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-add-line mr-1"></i>手动创建
                  </button>
                </div>
              </div>

              <Spin spinning={surveysLoading}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!surveysLoading && surveys.length === 0 && (
                  <div className="md:col-span-2">
                    <Alert type="info" showIcon message="暂无问卷，请使用 AI 生成或手动创建" />
                  </div>
                )}
                {surveys.map((survey) => (
                  <div key={survey.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-gray-900">{survey.title}</h4>
                        {survey.fromPlan && (
                          <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full whitespace-nowrap">
                            <i className="ri-robot-line mr-1"></i>AI生成
                          </span>
                        )}
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                        survey.status === '进行中' ? 'bg-green-100 text-green-700'
                          : survey.status === '已撤回' ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {survey.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">题目数量</span>
                        <span className="font-medium text-gray-900">{survey.questions.length}题</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">已回收</span>
                        {survey.collected > 0 ? (
                          <button
                            type="button"
                            onClick={() => setResponsesSurvey(survey)}
                            className="font-medium text-green-600 hover:text-green-700 hover:underline cursor-pointer"
                          >
                            {survey.collected}份
                          </button>
                        ) : (
                          <span className="font-medium text-gray-900">0份</span>
                        )}
                      </div>
                      {survey.publishedAtDisplay && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">发布时间</span>
                          <span className="font-medium text-gray-900">{survey.publishedAtDisplay}</span>
                        </div>
                      )}
                      {survey.closesAtDisplay && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">截止时间</span>
                          <span className="font-medium text-gray-900">{survey.closesAtDisplay}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                      {survey.status === '草稿' && (
                        <>
                          <button
                            onClick={() => void handlePublish(survey.id)}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            发布问卷
                          </button>
                          <button
                            onClick={() => setSurveyEditor({ mode: 'edit', survey })}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => void handleDeleteSurvey(survey.id)}
                            className="px-4 py-2 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            删除
                          </button>
                        </>
                      )}
                      {survey.status === '已撤回' && (
                        <>
                          <button
                            onClick={() => void handlePublish(survey.id)}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            再次发布
                          </button>
                          <button
                            onClick={() => setSurveyEditor({ mode: 'edit', survey })}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => void handleDeleteSurvey(survey.id)}
                            className="px-4 py-2 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            删除
                          </button>
                        </>
                      )}
                      {survey.status === '进行中' && (
                        <>
                          <button
                            onClick={() => handleViewSurveyDetail(survey)}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-eye-line mr-1"></i>查看详情
                          </button>
                          <button
                            onClick={() => setShowQR(survey)}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                          >
                            <i className="ri-qr-code-line"></i>发放问卷
                          </button>
                          <button
                            onClick={() => void handleWithdraw(survey.id)}
                            className="px-4 py-2 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            撤回
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </Spin>
                </>
              )}
            </div>
          )}

          {/* ══ 数据分析 ══ */}
          {activeTab === 'analysis' && (
            <div className="space-y-8">
              <div className="flex justify-end">
                <button
                  onClick={() => setSurveySelectMode('analysis')}
                  disabled={isAiAnalyzing}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-lg cursor-pointer disabled:opacity-60 flex items-center gap-2 whitespace-nowrap"
                >
                  {isAiAnalyzing ? (
                    <><i className="ri-loader-4-line animate-spin"></i>AI分析中...</>
                  ) : (
                    <><i className="ri-sparkling-fill"></i>一键AI分析</>
                  )}
                </button>
              </div>

              <MarketAnalysisStreamPanel
                visible={isAiAnalyzing}
                status={analysisStreamStatus}
                thinking={analysisStreamThinking}
                content=""
              />

              {!analysisResult && !isAiAnalyzing && (
                <p className="text-sm text-gray-500 text-center py-12">请点击「一键 AI 分析」生成调研数据分析报告</p>
              )}

              {analysisResult && !isAiAnalyzing && (
                <>
              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6 border-2 border-green-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        {analysisResult.score}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                          <i className="ri-sparkling-fill text-green-600"></i>
                          AI智能分析报告
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">基于 {analysisResult.stats.totalCollected} 份问卷数据生成</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnalysisExpanded((v) => !v)}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      <i className={`ri-arrow-${analysisExpanded ? 'up' : 'down'}-s-line text-xl`}></i>
                    </button>
                  </div>
                  {analysisExpanded && (
                    <div className="space-y-4 mt-4">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">核心结论</h4>
                        {analysisResult.conclusions.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg p-3 mb-2 text-sm text-gray-700">
                            <span className="text-green-600 font-semibold">{i + 1}.</span>{c}
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">市场机会</h4>
                        {analysisResult.opportunities.map((o, i) => (
                          <div key={i} className="bg-green-50 rounded-lg p-3 mb-2 text-sm text-gray-700">{o}</div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">风险提示</h4>
                        {analysisResult.risks.map((r, i) => (
                          <div key={i} className="bg-orange-50 rounded-lg p-3 mb-2 text-sm text-gray-700">{r}</div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">优化建议</h4>
                        {analysisResult.suggestions.map((s, i) => (
                          <div key={i} className="bg-teal-50 rounded-lg p-3 mb-2 text-sm text-gray-700">{s}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">问卷回收</span>
                    <i className="ri-file-list-3-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">{analysisResult.stats.totalCollected}份</div>
                  <div className="text-xs text-white/80">来自 {analysisResult.stats.activeSurveyCount} 份进行中问卷</div>
                </div>
                <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">有效样本</span>
                    <i className="ri-checkbox-circle-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {analysisResult.stats.validSamples != null ? `${analysisResult.stats.validSamples}份` : '—'}
                  </div>
                </div>
              </div>

              {!hasChartData ? (
                <Alert
                  type="info"
                  showIcon
                  message="暂无统计图表"
                  description="当前所选问卷回收量较少，或题目中未包含可对应年龄、消费、满意度等维度的选择题统计；详细结论见上方 AI 分析报告。"
                />
              ) : (
                <>
              <div className="grid md:grid-cols-2 gap-6">
                {ageData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">年龄分布</h3>
                  <PieChart items={ageData} />
                </div>
                )}
                {spendingData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">月均消费分布</h3>
                  <PieChart items={spendingData} />
                </div>
                )}
              </div>

              {satisfactionData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">满意度分布</h3>
                <PieChart items={satisfactionData} />
              </div>
              )}

              {improvementData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-gray-900 mb-6">用户改进需求排行</h3>
                <BarChart items={improvementData} />
              </div>
              )}
                </>
              )}

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">核心发现</h3>
                {keyFindings.length ? (
                  <div className="space-y-4">
                    {keyFindings.map((item, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-green-100 text-green-600 rounded-lg flex-shrink-0">
                          <i className="ri-check-line text-lg"></i>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h4>
                          <p className="text-sm text-gray-600">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">暂无数据</p>
                )}
              </div>

              {canEditPlan && (
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  {teamReportUploaded ? (
                    <span className="text-sm text-green-600 font-medium">
                      <i className="ri-checkbox-circle-fill mr-1" />
                      调研报告已上传
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!analysisResult}
                      onClick={() => void handleOpenReportUpload()}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上传调研报告
                    </button>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* ══ 用户画像 ══ */}
          {activeTab === 'persona' && (
            <div className="space-y-8">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-sm text-green-700">
                  <i className="ri-information-line mr-2"></i>
                  用户画像数据来源于问卷调查和数据分析模块，悬停卡片可编辑或删除画像
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {!personas.length && (
                  <p className="text-sm text-gray-500 col-span-2">暂无用户画像</p>
                )}
                {personas.map((persona) => (
                  <div key={persona.id} className={`bg-white border-2 ${persona.borderColor} rounded-2xl p-8 relative group`}>
                    {/* Action buttons */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingPersona(persona)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                        title="编辑画像"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                      <button
                        onClick={() => void handleDeletePersona(persona.id)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                        title="删除画像"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>

                    <div className="flex items-start gap-6 mb-6">
                      <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center text-3xl font-bold ${persona.accentColor} border-4 border-gray-100 flex-shrink-0`}>
                        {personaInitial(persona.name)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-2xl font-bold text-gray-900">{persona.name}</h3>
                          {persona.fromSurvey && (
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full whitespace-nowrap">
                              <i className="ri-survey-line mr-1"></i>来自调研
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong className="text-gray-900">年龄：</strong>{persona.age}岁</p>
                          <p><strong className="text-gray-900">职业：</strong>{persona.occupation}</p>
                          <p><strong className="text-gray-900">专业：</strong>{persona.major}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        { field: 'painPoints' as const, label: '核心痛点', icon: 'ri-heart-pulse-line' },
                        { field: 'needs' as const, label: '核心诉求', icon: 'ri-star-line' },
                        { field: 'habits' as const, label: '消费习惯', icon: 'ri-shopping-bag-line' },
                      ].map(({ field, label, icon }) => (
                        <div key={field}>
                          <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <i className={`${icon} ${persona.accentColor}`}></i>
                            {label}
                          </h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {persona[field].filter(Boolean).map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setEditingPersona(persona)}
                      className="mt-6 w-full py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-green-300 hover:text-green-600 transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="ri-edit-line"></i>编辑此画像
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setSurveySelectMode('persona')}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-robot-line"></i>AI 生成画像
                </button>
                <button
                  onClick={() => setShowCreatePersona(true)}
                  className="flex-1 px-6 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="ri-add-line"></i>手动创建画像
                </button>
                {/* <button
                  onClick={() => showToast('用户画像已导出 ✓')}
                  className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-download-line"></i>导出画像
                </button> */}
              </div>
            </div>
          )}

          {/* ══ 人机对抗 ══ */}
          {activeTab === 'challenge' && (
            <div className="space-y-4">
              {classId ? (
                <ChallengeTab
                  classId={classId}
                  personas={personas}
                  onOpenRecords={openChallengeRecords}
                  onMarketChallengeReportComplete={onMarketChallengeReportComplete}
                />
              ) : null}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
