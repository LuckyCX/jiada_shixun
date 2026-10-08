import { Modal } from 'antd';

type StageRule = {
  title: string;
  conditions: { label: string; met: boolean }[];
};

const MODULE_TITLES: Record<string, string> = {
  team: '组队与团队管理',
  ideation: '创新思维与创意生成',
  market: '市场调研与用户画像',
  product: '产品设计与迭代',
  business: '商业模式设计',
  simulation: 'AI 仿真模拟',
  plan: '商业计划书要点',
};

type Props = {
  open: boolean;
  moduleId: string | null;
  onClose: () => void;
  getStartDateLabel: (moduleId: string) => string;
  teamFormationComplete: boolean;
  isBeforeStageStart: (moduleId: string) => boolean;
  isStageCompleted: (moduleId: string) => boolean;
  /** 实际启用链路（含 team） */
  activeTrainingOrder: string[];
};

function buildRules(
  moduleId: string,
  ctx: Omit<Props, 'open' | 'moduleId' | 'onClose'>
): StageRule | null {
  const start = ctx.getStartDateLabel(moduleId);
  const title = MODULE_TITLES[moduleId] || moduleId;
  const idx = ctx.activeTrainingOrder.indexOf(moduleId);
  if (idx < 0) return null;

  const conditions: { label: string; met: boolean }[] = [
    { label: `开始时间：${start}`, met: !ctx.isBeforeStageStart(moduleId) },
  ];

  if (moduleId === 'team') {
    conditions.push({ label: '完成组队（教师确认后生效）', met: ctx.teamFormationComplete });
  } else {
    // 按实际启用链路，要求完成所有前序启用环节
    for (let i = 0; i < idx; i++) {
      const prevId = ctx.activeTrainingOrder[i];
      const prevTitle = MODULE_TITLES[prevId] || prevId;
      conditions.push({
        label: `完成：${prevTitle}`,
        met: ctx.isStageCompleted(prevId),
      });
    }
  }

  return { title, conditions };
}

export default function UnlockTrainingStageModal({
  open,
  moduleId,
  onClose,
  getStartDateLabel,
  teamFormationComplete,
  isBeforeStageStart,
  isStageCompleted,
  activeTrainingOrder,
}: Props) {
  if (!moduleId) return null;
  const rule = buildRules(moduleId, {
    getStartDateLabel,
    teamFormationComplete,
    isBeforeStageStart,
    isStageCompleted,
    activeTrainingOrder,
  });
  if (!rule) return null;

  return (
    <Modal open={open} title={`解锁条件：${rule.title}`} onCancel={onClose} footer={null} centered>
      <ul className="space-y-2 m-0 pl-0 list-none">
        {rule.conditions.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm">
            <i
              className={`${c.met ? 'ri-checkbox-circle-fill text-emerald-500' : 'ri-close-circle-fill text-rose-400'} mt-0.5`}
            />
            <span className={c.met ? 'text-gray-700' : 'text-gray-600'}>{c.label}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
