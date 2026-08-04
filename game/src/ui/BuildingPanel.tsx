import { useMemo, useState } from 'react';
import { STAGE_MODULE_LINKS } from '../constants';
import mapData from '../data/map.json';
import { resolveWebAppUrl } from '../lib/webAppUrl';
import { exportSummaryJson } from '../systems/SandboxSave';
import { useTownStore } from '../systems/townStore';
import { ModalShell } from './QuestPanel';

export default function BuildingPanel() {
  const overlay = useTownStore((s) => s.overlay);
  const buildingId = useTownStore((s) => s.activeBuildingId);
  const stageId = useTownStore((s) => s.activeStageId);
  const close = useTownStore((s) => s.closeBuilding);
  const complete = useTownStore((s) => s.completeStage);
  const save = useTownStore((s) => s.save);
  const dialoguesRead = save.dialoguesRead;

  if (overlay !== 'building' || !buildingId || !stageId) return null;
  const building = mapData.buildings.find((b) => b.id === buildingId);
  const needKey = stageId;
  const talked = dialoguesRead.includes(needKey) || dialoguesRead.includes('mentor');

  return (
    <ModalShell title={building?.name || '建筑'} onClose={close} wide>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
        对应实训：{stageId} · 对话进度：
        {dialoguesRead.includes(needKey) ? '本阶段已读' : '建议先与门口 NPC 对话'}
        {!talked ? '（导师对话也可起步）' : ''}
      </p>
      <a
        href={resolveWebAppUrl(STAGE_MODULE_LINKS[stageId])}
        style={{ fontSize: 12, color: '#5eead4' }}
        target="_blank"
        rel="noreferrer"
      >
        去正式模块提交（新标签打开学生中心）
      </a>
      <div style={{ marginTop: 16 }}>
        {stageId === 'team' && (
          <TeamForm
            initial={save.payloads.team}
            onSubmit={(p) => complete('team', p)}
            canSubmit={dialoguesRead.includes('team') || dialoguesRead.includes('mentor')}
          />
        )}
        {stageId === 'ideation' && (
          <IdeationForm
            initial={save.payloads.ideation}
            onSubmit={(p) => complete('ideation', p)}
            canSubmit={dialoguesRead.includes('ideation')}
          />
        )}
        {stageId === 'research' && (
          <ResearchForm
            initial={save.payloads.research}
            onSubmit={(p) => complete('research', p)}
            canSubmit={dialoguesRead.includes('research')}
          />
        )}
        {stageId === 'product' && (
          <ProductForm
            initial={save.payloads.product}
            onSubmit={(p) => complete('product', p)}
            canSubmit={dialoguesRead.includes('product')}
          />
        )}
        {stageId === 'bmc' && (
          <BmcForm
            initial={save.payloads.bmc}
            onSubmit={(p) => complete('bmc', p)}
            canSubmit={dialoguesRead.includes('bmc')}
          />
        )}
        {stageId === 'sim' && (
          <SimForm
            initial={save.payloads.sim}
            onSubmit={(p) => complete('sim', p)}
            canSubmit={dialoguesRead.includes('sim')}
          />
        )}
        {stageId === 'plan' && (
          <PlanForm
            initial={save.payloads.plan}
            onSubmit={(p) => complete('plan', p)}
            canSubmit={dialoguesRead.includes('plan')}
            saveSnapshot={() => exportSummaryJson(useTownStore.getState().save)}
          />
        )}
      </div>
    </ModalShell>
  );
}

function warnNeedDialogue(can: boolean) {
  if (!can) return <p style={{ color: '#fbbf24', fontSize: 13 }}>请先与本阶段 NPC 完成对话，再提交面板。</p>;
  return null;
}

