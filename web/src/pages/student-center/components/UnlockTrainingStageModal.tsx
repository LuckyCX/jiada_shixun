import { Modal } from 'antd';

type StageRule = {
  title: string;
  conditions: { label: string; met: boolean }[];
};

type Props = {
  open: boolean;
  moduleId: string | null;
  onClose: () => void;
  getStartDateLabel: (moduleId: string) => string;
  teamFormationComplete: boolean;
  ideationTopicApproved: boolean;
  teamMarketReportUploaded: boolean;
  isBeforeStageStart: (moduleId: string) => boolean;
  isStageCompleted: (moduleId: string) => boolean;
};

function buildRules(
  moduleId: string,
  ctx: Omit<Props, 'open' | 'moduleId' | 'onClose'>
): StageRule | null {
  const start = ctx.getStartDateLabel(moduleId);
  const maps: Record<string, StageRule> = {
    team: {
      title: '组队与团队管理',
      conditions: [
        { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart('team') },
        { label: '完成组队（教师确认后生效）', met: ctx.teamFormationComplete },
      ],
    },
    ideation: {
      title: '创新思维与创意生成',
      conditions: [
        { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart('ideation') },
        { label: '完成组队', met: ctx.teamFormationComplete },
      ],
    },
    market: {
      title: '市场调研与用户画像',
      conditions: [
        { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart('market') },
        { label: '完成实训环节2：创新思维与创意生成（确定项目选题）', met: ctx.ideationTopicApproved || ctx.isStageCompleted('ideation') },
      ],
    },
    product: {
      title: '产品设计与迭代',
      conditions: [
        { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart('product') },
        { label: '完成实训环节3：市场调研与用户画像（队长上传调研报告）', met: ctx.teamMarketReportUploaded },
      ],
    },
    business: {
      title: '商业模式设计',
      conditions: [
        { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart('business') },
        { label: '完成实训环节4：产品设计与迭代（队长上传原型压缩包）', met: ctx.isStageCompleted('product') },
      ],
    },
    simulation: {
      title: 'AI 仿真模拟',
      conditions: [
        { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart('simulation') },
        { label: '完成实训环节5：商业模式设计（上传商业画布）', met: ctx.isStageCompleted('business') },
      ],
    },
    plan: {
      title: '商业计划书要点',
      conditions: [
        { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart('plan') },
        { label: '完成实训环节6：AI 仿真模拟（至少 3 轮迭代优化）', met: ctx.isStageCompleted('simulation') },
      ],
    },
  };
  return maps[moduleId] ?? null;
}

export default function UnlockTrainingStageModal({
  open,
  moduleId,
  onClose,
  getStartDateLabel,
  teamFormationComplete,
  ideationTopicApproved,
  teamMarketReportUploaded,
  isBeforeStageStart,
  isStageCompleted,
}: Props) {
  if (!moduleId) return null;
  const rule = buildRules(moduleId, {
    getStartDateLabel,
    teamFormationComplete,
    ideationTopicApproved,
    teamMarketReportUploaded,
    isBeforeStageStart,
    isStageCompleted,
  });
  if (!rule) return null;

  return (
    <Modal open={open} title="解锁条件" onCancel={onClose} footer={null} centered width={480}>
      <p className="text-sm text-gray-600 mb-4">
        「{rule.title}」尚未开放，请满足以下条件后再进入：
      </p>
      <ul className="space-y-3">
        {rule.conditions.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={c.met ? 'text-green-600' : 'text-gray-400'}>
              <i className={c.met ? 'ri-checkbox-circle-fill' : 'ri-close-circle-line'} />
            </span>
            <span className={c.met ? 'text-gray-700' : 'text-gray-900'}>
              {i + 1}. {c.label}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 mt-4">全部条件满足后，即可从左侧进入该实训模块。</p>
    </Modal>
  );
}
