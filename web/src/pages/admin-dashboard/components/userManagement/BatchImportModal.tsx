import { useEffect, useState } from 'react';
import { Button, message, Select, Space } from 'antd';
import type { ImportResult } from './types';
import type { BatchImportRow } from './adminUsersApi';
import { fetchAdminClasses } from './adminUsersApi';
import { fetchAdminColleges, type AdminCollegeRow } from '../collegeApi';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: BatchImportRow[]) => Promise<ImportResult>;
}

function parseCsvToRows(text: string): { name: string; role: string; idNumber: string; email?: string }[] {
  const raw = text.replace(/^\ufeff/, '');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const contentLines = lines.filter((l) => !l.startsWith('#'));
  if (contentLines.length < 2) {
    throw new Error('至少需要表头与一行数据');
  }
  const header = contentLines[0].split(',').map((h) => h.trim());
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
  if (iName < 0 || iRole < 0 || iId < 0) {
    throw new Error('表头须包含：姓名、角色、学号或工号（邮箱可省略列）');
  }

  const rows: { name: string; role: string; idNumber: string; email?: string }[] = [];
  for (let r = 1; r < contentLines.length; r++) {
    const cells = contentLines[r].split(',').map((c) => c.trim());
    const name = cells[iName] ?? '';
    const role = cells[iRole] ?? '';
    const idNumber = cells[iId] ?? '';
    const email = iEmail >= 0 ? (cells[iEmail] ?? '').trim() : '';
    rows.push({
      name,
      role,
      idNumber,
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

export default function BatchImportModal({ isOpen, onClose, onImport }: BatchImportModalProps) {
  const [colleges, setColleges] = useState<AdminCollegeRow[]>([]);
  const [tplCollegeId, setTplCollegeId] = useState('');
  const [tplClassId, setTplClassId] = useState('');
  const [classOptions, setClassOptions] = useState<{ label: string; value: string }[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchAdminColleges()
      .then((c) => {
        if (!cancelled) setColleges(c.filter((x) => x.status === 'active'));
      })
      .catch(() => {
        if (!cancelled) setColleges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!tplCollegeId) {
      setClassOptions([]);
      setTplClassId('');
      return;
    }
    let cancelled = false;
    fetchAdminClasses(tplCollegeId)
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
  }, [tplCollegeId]);

  if (!isOpen) return null;

  const selectedCollege = colleges.find((c) => c.id === tplCollegeId);
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
      const cls = await fetchAdminClasses(tplCollegeId);
      if (!cls.length) {
        const cn = active.find((c) => c.id === tplCollegeId)?.name ?? '该学院';
        message.warning(`${cn}下没有班级，请先在学院下创建班级`);
        return;
      }
      if (!tplClassId) {
        message.warning('请选择班级');
        return;
      }
      const c = active.find((x) => x.id === tplCollegeId);
      const cl = cls.find((x) => x.id === tplClassId);
      if (!c || !cl) {
        message.error('学院或班级数据已变化，请重新选择');
        return;
      }
      const line1 = `# 学院,${c.name},id=${c.id} | 班级,${cl.name},id=${cl.id}（以下数据行勿含学院/班级列，导入时使用上方所选学院与班级）`;
      const header = '姓名,角色,学号或工号,邮箱';
      const rowStudent = '张三,学生,2021001001,';
      const rowTeacher = '李老师,教师,T2021001,li@example.com';
      const csvContent = `${line1}\n${header}\n${rowStudent}\n${rowTeacher}`;
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = '用户导入模板.csv';
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
    try {
      progressInterval = window.setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + 10;
        });
      }, 200);

      const text = await file.text();
      const parsed = parseCsvToRows(text);

      if (!tplCollegeId.trim()) {
        throw new Error('请先在上方选择学院，再开始导入');
      }
      let hasStudent = false;
      for (const p of parsed) {
        if (normalizeRoleLabel(p.role) === '学生') hasStudent = true;
      }
      if (hasStudent && !tplClassId.trim()) {
        throw new Error('文件中包含学生，请先在上方选择班级');
      }

      const rows: BatchImportRow[] = [];
      for (const p of parsed) {
        const rl = normalizeRoleLabel(p.role);
        rows.push({
          name: p.name.trim(),
          role: p.role.trim(),
          idNumber: p.idNumber.trim(),
          collegeId: tplCollegeId.trim(),
          ...(rl === '学生' && tplClassId.trim() ? { classId: tplClassId.trim() } : {}),
          ...(p.email?.trim() ? { email: p.email.trim() } : {}),
        });
      }
      if (!rows.length) {
        throw new Error('没有可导入的数据行');
      }
      const result = await onImport(rows);
      setUploadProgress(100);
      setImportResult(result);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      if (progressInterval) window.clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setImportResult(null);
    setTplCollegeId('');
    setTplClassId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">批量导入用户</h3>
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
                <div className="text-sm font-medium text-gray-800 mb-2">导入前：选择学院与班级</div>
                <Space wrap className="w-full">
                  <Select
                    className="min-w-[220px]"
                    placeholder="选择学院"
                    value={tplCollegeId || undefined}
                    onChange={(v) => {
                      setTplCollegeId(v);
                      setTplClassId('');
                    }}
                    options={colleges.map((c) => ({ label: `${c.name}（${c.id}）`, value: c.id }))}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Select
                    className="min-w-[260px]"
                    placeholder="选择班级"
                    disabled={!tplCollegeId}
                    value={tplClassId || undefined}
                    onChange={(v) => setTplClassId(v ?? '')}
                    options={classOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Space>
                {selectedCollege && tplClassId && selectedClassMeta && (
                  <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                    下载模板首行为说明（含学院、班级 id 供核对）。<strong>数据行仅含姓名、角色、学号或工号、邮箱</strong>
                    ；实际导入的学院与班级以本页上方选择为准。
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-information-line text-blue-600 text-lg mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">导入说明</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• 请使用 UTF-8 编码的 CSV；Excel 请先「另存为 CSV」</li>
                      <li>• 支持导入学生与教师：学生填学号，教师填工号（均在「学号或工号」列）</li>
                      <li>• 必填列：姓名、角色、学号或工号；邮箱可整列省略</li>
                      <li>• 学院、班级不在 CSV 中填写：请先在本页上方选择学院与班级，再下载模板或上传文件；学生将入所选班级，教师仅归属所选学院</li>
                      <li>• 若文件中包含学生，必须已选择班级；仅教师时可只选学院</li>
                      <li>• 邮箱为选填；初始密码为学号/工号后 6 位（与单个新建一致）</li>
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
                    <span className="text-gray-600">正在导入...</span>
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
                <p className="text-sm text-gray-600">
                  成功导入 <span className="text-green-600 font-semibold">{importResult.success}</span> 条，失败{' '}
                  <span className="text-red-600 font-semibold">{importResult.failed}</span> 条
                </p>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h5 className="text-sm font-medium text-red-900 mb-2">失败记录详情</h5>
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
