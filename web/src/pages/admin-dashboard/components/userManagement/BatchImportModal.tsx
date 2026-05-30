import { useEffect, useMemo, useState } from 'react';
import { Button, Cascader, message, Select, Space } from 'antd';
import type { ImportResult } from './types';
import type { BatchImportRow } from './adminUsersApi';
import { fetchAdminClasses } from './adminUsersApi';
import { fetchAdminColleges, fetchPublicMajors, type AdminCollegeRow } from '../collegeApi';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: BatchImportRow[]) => Promise<ImportResult>;
  /** 锁定学院 id，禁用学院选择 */
  lockedCollegeId?: string;
  /** 锁定班级 id（学生行入班）；教师批量时可不设 */
  lockedClassId?: string;
  /** 与 lockedClassId 同场景展示用（如班级学生管理页 subtitle） */
  lockedClassLabel?: string;
  /** 班级学生管理：锁定专业 */
  lockedMajorId?: string;
  lockedMajorLabel?: string;
  /** 锁定导入角色：教师/学生页不写 CSV「角色」列，由本页场景自动写入身份 */
  lockedRole?: 'student' | 'teacher';
}

/** 解析 CSV；fixedRole 时表头无需「角色」列，身份由本页导入场景自动决定 */
function parseCsvToRows(
  text: string,
  fixedRole?: 'student' | 'teacher'
): { name: string; role: string; idNumber: string; email?: string; csvLine: number }[] {
  const raw = text.replace(/^\ufeff/, '');
  const fileLines = raw.split(/\r?\n/);
  const contentLines: { lineNo: number; text: string }[] = [];
  for (let i = 0; i < fileLines.length; i++) {
    const textLine = fileLines[i].trim();
    if (!textLine) continue;
    if (textLine.startsWith('#')) continue;
    contentLines.push({ lineNo: i + 1, text: textLine });
  }
  if (contentLines.length < 2) {
    throw new Error('至少需要表头与一行数据');
  }
  const header = contentLines[0].text.split(',').map((h) => h.trim());
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = idx(['姓名']);
  const iRole = idx(['角色']);
  const iId = idx(['学号或工号', '学号', '工号']);
  const iEmail = idx(['邮箱']);
  if (iName < 0 || iId < 0) {
    throw new Error(
      fixedRole
        ? '表头须包含：姓名、学号或工号（邮箱可省略列）；本页无需填写「角色」列'
        : '表头须包含：姓名、角色、学号或工号（邮箱可省略列）'
    );
  }
  if (!fixedRole && iRole < 0) {
    throw new Error('表头须包含：姓名、角色、学号或工号（邮箱可省略列）');
  }

  const autoRole = fixedRole === 'teacher' ? '教师' : fixedRole === 'student' ? '学生' : '';

  const rows: { name: string; role: string; idNumber: string; email?: string; csvLine: number }[] = [];
  for (let r = 1; r < contentLines.length; r++) {
    const cells = contentLines[r].text.split(',').map((c) => c.trim());
    const name = cells[iName] ?? '';
    const role = fixedRole ? autoRole : (cells[iRole] ?? '');
    const idNumber = cells[iId] ?? '';
    const email = iEmail >= 0 ? (cells[iEmail] ?? '').trim() : '';
    rows.push({
      name,
      role,
      idNumber,
      csvLine: contentLines[r].lineNo,
      ...(email ? { email } : {}),
    });
  }
  return rows;
}

function normalizeRoleLabel(r: string): '学生' | '教师' | '' {
  const s = r.trim();
  if (s === '学生' || s.toLowerCase() === 'student') return '学生';
  if (s === '教师' || s === '老师' || s.toLowerCase() === 'teacher') return '教师';
  return '';
}

