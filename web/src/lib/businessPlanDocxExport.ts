/** 最小无依赖 ZIP（仅 Store，不压缩），用于拼装 docx */
import type { BusinessPlanCover } from './businessPlanTemplate';
import { BUSINESS_PLAN_SECTION_GROUPS } from './businessPlanTemplate';

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function encodeUtf8(s: string) {
  return new TextEncoder().encode(s);
}

type ZipEntry = { name: string; data: Uint8Array };

function buildZip(entries: ZipEntry[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = encodeUtf8(e.name);
    const crc = crc32(e.data);
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(e.data.length),
      u32(e.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, e.data);

    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(e.data.length),
      u32(e.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(central);
    offset += localHeader.length + e.data.length;
  }

  const centralDir = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return new Blob([concatBytes([...localParts, centralDir, end])], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function escapeXml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlToPlainParagraphs(html: string): string[] {
  const withBreaks = String(html || '')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '');
  return withBreaks
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function paragraphXml(text: string, opts?: { bold?: boolean; size?: number; center?: boolean }) {
  const size = opts?.size ?? 21;
  const bold = opts?.bold ? '<w:b/>' : '';
  const jc = opts?.center ? '<w:jc w:val="center"/>' : '';
  return `<w:p><w:pPr>${jc}</w:pPr><w:r><w:rPr>${bold}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

export type BusinessPlanExportSection = {
  key?: string;
  title: string;
  content: string;
  groupKey?: string;
};

function sectionsInGroup(sections: BusinessPlanExportSection[], groupKey: string) {
  const byGroup = sections.filter((s) => s.groupKey === groupKey);
  if (byGroup.length) return byGroup;
  const prefix = groupKey === 'g1' ? '1.' : groupKey === 'g2' ? '2.' : groupKey === 'g3' ? '3.' : '4.';
  return sections.filter((s) => String(s.title || '').startsWith(prefix));
}

/** 将商业计划书（封面 + 学生填写小节）导出为 .docx，不含评分标准 */
export function downloadBusinessPlanDocx(
  sections: BusinessPlanExportSection[],
  fileName = '商业计划书.docx',
  cover?: BusinessPlanCover | null
) {
  const c = cover || {
    projectName: '',
    leader: '',
    members: [],
    collegeClass: '',
    advisor: '',
    dateYear: '',
    dateMonth: '',
    dateDay: '',
  };

  const bodyParts: string[] = [
    paragraphXml('商业计划书', { bold: true, size: 36, center: true }),
    paragraphXml(''),
    paragraphXml(`小组项目名称：${c.projectName || '____________________'}`),
    paragraphXml(`组长（姓名学号）：${c.leader || '____________________'}`),
    // 按实际成员人数输出；单人公司无成员行
    ...(Array.isArray(c.members) && c.members.length
      ? c.members.map((m, i) =>
          paragraphXml(`成员（姓名学号）${i + 1}：${m || '____________________'}`)
        )
      : []),
    paragraphXml(`学院班级：${c.collegeClass || '____________________'}`),
    paragraphXml(`指导教师：${c.advisor || '____________________'}`),
    paragraphXml(''),
    paragraphXml(
      `${c.dateYear || '____'}年 ${c.dateMonth || '____'}月 ${c.dateDay || '____'}日`,
      { center: true }
    ),
    paragraphXml(''),
  ];

  for (const group of BUSINESS_PLAN_SECTION_GROUPS) {
    bodyParts.push(paragraphXml(group.title, { bold: true, size: 26 }));
    for (const sec of sectionsInGroup(sections || [], group.key)) {
      bodyParts.push(paragraphXml(String(sec.title || '').trim() || '未命名小节', { bold: true, size: 24 }));
      const lines = htmlToPlainParagraphs(sec.content || '');
      if (!lines.length) bodyParts.push(paragraphXml('（本节暂无内容）'));
      else for (const line of lines) bodyParts.push(paragraphXml(line));
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join('\n')}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  const blob = buildZip([
    { name: '[Content_Types].xml', data: encodeUtf8(contentTypes) },
    { name: '_rels/.rels', data: encodeUtf8(rels) },
    { name: 'word/document.xml', data: encodeUtf8(documentXml) },
    { name: 'word/_rels/document.xml.rels', data: encodeUtf8(docRels) },
  ]);

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
