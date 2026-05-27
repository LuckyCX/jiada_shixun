import { useState } from 'react';
import { Alert, Button, Checkbox, Collapse, Input, InputNumber, Modal, message } from 'antd';
import dayjs from 'dayjs';
import {
  SURVEY_QUESTION_TYPES,
  createMarketSurvey,
  generateMarketSurveyByAi,
  type MarketResearchPlan,
  type MarketSurveyQuestion,
  type SurveyPromptEcho,
  type SurveyQuestionType,
} from '../../../lib/studentMarketResearchApi';
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
  const [title, setTitle] = useState('');
  const [questionCount, setQuestionCount] = useState(12);
  const [includeTypes, setIncludeTypes] = useState<SurveyQuestionType[]>(['单选', '多选', '评分', '填空']);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [questions, setQuestions] = useState<MarketSurveyQuestion[]>([]);
  const [promptEcho, setPromptEcho] = useState<SurveyPromptEcho | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const planReady = Boolean(plan.savedAt && plan.goal.trim());

  const handleGenerate = async () => {
    if (!planReady) {
      message.warning('请先保存调研计划');
      return;
    }
    if (!includeTypes.length) {
      message.warning('请至少选择一种题型');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateMarketSurveyByAi(classId, { questionCount, includeTypes });
      setTitle(res.title);
      setQuestions(res.questions);
      setPromptEcho(res.promptEcho);
      setGenerated(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmCreate = async () => {
    setSaving(true);
    try {
      const closesAt = stageDeadlineDate
        ? dayjs(`${stageDeadlineDate}T23:59:59`).toISOString()
        : dayjs().add(7, 'day').toISOString();
      await createMarketSurvey(classId, {
        title: title.trim() || questions[0]?.text.slice(0, 20) || '调研问卷',
        questions: questions.map(({ text, type, options }) => ({ text, type, options: options || [] })),
        source: 'ai',
        closesAt,
      });
      message.success('问卷已创建');
      onCreated();
      onClose();
      setGenerated(false);
      setPromptEcho(null);
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
        footer={
          generated
            ? [
                <Button key="cancel" onClick={onClose}>
                  取消
                </Button>,
                <Button key="edit" onClick={() => setEditorOpen(true)}>
                  编辑题目
                </Button>,
                <Button key="ok" type="primary" loading={saving} onClick={() => void handleConfirmCreate()}>
                  确认创建问卷
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={onClose}>
                  取消
                </Button>,
                <Button
                  key="gen"
                  type="primary"
                  loading={generating}
                  disabled={!planReady}
                  onClick={() => void handleGenerate()}
                >
                  AI 生成
                </Button>,
              ]
        }
        destroyOnClose
      >
        {!planReady ? (
          <Alert type="warning" showIcon message="请队长先在「调研计划」中保存计划后再使用 AI 生成" />
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-medium text-green-700 mb-1">基于调研计划</p>
            <p className="text-sm text-green-800">{plan.goal}</p>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">题目数量</div>
            <InputNumber min={10} max={20} value={questionCount} onChange={(v) => setQuestionCount(Number(v) || 10)} className="w-full" />
          </div>
          <div>
            <div className="text-sm font-medium mb-2">包含题型</div>
            <Checkbox.Group
              options={SURVEY_QUESTION_TYPES.map((t) => ({ label: t, value: t }))}
              value={includeTypes}
              onChange={(vals) => setIncludeTypes(vals as SurveyQuestionType[])}
            />
          </div>
          {generated && (
            <>
              <div>
                <div className="text-sm font-medium mb-1">问卷标题</div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <p className="text-sm text-gray-600">已生成 {questions.length} 道题目</p>
            </>
          )}
        </div>
      </Modal>
      <SurveyEditorModal
        open={editorOpen}
        title="调整 AI 生成的题目"
        initialTitle={title}
        initialQuestions={questions}
        onCancel={() => setEditorOpen(false)}
        onSave={async (payload) => {
          setTitle(payload.title);
          setQuestions(
            payload.questions.map((q, i) => ({
              id: questions[i]?.id || `edit-${i}`,
              text: q.text,
              type: q.type,
              options: q.options,
            }))
          );
          setEditorOpen(false);
        }}
      />
    </>
  );
}