function TeamForm({
  initial,
  onSubmit,
  canSubmit,
}: {
  initial: ReturnType<typeof useTownStore.getState>['save']['payloads']['team'];
  onSubmit: (p: NonNullable<typeof initial>) => void;
  canSubmit: boolean;
}) {
  const [teamName, setTeamName] = useState(initial?.teamName || '创想一号');
  const [leader, setLeader] = useState(initial?.leader || '我');
  const [roles, setRoles] = useState(initial?.roles || ['CEO', '产品', '市场']);
  const rolePool = ['CEO', '产品', '市场', '技术', '运营', '财务'];
  return (
    <div>
      {warnNeedDialogue(canSubmit)}
      <label style={label}>队名</label>
      <input style={input} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
      <label style={label}>队长</label>
      <input style={input} value={leader} onChange={(e) => setLeader(e.target.value)} />
      <label style={label}>三个岗位标签</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rolePool.map((r) => {
          const on = roles.includes(r);
          return (
            <button
              key={r}
              type="button"
              style={{ ...chip, background: on ? '#0d9488' : '#1e293b' }}
              onClick={() => {
                setRoles((prev) => {
                  if (prev.includes(r)) return prev.filter((x) => x !== r);
                  if (prev.length >= 3) return [...prev.slice(1), r];
                  return [...prev, r];
                });
              }}
            >
              {r}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        style={primary}
        disabled={!canSubmit || !teamName.trim() || roles.length < 3}
        onClick={() => onSubmit({ teamName: teamName.trim(), leader: leader.trim() || '我', roles })}
      >
        提交组队方案
      </button>
    </div>
  );
}

function IdeationForm({
  initial,
  onSubmit,
  canSubmit,
}: {
  initial: ReturnType<typeof useTownStore.getState>['save']['payloads']['ideation'];
  onSubmit: (p: NonNullable<typeof initial>) => void;
  canSubmit: boolean;
}) {
  const cards = [
    { id: 'c1', title: '校园二手流转平台' },
    { id: 'c2', title: '银发健康陪伴服务' },
    { id: 'c3', title: '低碳打卡社区' },
  ];
  const [cardId, setCardId] = useState(initial?.cardId || 'c1');
  const [title, setTitle] = useState(initial?.title || cards[0].title);
  return (
    <div>
      {warnNeedDialogue(canSubmit)}
      <div style={{ display: 'grid', gap: 8 }}>
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            style={{
              ...chip,
              textAlign: 'left',
              padding: 12,
              background: cardId === c.id ? '#0f766e' : '#1e293b',
            }}
            onClick={() => {
              setCardId(c.id);
              setTitle(c.title);
            }}
          >
            {c.title}
          </button>
        ))}
      </div>
      <label style={label}>创意命名</label>
      <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
      <button
        type="button"
        style={primary}
        disabled={!canSubmit || !title.trim()}
        onClick={() => onSubmit({ cardId, title: title.trim() })}
      >
        确认创意
      </button>
    </div>
  );
}

