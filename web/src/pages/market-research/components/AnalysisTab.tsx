
import { useState } from 'react';
import { AnalysisData, Survey } from '../types';

interface Props {
  data: AnalysisData;
  surveys: Survey[];
}

function PieChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  let cumulative = 0;
  const radius = 80;
  const cx = 100;
  const cy = 100;

  // 单项 100% 时 SVG 弧起止点重合无法绘制，需改用整圆
  const slices = items.map((item) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += item.value;
    const endAngle = (cumulative / total) * 360;
    const sweep = endAngle - startAngle;
    const isFullCircle = sweep >= 359.9 || items.length === 1;
    let d = '';
    if (!isFullCircle) {
      const start = polarToCartesian(cx, cy, radius, startAngle - 90);
      const end = polarToCartesian(cx, cy, radius, endAngle - 90);
      const largeArc = sweep > 180 ? 1 : 0;
      d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    }
    return {
      ...item,
      d,
      isFullCircle,
      percent: Math.round((item.value / total) * 100),
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="200" height="200" viewBox="0 0 200 200">
        {slices.map((s, i) =>
          s.isFullCircle ? (
            <circle key={i} cx={cx} cy={cy} r={radius} fill={s.color} stroke="white" strokeWidth="2">
              <title>{s.label}: {s.percent}%</title>
            </circle>
          ) : (
            <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="2">
              <title>{s.label}: {s.percent}%</title>
            </path>
          )
        )}
      </svg>
      <div className="space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-gray-600">{s.label}</span>
            <span className="text-xs font-bold text-gray-900 ml-auto pl-4">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
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
              className="h-full bg-gradient-to-r from-purple-500 to-pink-400 rounded-lg flex items-center justify-end pr-2 transition-all duration-700"
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

export default function AnalysisTab({ data, surveys }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const totalCollected = surveys.reduce((s, sv) => s + sv.collected, 0);
  const validSamples = Math.round(totalCollected * 0.91);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    }, 1500);
  };

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">问卷回收</span>
            <i className="ri-file-list-3-line text-2xl text-white/80"></i>
          </div>
          <div className="text-3xl font-bold mb-1">{totalCollected}份</div>
          <div className="text-xs text-white/80">来自 {surveys.filter(s => s.status === '进行中').length} 份进行中问卷</div>
        </div>
        <div className="bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">有效样本</span>
            <i className="ri-checkbox-circle-line text-2xl text-white/80"></i>
          </div>
          <div className="text-3xl font-bold mb-1">{validSamples}份</div>
          <div className="text-xs text-white/80">有效率91%</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">访谈记录</span>
            <i className="ri-user-voice-line text-2xl text-white/80"></i>
          </div>
          <div className="text-3xl font-bold mb-1">24人</div>
          <div className="text-xs text-white/80">深度访谈</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">
            <i className="ri-pie-chart-line text-purple-500 mr-2"></i>年龄分布
          </h3>
          <PieChart items={data.ageDistribution} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">
            <i className="ri-pie-chart-2-line text-amber-500 mr-2"></i>月均消费分布
          </h3>
          <PieChart items={data.spendingDistribution} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">
          <i className="ri-pie-chart-line text-teal-500 mr-2"></i>满意度分布
        </h3>
        <PieChart items={data.satisfactionDistribution} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-gray-900 mb-6">
          <i className="ri-bar-chart-horizontal-line text-pink-500 mr-2"></i>用户改进需求排行
        </h3>
        <BarChart items={data.improvementNeeds} />
      </div>

      {/* Key Findings */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">核心发现</h3>
        <div className="space-y-4">
          {[
            { title: '用户痛点明确', desc: '85%的用户表示高峰期配送时间过长，平均等待超过45分钟' },
            { title: '价格敏感度高', desc: '学生群体对配送费用敏感，72%希望配送费低于3元' },
            { title: '市场机会存在', desc: '校园内配送场景独特，现有平台未能很好满足需求' },
          ].map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-purple-100 text-purple-600 rounded-lg flex-shrink-0">
                <i className="ri-check-line text-lg"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        className={`w-full px-6 py-3 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
          exported ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'
        } disabled:opacity-60`}
      >
        {exporting ? (
          <><i className="ri-loader-4-line animate-spin"></i>正在生成报告...</>
        ) : exported ? (
          <><i className="ri-checkbox-circle-line"></i>报告已导出！</>
        ) : (
          <><i className="ri-file-download-line"></i>导出调研报告</>
        )}
      </button>
    </div>
  );
}
