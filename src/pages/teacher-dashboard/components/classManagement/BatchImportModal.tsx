import { useState, useRef } from 'react';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, classId: string) => Promise<{ success: number; failed: number; errors: { row: number; reason: string }[] }>;
  classId: string;
}

export default function BatchImportModal({ isOpen, onClose, onImport, classId }: BatchImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: { row: number; reason: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('请先选择文件');
      return;
    }

    setImporting(true);
    try {
      const importResult = await onImport(file, classId);
      setResult(importResult);
    } catch (error) {
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const csvContent = '姓名,学号,邮箱\n张三,2021001,zhangsan@student.edu\n李四,2021002,lisi@student.edu';
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '学生名单导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={handleClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">批量导入学生名单</h3>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!result ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-information-line text-blue-600 text-lg mt-0.5"></i>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-blue-900 mb-1">导入说明</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• 支持 CSV、Excel 格式文件</li>
                      <li>• 文件必须包含：姓名、学号、邮箱三列</li>
                      <li>• 学号不能重复</li>
                      <li>• 邮箱格式必须正确</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line"></i>
                  下载导入模板
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择文件</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-500 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <i className="ri-upload-cloud-line text-4xl text-gray-400 mb-2 block"></i>
                    <p className="text-sm text-gray-600 mb-1">点击选择文件或拖拽文件到此处</p>
                    <p className="text-xs text-gray-400">支持 CSV、Excel 格式</p>
                  </label>
                  {file && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-teal-600">
                      <i className="ri-file-text-line"></i>
                      <span>{file.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-xl p-5 ${result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <i className={`${result.failed === 0 ? 'ri-checkbox-circle-line text-green-600' : 'ri-error-warning-line text-amber-600'} text-2xl`}></i>
                  <div>
                    <h4 className={`text-base font-bold ${result.failed === 0 ? 'text-green-900' : 'text-amber-900'}`}>
                      导入完成
                    </h4>
                    <p className={`text-sm ${result.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                      成功导入 {result.success} 名学生{result.failed > 0 && `，失败 ${result.failed} 条`}
                    </p>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-2">失败详情</h5>
                  <div className="bg-white border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">行号</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">失败原因</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {result.errors.map((error, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-gray-900">第 {error.row} 行</td>
                            <td className="px-4 py-2 text-red-600">{error.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          {!result ? (
            <>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  !file || importing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`}
              >
                {importing ? '导入中...' : '开始导入'}
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium cursor-pointer whitespace-nowrap"
              >
                取消
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium cursor-pointer whitespace-nowrap"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}