function ResearchForm({
  initial,
  onSubmit,
  canSubmit,
}: {
  initial: ReturnType<typeof useTownStore.getState>['save']['payloads']['research'];
  onSubmit: (p: NonNullable<typeof initial>) => void;
  canSubmit: boolean;
}) {
  const pains = ['价格敏感', '信息不透明', '服务不稳定', '学习成本高', '信任不足'];
  const personas = ['大学生', '宝妈', '银发族'];
  const [assignments, setAssignments] = useState<Record<string, string>>(initial?.assignments || {});
  const count = Object.keys(assignments).length;
  return (
    <div>
      {warnNeedDialogue(canSubmit)}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>将痛点点选归到用户画像（至少 3 个）</p>
      {pains.map((p) => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 100 }}>{p}</span>
          <select
            style={input}
            value={assignments[p] || ''}
            onChange={(e) => {
              const v = e.target.value;
              setAssignments((prev) => {
                const next = { ...prev };
                if (!v) delete next[p];
                else next[p] = v;
                return next;
              });
            }}
          >
            <option value="">未归类</option>
            {personas.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        type="button"
        style={primary}
        disabled={!canSubmit || count < 3}
        onClick={() => onSubmit({ assignments })}
      >
        提交画像（已归类 {count}）
      </button>
    </div>
  );
}

function ProductForm({
  initial,
  onSubmit,
  canSubmit,
}: {
  initial: ReturnType<typeof useTownStore.getState>['save']['payloads']['product'];
  onSubmit: (p: NonNullable<typeof initial>) => void;
  canSubmit: boolean;
}) {
  const features = ['智能推荐', '一键下单', '社区互助'];
  const stories = [
    { id: 's1', text: '作为学生，希望快速找到合适二手商品' },
    { id: 's2', text: '作为用户，希望减少决策时间' },
    { id: 's3', text: '作为邻里，希望互相帮助降低成本' },
  ];
  const [pairs, setPairs] = useState<Record<string, string>>(initial?.pairs || {});
  const ok = features.every((f) => Boolean(pairs[f]));
  return (
    <div>
      {warnNeedDialogue(canSubmit)}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>为每个功能选择匹配的用户故事</p>
      {features.map((f) => (
        <div key={f} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>{f}</div>
          <select
            style={input}
            value={pairs[f] || ''}
            onChange={(e) => setPairs((prev) => ({ ...prev, [f]: e.target.value }))}
          >
            <option value="">请选择</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.text}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="button" style={primary} disabled={!canSubmit || !ok} onClick={() => onSubmit({ pairs })}>
        提交配对
      </button>
    </div>
  );
}

function BmcForm({
  initial,
  onSubmit,
  canSubmit,
}: {
  initial: ReturnType<typeof useTownStore.getState>['save']['payloads']['bmc'];
  onSubmit: (p: NonNullable<typeof initial>) => void;
  canSubmit: boolean;
}) {
  const keys = [
    '客户细分',
    '价值主张',
    '渠道通路',
    '客户关系',
    '收入来源',
    '核心资源',
    '关键业务',
    '重要合作',
    '成本结构',
  ];
  const [cells, setCells] = useState<Record<string, string>>(initial?.cells || {});
  const filled = keys.filter((k) => (cells[k] || '').trim()).length;
  return (
    <div>
      {warnNeedDialogue(canSubmit)}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>商业模式画布：至少填写 4 格（已填 {filled}）</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {keys.map((k) => (
          <div key={k}>
            <label style={label}>{k}</label>
            <input
              style={input}
              value={cells[k] || ''}
              onChange={(e) => setCells((prev) => ({ ...prev, [k]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        style={primary}
        disabled={!canSubmit || filled < 4}
        onClick={() => onSubmit({ cells })}
      >
        提交画布
      </button>
    </div>
  );
}

function SimForm({
  initial,
  onSubmit,
  canSubmit,
}: {
  initial: ReturnType<typeof useTownStore.getState>['save']['payloads']['sim'];
  onSubmit: (p: NonNullable<typeof initial>) => void;
  canSubmit: boolean;
}) {
  const [price, setPrice] = useState(initial?.price ?? 29);
  const [budget, setBudget] = useState(initial?.budget ?? 5000);
  const [channels, setChannels] = useState(initial?.channels ?? 40);
  const series = useMemo(() => {
    const users: number[] = [];
    const revenue: number[] = [];
    let u = 80;
    for (let d = 1; d <= 7; d++) {
      u = Math.round(u * (1 + channels / 400) + budget / 800 - price / 20);
      users.push(Math.max(10, u));
      revenue.push(Math.round(users[d - 1] * price * 0.35));
    }
    return { users, revenue };
  }, [price, budget, channels]);
  const maxY = Math.max(...series.revenue, 1);
  return (
    <div>
      {warnNeedDialogue(canSubmit)}
      <label style={label}>定价 {price}</label>
      <input type="range" min={9} max={99} value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '100%' }} />
      <label style={label}>预算 {budget}</label>
      <input type="range" min={1000} max={20000} step={500} value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={{ width: '100%' }} />
      <label style={label}>渠道投入 {channels}</label>
      <input type="range" min={10} max={90} value={channels} onChange={(e) => setChannels(Number(e.target.value))} style={{ width: '100%' }} />
      <svg width="100%" height="120" viewBox="0 0 280 120" style={{ background: '#1e293b', borderRadius: 8, marginTop: 8 }}>
        {series.revenue.map((v, i) => {
          const x = 20 + i * 36;
          const h = (v / maxY) * 80;
          return <rect key={i} x={x} y={100 - h} width={20} height={h} fill="#2dd4bf" rx={3} />;
        })}
      </svg>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>示意：7 日收入柱状图（非真实预测）</p>
      <button
        type="button"
        style={primary}
        disabled={!canSubmit}
        onClick={() => onSubmit({ price, budget, channels, ran: true })}
      >
        运行仿真并完成
      </button>
    </div>
  );
}

function PlanForm({
  initial,
  onSubmit,
  canSubmit,
  saveSnapshot,
}: {
  initial: ReturnType<typeof useTownStore.getState>['save']['payloads']['plan'];
  onSubmit: (p: NonNullable<typeof initial>) => void;
  canSubmit: boolean;
  saveSnapshot: () => unknown;
}) {
  const chapters = ['摘要', '市场', '产品', '模式', '运营', '财务', '风险'];
  const [picked, setPicked] = useState<string[]>(initial?.chapters || []);
  return (
    <div>
      {warnNeedDialogue(canSubmit)}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>勾选已在小镇完成的计划书章节</p>
      {chapters.map((c) => (
        <label key={c} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={picked.includes(c)}
            onChange={(e) => {
              setPicked((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)));
            }}
          />
          {c}
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={primary}
          disabled={!canSubmit || picked.length < 4}
          onClick={() => onSubmit({ chapters: picked })}
        >
          提交章节清单
        </button>
        <button
          type="button"
          style={{ ...primary, background: '#334155' }}
          onClick={() => {
            const data = saveSnapshot();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chuangxiang-town-summary-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          导出通关纪要 JSON
        </button>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#94a3b8', margin: '10px 0 4px' };
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #475569',
  background: '#1e293b',
  color: '#f8fafc',
};
const chip: React.CSSProperties = {
  border: '1px solid #475569',
  color: '#f8fafc',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
};
const primary: React.CSSProperties = {
  marginTop: 14,
  background: '#0d9488',
  border: 'none',
  color: 'white',
  borderRadius: 10,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};
