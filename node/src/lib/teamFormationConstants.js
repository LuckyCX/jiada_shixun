export const TEAM_ROLE_KEYS = [
  'ceo',
  'product_rd',
  'market_director',
  'marketing_ops',
  'sales',
  'finance',
];

export const TEAM_ROLE_LABELS = {
  ceo: '项目 CEO / 创始人',
  product_rd: '产品 / 研发负责人',
  market_director: '市场总监',
  marketing_ops: '营销运营官',
  sales: '销售负责人',
  finance: '财务负责人',
};

export function normalizeMatchedRole(raw) {
  const k = String(raw || '').trim();
  return TEAM_ROLE_KEYS.includes(k) ? k : null;
}
