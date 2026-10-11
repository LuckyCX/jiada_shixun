import { useEffect, useState } from 'react';
import { Button, Checkbox, InputNumber, Modal, message } from 'antd';
import {
  SURVEY_QUESTION_TYPES,
  createMarketSurvey,
  generateMarketSurveyByAi,
  type MarketResearchPlan,
  type MarketSurveyQuestion,
  type SurveyQuestionType,
} from '../demoMarketApi';
import SurveyEditorModal from './SurveyEditorModal';

type Props = {
  open: boolean;
  classId: string;
  plan: MarketResearchPlan;
  stageDeadlineDate?: string | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function SurveyAIGenerateModal({
  open,
  classId,
  plan,
  stageDeadlineDate = null,
  onClose,
  onCreated,
}: Props) {
  // 最少 4 道（含数据分析所需的 4 道统计维度题），最多 20 道
  const [questionCount, setQuestionCount] = useState(8);
  const [includeTypes, setIncludeTypes] = useState<SurveyQuestionType[]>(['单选', '多选', '评分', '填空']);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<MarketSurveyQuestion[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setEditorOpen(false);
    setTitle('');
    setQuestions([]);
    setGenerating(false);
    setSaving(false);
  }, [open]);

  const handleGenerate = async () => {
    if (!includeTypes.length) {
      message.warning('请至少选择一种题型');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateMarketSurveyByAi(classId, { questionCount, includeTypes });
      setTitle(res.title);
      setQuestions(res.questions);
      setEditorOpen(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmCreate = async (payload: {
    title: string;
    questions: { text: string; type: SurveyQuestionType; options: string[] }[];
    closesAt: string;
  }) => {
    setSaving(true);
    try {
      await createMarketSurvey(classId, {
        title: payload.title,
        questions: payload.questions.map(({ text, type, options }) => ({ text, type, options: options || [] })),
        source: 'ai',
        closesAt: payload.closesAt,
      });
      message.success('问卷已创建');
      onCreated();
      setEditorOpen(false);
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        title="AI 协助生成问卷"
        open={open && !editorOpen}
        onCancel={onClose}
        width={640}
        footer={[
          <Button key="cancel" onClick={onClose}>
            取消
          </Button>,
          <Button
            key="gen"
            type="primary"
            loading={generating}
            onClick={() => void handleGenerate()}
          >
            AI 生成
          </Button>,
        ]}
        destroyOnClose
      >
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-medium text-green-700 mb-1">基于调研计划</p>
            <p className="text-sm text-green-800">{plan.goal.trim() || '课堂演示：可直接生成问卷，不要求先保存计划'}</p>
          </div>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">题目数量</div>
            <InputNumber
              min={4}
              max={20}
              value={questionCount}
              onChange={(v) => setQuestionCount(Math.min(20, Math.max(4, Number(v) || 4)))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1 mb-0">至少 4 道（含年龄/消费/满意度/改进等统计维度题）</p>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">包含题型</div>
            <Checkbox.Group
              options={SURVEY_QUESTION_TYPES.map((t) => ({ label: t, value: t }))}
              value={includeTypes}
              onChange={(vals) => setIncludeTypes(vals as SurveyQuestionType[])}
            />
          </div>
        </div>
      </Modal>
      <SurveyEditorModal
        open={editorOpen}
        title="创建问卷"
        initialTitle={title}
        initialQuestions={questions}
        stageDeadlineDate={stageDeadlineDate}
        saveButtonLabel="确认创建问卷"
        saving={saving}
        onCancel={() => setEditorOpen(false)}
        onSave={handleConfirmCreate}
      />
    </>
  );
}
