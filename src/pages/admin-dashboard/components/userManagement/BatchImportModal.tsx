import { useState } from 'react';
import { ImportResult } from './types';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<ImportResult>;
}

export default function BatchImportModal({ isOpen, onClose, onImport }: BatchImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  if (!isOpen) return null;

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
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = '姓名,学号,邮箱,院系,班级\n张三,2021001001,zhangsan@university.edu.cn,计算机科学与技术学院,软件工程2021级1班\n李四,2021001002,lisi@university.edu.cn,计算机科学与技术学院,软件工程2021级1班';
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '学生导入模板.csv';
    link.click();
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    // 模拟上传进度
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const result = await onImport(file);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setImportResult(result);
    } catch (error) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setImportResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">批量导入学生</h3>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!importResult ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-information-line text-blue-600 text-lg mt-0.5"></i>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">导入说明</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• 支持 Excel 格式（.xlsx、.xls）</li>
                      <li>• 必填字段：姓名、学号、邮箱、院系</li>
                      <li>• 系统将自动生成初始密码并发送至学生邮箱</li>
                      <li>• 单次最多导入 500 条数据</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">上传文件</h4>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap"
                >
                  <i className="ri-download-line mr-1"></i>
                  下载导入模板
                </button>
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
                      <i className="ri-file-excel-2-line text-3xl text-green-600"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                    >
                      <i className="ri-delete-bin-line mr-1"></i>
                      移除文件
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
                      <i className="ri-upload-cloud-2-line text-3xl text-gray-400"></i>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">拖拽文件到此处，或</p>
                      <label className="inline-block px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-folder-open-line mr-1"></i>
                        选择文件
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">支持 .xlsx、.xls 格式</p>
                  </div>
                )}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">正在解析导入...</span>
                    <span className="text-teal-600 font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-600 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  取消
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isUploading ? '导入中...' : '开始导入'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  importResult.failed === 0 ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  <i className={`text-4xl ${
                    importResult.failed === 0 ? 'ri-checkbox-circle-line text-green-600' : 'ri-error-warning-line text-yellow-600'
                  }`}></i>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">导入完成</h4>
                <p className="text-sm text-gray-600">
                  成功导入 <span className="text-green-600 font-semibold">{importResult.success}</span> 条，
                  失败 <span className="text-red-600 font-semibold">{importResult.failed}</span> 条
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
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  完成
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}