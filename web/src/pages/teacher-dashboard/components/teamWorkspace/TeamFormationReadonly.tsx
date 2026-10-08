/**
 * 组队环节只读视图：样式与交互布局对齐学生端 TeamFormationAssessmentPanel
 * （选项按钮、AI 结果绿卡、三维度进度条），控件全部禁用不可改。
 */
import {
  TEAM_DIMENSION_BARS,
  normalizeTeamDimensionProfile,
  type TeamDimensionProfile,
} from '../../../../lib/teamFormationApi';

type AnswerItem = {
  questionId: string;
  index: number;
  title: string;
  questionType: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  displayText: string;
};

type MemberSubmission = {
  studentId: string;
  studentName: string;
  statusLabel?: string;
  groupingPreferenceLabel?: string;
  aiMatchedRoleLabel?: string;
  dimensionProfile?: Partial<TeamDimensionProfile>;
  analysisText?: string;
  answerItems?: AnswerItem[];
  hasIntroVideo?: boolean;
  introVideoUrl?: string;
  updatedAt?: string;
};

function DimensionBars({ profile }: { profile: TeamDimensionProfile }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-4 max-w-md text-left">
      {TEAM_DIMENSION_BARS.map((item) => (
        <div key={item.key} className="bg-white rounded-lg p-2.5 border border-orange-100">
          <p className="text-xs text-gray-500 mb-1">{item.label}</p>
          <p className="text-sm font-bold text-gray-900 mb-1.5">{profile[item.key]}</p>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
              style={{ width: `${Math.min(100, profile[item.key])}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 单题只读：复刻学生端选项卡片样式（选中 teal 边框），不可点击修改 */
function QuestionReadonly({ item }: { item: AnswerItem }) {
  const selected = new Set((item.selectedValues || []).map(String));
  const isShort = item.questionType === 'short' || !item.options?.length;

  return (
    <div className="flex-1 bg-white border-2 border-gray-100 rounded-xl p-5">
      <span className="inline-block px-2.5 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full mb-4">
        问题 {item.index}
      </span>
      <h3 className="text-base font-bold text-gray-900 mb-5">{item.title}</h3>
      {isShort ? (
        <div className="w-full min-h-[6rem] p-3.5 text-left border-2 border-teal-500 bg-teal-50 rounded-xl">
          <span className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {item.displayText || '未作答'}
          </span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {item.options.map((option, index) => {
            const on = selected.has(String(option.value)) || selected.has(String(option.label));
            return (
              <div
                key={index}
                className={`w-full p-3.5 text-left border-2 rounded-xl ${
                  on ? 'border-teal-500 bg-teal-50' : 'border-gray-200 opacity-70'
                }`}
              >
                <span className="text-sm text-gray-800">{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TeamFormationReadonly({ member }: { member: MemberSubmission }) {
  const profile = normalizeTeamDimensionProfile(member.dimensionProfile || {});
  const roleLabel = member.aiMatchedRoleLabel || '—';
  const hasAi = Boolean(member.aiMatchedRoleLabel || member.analysisText);
  const items = Array.isArray(member.answerItems) ? member.answerItems : [];

  return (
    <div className="space-y-5">
      <div className="text-xs text-gray-500">
        {member.statusLabel || '—'}
        {member.groupingPreferenceLabel && member.groupingPreferenceLabel !== '—'
          ? ` · ${member.groupingPreferenceLabel}`
          : ''}
        {member.updatedAt ? ` · 更新于 ${member.updatedAt}` : ''}
      </div>

      {hasAi ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-5 text-white">
            <h3 className="text-base font-bold">AI 分析完成</h3>
            <p className="text-sm mt-2">匹配角色：{roleLabel}</p>
          </div>
          <DimensionBars profile={profile} />
           
        </div>
      ) : (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 text-center">
          <i className="ri-time-line text-3xl text-amber-500 mb-2 block" />
          <p className="text-sm text-gray-700">尚未完成 AI 角色分析</p>
        </div>
      )}

      {items.length ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-800">能力测评问卷</p>
          {items.map((item) => (
            <QuestionReadonly key={item.questionId} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">暂无测评作答</p>
      )}

      {member.hasIntroVideo && member.introVideoUrl ? (
        <a
          href={member.introVideoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-teal-600 hover:underline"
        >
          <i className="ri-video-line" /> 查看介绍视频
        </a>
      ) : (
        <p className="text-xs text-gray-400">无介绍视频</p>
      )}
    </div>
  );
}