export default function BatchImportModal({
  isOpen,
  onClose,
  onImport,
  lockedCollegeId,
  lockedClassId,
  lockedClassLabel,
  lockedMajorId,
  lockedMajorLabel,
  lockedRole,
}: BatchImportModalProps) {
  const [colleges, setColleges] = useState<AdminCollegeRow[]>([]);
  const [tplCollegeId, setTplCollegeId] = useState('');
  const [tplMajorId, setTplMajorId] = useState('');
  const [tplClassId, setTplClassId] = useState('');
  const [classOptions, setClassOptions] = useState<{ label: string; value: string }[]>([]);
  const [allMajors, setAllMajors] = useState<{ id: string; name: string; collegeId: string }[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.all([fetchAdminColleges(), fetchPublicMajors()])
      .then(([c, m]) => {
        if (cancelled) return;
        setColleges(c.filter((x) => x.status === 'active'));
        setAllMajors(m);
      })
      .catch(() => {
        if (!cancelled) {
          setColleges([]);
          setAllMajors([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (lockedCollegeId) setTplCollegeId(lockedCollegeId);
    if (lockedMajorId) setTplMajorId(lockedMajorId);
    if (lockedClassId) setTplClassId(lockedClassId);
    if (lockedRole === 'teacher') setTplClassId('');
  }, [isOpen, lockedCollegeId, lockedMajorId, lockedClassId, lockedRole]);

  const classImportLocked = Boolean(lockedCollegeId && lockedClassId);

  const collegeMajorCascaderOptions = useMemo(
    () =>
      colleges.map((c) => ({
        value: c.id,
        label: `${c.name}（${c.id}）`,
        children: allMajors
          .filter((m) => m.collegeId === c.id)
          .map((m) => ({ value: m.id, label: m.name })),
      })),
    [colleges, allMajors]
  );

  const majorOptionsForCollege = useMemo(
    () =>
      allMajors
        .filter((m) => m.collegeId === tplCollegeId)
        .map((m) => ({ label: m.name, value: m.id })),
    [allMajors, tplCollegeId]
  );

  useEffect(() => {
    if (lockedRole === 'teacher') {
      setClassOptions([]);
      return;
    }
    if (!tplCollegeId || !tplMajorId) {
      setClassOptions([]);
      if (!lockedClassId) setTplClassId('');
      return;
    }
    let cancelled = false;
    fetchAdminClasses(tplCollegeId, tplMajorId)
      .then((rows) => {
        if (cancelled) return;
        setClassOptions(rows.map((r) => ({ label: `${r.name}（${r.code}）`, value: r.id })));
      })
      .catch(() => {
        if (!cancelled) setClassOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tplCollegeId, tplMajorId, lockedRole, lockedClassId]);

  if (!isOpen) return null;

  const modalTitle =
    lockedRole === 'teacher' ? '批量导入教师' : lockedRole === 'student' ? '批量导入学生' : '批量导入用户';

  const preSelectTitle = classImportLocked
    ? '导入目标'
    : lockedRole === 'teacher'
      ? '导入前：选择学院与专业'
      : lockedRole === 'student'
        ? '导入前：选择学院、专业与班级'
        : '导入前：选择学院、专业与班级';

  const selectedCollege = colleges.find((c) => c.id === tplCollegeId);
  const selectedMajor =
    allMajors.find((m) => m.id === tplMajorId) ||
    (lockedMajorLabel && tplMajorId ? { id: tplMajorId, name: lockedMajorLabel, collegeId: tplCollegeId } : undefined);
  const selectedClassMeta = classOptions.find((o) => o.value === tplClassId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      message.warning('请上传 CSV 文件（UTF-8）。Excel 请先「另存为 CSV」');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(selectedFile);
    } else {
      message.warning('请上传 CSV 文件（UTF-8）。Excel 请先「另存为 CSV」');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const list = await fetchAdminColleges();
      const active = list.filter((c) => c.status === 'active');
      if (!active.length) {
        message.warning('请先创建学院');
        return;
      }
      if (!tplCollegeId) {
        message.warning('请先在上方选择学院');
        return;
      }
      if (!tplMajorId && !lockedMajorId) {
        message.warning('请先在上方选择专业');
        return;
      }
      const majorIdResolved = tplMajorId || lockedMajorId || '';
      const c = active.find((x) => x.id === tplCollegeId);
      if (!c) {
        message.error('学院数据已变化，请重新选择');
        return;
      }
      const majors = await fetchPublicMajors(tplCollegeId);
      const mj = majors.find((x) => x.id === majorIdResolved);
      if (!mj) {
        message.error('专业数据已变化，请重新选择');
        return;
      }

      let line1: string;
      let header: string;
      let bodyLines: string;
      let filename: string;

      if (lockedRole === 'teacher') {
        line1 = `# 学院,${c.name},id=${c.id} | 专业,${mj.name},id=${mj.id}（数据行勿含学院/专业列；无需「角色」列，将按本页教师批量导入）`;
        header = '姓名,学号或工号,邮箱';
        bodyLines = '李老师,T2021001,li@example.com';
        filename = '教师导入模板.csv';
      } else if (lockedRole === 'student') {
        let cl: { id: string; name: string };
        if (lockedClassId) {
          const fromApi = (await fetchAdminClasses(tplCollegeId)).find((x) => x.id === lockedClassId);
          const name = lockedClassLabel || fromApi?.name;
          if (!name) {
            message.error('无法识别当前班级，请从班级管理重新进入本页');
            return;
          }
          cl = { id: lockedClassId, name };
        } else {
          const cls = await fetchAdminClasses(tplCollegeId, majorIdResolved);
          if (!cls.length) {
            message.warning(`${c.name} / ${mj.name} 下没有班级，请先创建班级`);
            return;
          }
          if (!tplClassId) {
            message.warning('请选择班级');
            return;
          }
          const found = cls.find((x) => x.id === tplClassId);
          if (!found) {
            message.error('班级数据已变化，请重新选择');
            return;
          }
          cl = found;
        }
        line1 = `# 学院,${c.name},id=${c.id} | 专业,${mj.name},id=${mj.id} | 班级,${cl.name},id=${cl.id}（数据行勿含学院/专业/班级列；无需「角色」列，将按本页学生批量导入）`;
        header = '姓名,学号或工号,邮箱';
        bodyLines = '张三,2021001001,';
        filename = '学生导入模板.csv';
      } else {
        const cls = await fetchAdminClasses(tplCollegeId, majorIdResolved);
        if (!cls.length) {
          message.warning(`${c.name} / ${mj.name} 下没有班级，请先创建班级`);
          return;
        }
        if (!tplClassId) {
          message.warning('请选择班级');
          return;
        }
        const cl = cls.find((x) => x.id === tplClassId);
        if (!cl) {
          message.error('学院或班级数据已变化，请重新选择');
          return;
        }
        line1 = `# 学院,${c.name},id=${c.id} | 专业,${mj.name},id=${mj.id} | 班级,${cl.name},id=${cl.id}（以下数据行勿含学院/专业/班级列，导入时使用上方所选）`;
        header = '姓名,角色,学号或工号,邮箱';
        bodyLines = '张三,学生,2021001001,\n李老师,教师,T2021001,li@example.com';
        filename = '用户导入模板.csv';
      }

      const csvContent = `${line1}\n${header}\n${bodyLines}`;
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '下载失败');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    let progressInterval: ReturnType<typeof setInterval> | undefined;
    let importOk = false;
    try {
      const text = await file.text();
      setUploadProgress(8);
      const parsed = parseCsvToRows(text, lockedRole);

      if (!tplCollegeId.trim()) {
        throw new Error('请先在上方选择学院，再开始导入');
      }
      if (!tplMajorId.trim() && !lockedMajorId?.trim()) {
        throw new Error('请先在上方选择专业，再开始导入');
      }
      const majorIdResolved = (tplMajorId || lockedMajorId || '').trim();
      let hasStudent = lockedRole === 'student';
      if (!lockedRole) {
        for (const p of parsed) {
          if (normalizeRoleLabel(p.role) === '学生') hasStudent = true;
        }
      }
      if (hasStudent && !tplClassId.trim()) {
        throw new Error('文件中包含学生，请先在上方选择班级');
      }

      const rows: BatchImportRow[] = [];
      for (const p of parsed) {
        if (!p.name.trim() && !p.idNumber.trim()) continue;
        const rl = lockedRole === 'teacher' ? '教师' : lockedRole === 'student' ? '学生' : normalizeRoleLabel(p.role);
        if (!lockedRole && !rl) {
          throw new Error(`第 ${p.csvLine} 行：角色须为「学生」或「教师」`);
        }
        const roleLabel = rl === '学生' ? '学生' : rl === '教师' ? '教师' : p.role.trim();
        rows.push({
          name: p.name.trim(),
          role: roleLabel,
          idNumber: p.idNumber.trim(),
          collegeId: tplCollegeId.trim(),
          majorId: majorIdResolved,
          sourceLine: p.csvLine,
          ...(roleLabel === '学生' && tplClassId.trim() ? { classId: tplClassId.trim() } : {}),
          ...(p.email?.trim() ? { email: p.email.trim() } : {}),
        });
      }
      if (!rows.length) {
        throw new Error('没有可导入的数据行');
      }

      setUploadProgress(15);
      progressInterval = window.setInterval(() => {
        setUploadProgress((prev) => (prev >= 92 ? 92 : prev + 1));
      }, 350);

      const result = await onImport(rows);
      importOk = true;
      if (progressInterval) {
        window.clearInterval(progressInterval);
        progressInterval = undefined;
      }
      setUploadProgress(100);
      setImportResult(result);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      if (progressInterval) window.clearInterval(progressInterval);
      setIsUploading(false);
      if (!importOk) setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setImportResult(null);
    if (!lockedCollegeId) setTplCollegeId('');
    if (!lockedMajorId) setTplMajorId('');
    if (!lockedClassId) setTplClassId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">{modalTitle}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!importResult ? (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-800 mb-2">{preSelectTitle}</div>
                <Space wrap className="w-full" direction="vertical" size="middle" style={{ width: '100%' }}>
                  {classImportLocked ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <div className="text-xs text-gray-500 mb-1">学院</div>
                        <div className="text-sm font-medium text-gray-900 leading-snug">
                          {selectedCollege?.name ?? '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <div className="text-xs text-gray-500 mb-1">专业</div>
                        <div className="text-sm font-medium text-gray-900 leading-snug">
                          {selectedMajor?.name ?? lockedMajorLabel ?? '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <div className="text-xs text-gray-500 mb-1">班级</div>
                        <div className="text-sm font-medium text-gray-900 leading-snug">
                          {lockedClassLabel ?? `ID ${lockedClassId}`}
                        </div>
                      </div>
                    </div>
                  ) : lockedCollegeId ? (
                    <>
                      <Select
                        className="min-w-[220px]"
                        disabled
                        value={tplCollegeId || undefined}
                        options={colleges.map((c) => ({ label: `${c.name}（${c.id}）`, value: c.id }))}
                      />
                      <Select
                        className="min-w-[260px]"
                        placeholder="选择专业"
                        value={tplMajorId || undefined}
                        onChange={(v) => {
                          setTplMajorId(v ?? '');
                          if (!lockedClassId) setTplClassId('');
                        }}
                        options={majorOptionsForCollege}
                        showSearch
                        optionFilterProp="label"
                      />
                    </>
                  ) : (
                    <Cascader
                      className="min-w-[320px]"
                      placeholder="学院 / 专业"
                      options={collegeMajorCascaderOptions}
                      value={
                        tplCollegeId && tplMajorId
                          ? [tplCollegeId, tplMajorId]
                          : tplCollegeId
                            ? [tplCollegeId]
                            : undefined
                      }
                      onChange={(v) => {
                        const arr = (v as string[] | undefined) ?? [];
                        setTplCollegeId(arr[0] ?? '');
                        setTplMajorId(arr[1] ?? '');
                        if (!lockedClassId) setTplClassId('');
                      }}
                      showSearch={{
                        filter: (input, path) =>
                          path.some((opt) => String(opt.label ?? '').toLowerCase().includes(input.toLowerCase())),
                      }}
                    />
                  )}
                  {lockedRole !== 'teacher' && !lockedClassId && (
                    <Select
                      className="min-w-[260px]"
                      placeholder="选择班级"
                      disabled={!tplCollegeId || !tplMajorId}
                      value={tplClassId || undefined}
                      onChange={(v) => setTplClassId(v ?? '')}
                      options={classOptions}
                      showSearch
                      optionFilterProp="label"
                    />
                  )}
                </Space>
                {lockedRole === 'teacher' && selectedCollege && selectedMajor ? (
                  <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                    下载模板首行为说明（含学院、专业 id 供核对）。<strong>数据列：姓名、学号或工号、邮箱</strong>（无需「角色」列）；教师归属所选学院与专业，不与班级绑定。
                  </p>
                ) : lockedRole === 'student' &&
                  selectedCollege &&
                  selectedMajor &&
                  tplClassId &&
                  (classImportLocked || selectedClassMeta) ? (
                  <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                    下载模板首行为说明（含学院、专业、班级 id 供核对）。<strong>数据列：姓名、学号或工号、邮箱</strong>（无需「角色」列）；学院、专业与班级以本页上方所选为准。
                  </p>
                ) : !lockedRole && selectedCollege && selectedMajor && tplClassId && selectedClassMeta ? (
                  <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                    下载模板首行为说明（含学院、专业、班级 id 供核对）。<strong>数据行含姓名、角色、学号或工号、邮箱</strong>；导入的学院、专业与班级以本页上方选择为准。
                  </p>
                ) : null}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-information-line text-blue-600 text-lg mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">
                      {lockedRole === 'teacher' ? '教师导入说明' : lockedRole === 'student' ? '学生导入说明' : '导入说明'}
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• 请使用 UTF-8 编码的 CSV；Excel 请先「另存为 CSV」</li>
                      {lockedRole === 'teacher' ? (
                        <>
                          <li>• 每行一名教师：「学号或工号」列填写<strong>工号</strong>（与登录账号一致）</li>
                          <li>• 表头须含：<strong>姓名、学号或工号</strong>；<strong>邮箱</strong>列可整列省略；<strong>无需「角色」列</strong>，身份按本页「教师」自动写入</li>
                          <li>• 学院、专业不在 CSV 中：须先选择<strong>学院与专业</strong>；导入的教师归属该学院与专业，<strong>不与班级绑定</strong></li>
                          <li>• 初始密码为工号<strong>后 6 位</strong>（与单个新增教师一致）</li>
                        </>
                      ) : lockedRole === 'student' ? (
                        <>
                          <li>• 每行一名学生：「学号或工号」列填写<strong>学号</strong></li>
                          <li>• 表头须含：<strong>姓名、学号或工号</strong>；<strong>邮箱</strong>可整列省略；<strong>无需「角色」列</strong>，身份按本页「学生」自动写入</li>
                          <li>• 学院、专业、班级不在 CSV 中：须先选择<strong>学院、专业与班级</strong>；学生将入所选班级</li>
                          <li>• 初始密码为学号<strong>后 6 位</strong>（与单个新增学生一致）</li>
                        </>
                      ) : (
                        <>
                          <li>• 支持导入学生与教师：学生在「学号或工号」列填<strong>学号</strong>，教师填<strong>工号</strong></li>
                          <li>• 必填列：姓名、角色、学号或工号；邮箱可整列省略</li>
                          <li>• 学院、班级不在 CSV 中填写：请先在本页上方选择学院与班级，再下载模板或上传文件；学生将入所选班级，教师仅归属所选学院</li>
                          <li>• 若文件中包含学生，必须已选择班级；仅教师时可只选学院</li>
                          <li>• 邮箱为选填；初始密码为学号/工号后 6 位（与单个新建一致）</li>
                        </>
                      )}
                      <li>• 单次最多导入 500 条数据</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">上传文件</h4>
                <Button type="link" className="!text-teal-600" onClick={() => void handleDownloadTemplate()}>
                  <i className="ri-download-line mr-1" />
                  下载导入模板
                </Button>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-gray-50'
                }`}
              >
                {file ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <i className="ri-file-text-line text-3xl text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <Button type="link" danger onClick={() => setFile(null)}>
                      <i className="ri-delete-bin-line mr-1" />
                      移除文件
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
                      <i className="ri-upload-cloud-2-line text-3xl text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">拖拽 CSV 到此处，或</p>
                      <label className="inline-block px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-folder-open-line mr-1" />
                        选择文件
                        <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">仅支持 .csv（UTF-8）</p>
                  </div>
                )}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {uploadProgress >= 15 ? '正在提交并处理，请勿关闭…' : '正在读取文件…'}
                    </span>
                    <span className="text-teal-600 font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-teal-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button block size="large" disabled={isUploading} onClick={handleClose}>
                  取消
                </Button>
                <Button
                  type="primary"
                  block
                  size="large"
                  className="!bg-teal-600 hover:!bg-teal-700"
                  disabled={!file || isUploading}
                  onClick={() => void handleUpload()}
                >
                  {isUploading ? '导入中...' : '开始导入'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <div
                  className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    importResult.failed === 0 ? 'bg-green-100' : 'bg-yellow-100'
                  }`}
                >
                  <i
                    className={`text-4xl ${
                      importResult.failed === 0 ? 'ri-checkbox-circle-line text-green-600' : 'ri-error-warning-line text-yellow-600'
                    }`}
                  />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">导入完成</h4>
                <div className="inline-flex flex-wrap items-center justify-center gap-4 text-sm text-gray-700">
                  <span>
                    成功 <span className="text-green-600 font-semibold text-base">{importResult.success}</span> 条
                  </span>
                  <span>
                    失败 <span className="text-red-600 font-semibold text-base">{importResult.failed}</span> 条
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  失败行号为 CSV 文件中的实际行号；使用下载模板时，数据从第 3 行开始填写。
                </p>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h5 className="text-sm font-medium text-red-900 mb-2">失败明细（CSV 行号）</h5>
                  <div className="space-y-2">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700">
                        第 {error.row} 行：{error.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button type="primary" block size="large" className="!bg-teal-600 hover:!bg-teal-700" onClick={handleClose}>
                  完成
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
