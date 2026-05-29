import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Spin, Input } from 'antd';
import {
  analyzeTeamFormationStream,
  deleteTeamVideo,
  fetchTeamQuestions,
  fetchTeamSubmission,
  isTeamFormationDone,
  resetTeamAssessment,
  saveTeamAnswers,
  submitTeamFormation,
  uploadTeamVideo,
  loadTeamIntroVideoObjectUrl,
  type TeamQuestion,
  TEAM_DIMENSION_BARS,
  normalizeTeamDimensionProfile,
  stripTeamAnalysisStreamDisplay,
  type TeamDimensionProfile,
} from '../../../lib/teamFormationApi';

const MAX_VIDEO = 50 * 1024 * 1024;

type Props = {
  classId: string;
  onSubmitted: () => void;
};

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-5 py-3 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-sm font-medium`;
  div.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i><span>${message}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

export default function TeamFormationAssessmentPanel({ classId, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<TeamQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [serverVideoName, setServerVideoName] = useState<string | null>(null);
  const [serverHasVideo, setServerHasVideo] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [serverPreviewUrl, setServerPreviewUrl] = useState<string | null>(null);
  const [videoUploaded, setVideoUploaded] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState('');
  const [aiMatchedRoleLabel, setAiMatchedRoleLabel] = useState<string | null>(null);
  const [dimensionProfile, setDimensionProfile] = useState<TeamDimensionProfile>({
    strategic: 0,
    market: 0,
    techRisk: 0,
  });
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [analysisBody, setAnalysisBody] = useState('');
  const [liveStreamText, setLiveStreamText] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswersRef = useRef<Record<string, string | string[]>>({});
  const streamAccumRef = useRef('');
  const liveStreamRef = useRef('');
  const streamBoxRef = useRef<HTMLDivElement | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, sub] = await Promise.all([fetchTeamQuestions(classId), fetchTeamSubmission(classId)]);
      setQuestions(qs);
      setAnswers((sub.answers || {}) as Record<string, string | string[]>);
      setAiMatchedRoleLabel(sub.aiMatchedRoleLabel);
      setDimensionProfile(normalizeTeamDimensionProfile(sub.dimensionProfile || {}));
      const savedBody = sub.analysisText?.trim();
      if (savedBody) {
        setAnalysisBody(savedBody);
        setAnalysisSummary(savedBody.slice(0, 280));
      }
      const hasVid = Boolean(sub.videoStorageKey);
      setServerHasVideo(hasVid);
      setServerVideoName(hasVid ? sub.videoStorageKey!.split('/').pop() || '已上传视频' : null);
      setVideoUploaded(Boolean(sub.videoStorageKey && sub.aiMatchedRole));
      setAssessmentCompleted(qs.length > 0 && Object.keys(sub.answers || {}).length >= qs.length);
      if (sub.videoStorageKey && !sub.aiMatchedRole) {
        setAssessmentCompleted(Object.keys(sub.answers || {}).length >= qs.length);
      }
      setWaitingForTeacher(isTeamFormationDone(sub.status));
      if (isTeamFormationDone(sub.status)) onSubmitted();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [classId, onSubmitted]);

  useEffect(() => {
    void loadAll();
    setCurrentQuestion(0);
  }, [loadAll]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!serverHasVideo || videoFile) {
      setServerPreviewUrl(null);
      return undefined;
    }
    let url: string | null = null;
    void loadTeamIntroVideoObjectUrl('student', classId)
      .then((u) => {
        url = u;
        setServerPreviewUrl(u);
      })
      .catch(() => setServerPreviewUrl(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [serverHasVideo, videoFile, classId]);

  useEffect(() => {
    if (!videoFile) {
      setLocalPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(videoFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const persistAnswersNow = async (next: Record<string, string | string[]>) => {
    try {
      await saveTeamAnswers(classId, next);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error');
    }
  };

  const schedulePersistAnswers = (next: Record<string, string | string[]>) => {
    pendingAnswersRef.current = next;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistAnswersNow(pendingAnswersRef.current);
    }, 500);
  };

  const flushPersistAnswers = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      await persistAnswersNow(pendingAnswersRef.current);
    }
  };

  const q = questions[currentQuestion];

  const setAnswerForCurrent = (value: string | string[], opts?: { autoNext?: boolean }) => {
    if (!q) return;
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    schedulePersistAnswers(next);
    if (opts?.autoNext && q.questionType === 'single') {
      setTimeout(() => {
        if (currentQuestion < questions.length - 1) {
          setCurrentQuestion(currentQuestion + 1);
        } else {
          setAssessmentCompleted(true);
          showToast('答题完成，请上传视频');
        }
      }, 200);
    }
  };

  const goNext = async () => {
    if (!q) return;
    await flushPersistAnswers();
    const val = answers[q.id];
    if (q.required && (val == null || val === '' || (Array.isArray(val) && val.length === 0))) {
      showToast('请先作答', 'error');
      return;
    }
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 200);
    } else {
      setAssessmentCompleted(true);
      showToast('答题完成，请上传视频');
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = String(file.type || '').toLowerCase();
    const name = file.name.toLowerCase();
    const ok = mime === 'video/mp4' || mime === 'video/webm' || name.endsWith('.mp4') || name.endsWith('.webm');
    if (!ok) {
      showToast('请上传 MP4 或 WebM 格式', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_VIDEO) {
      showToast('视频不能超过 50MB', 'error');
      e.target.value = '';
      return;
    }
    setVideoFile(file);
  };

  const appendLiveStream = (text: string) => {
    if (!text) return;
    liveStreamRef.current += text;
    const tail = liveStreamRef.current.slice(-8000);
    setLiveStreamText(tail);
  };

  useEffect(() => {
    if (!aiAnalyzing || !streamBoxRef.current) return;
    streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
  }, [liveStreamText, aiAnalyzing]);

  const handleRemoveVideo = () => {
    Modal.confirm({
      title: '删除已上传视频？',
      content: '将删除服务器上的视频文件，并清除本次 AI 分析结果。可重新选择视频上传。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTeamVideo(classId);
          setVideoFile(null);
          setServerVideoName(null);
          setServerHasVideo(false);
          setServerPreviewUrl(null);
          setVideoUploaded(false);
          setAiMatchedRoleLabel(null);
          setAnalysisSummary('');
          const input = document.getElementById('video-upload-tf') as HTMLInputElement | null;
          if (input) input.value = '';
          showToast('已删除视频');
        } catch (e) {
          showToast(e instanceof Error ? e.message : '删除失败', 'error');
        }
      },
    });
  };

  const handleRetakeAssessment = () => {
    Modal.confirm({
      title: '重新测评？',
      content: '将清空全部答题与 AI 分析结果，从第一题重新开始。已上传的视频会保留，也可自行删除后重新上传。',
      okText: '确认重新测评',
      cancelText: '取消',
      onOk: async () => {
        try {
          await resetTeamAssessment(classId);
          setAnswers({});
          pendingAnswersRef.current = {};
          setCurrentQuestion(0);
          setAssessmentCompleted(false);
          setVideoUploaded(false);
          setAiMatchedRoleLabel(null);
          setAnalysisSummary('');
          setLiveStreamText('');
          liveStreamRef.current = '';
          setAnalyzeError('');
          showToast('已重置，请重新答题');
        } catch (e) {
          showToast(e instanceof Error ? e.message : '重置失败', 'error');
        }
      },
    });
  };

  const handleSubmitVideo = async () => {
    if (!videoFile && !serverHasVideo) {
      showToast('请先选择或保留已上传视频', 'error');
      return;
    }
    setAiAnalyzing(true);
    setAnalyzeStep('正在上传视频…');
    setLiveStreamText('');
    liveStreamRef.current = '';
    setAnalyzeError('');
    setAnalysisSummary('');
    setAnalysisBody('');
    streamAccumRef.current = '';
    try {
      if (videoFile) {
        await uploadTeamVideo(classId, videoFile);
        const name = videoFile.name;
        setServerVideoName(name);
        setServerHasVideo(true);
        setVideoFile(null);
      }
      setAnalyzeStep('正在分析测评结果…');
      await analyzeTeamFormationStream(classId, {
        onStatus: (msg) => setAnalyzeStep(msg),
        onThinking: (t) => appendLiveStream(t),
        onContent: (t) => {
          streamAccumRef.current += t;
          appendLiveStream(t);
        },
        onError: (msg) => {
          setAnalyzeError(msg);
          setLiveStreamText((prev) => (prev ? prev : msg));
        },
        onDone: (result) => {
          setAiMatchedRoleLabel(result.aiMatchedRoleLabel);
          const body =
            (result.analysisText && result.analysisText.trim()) ||
            stripTeamAnalysisStreamDisplay(streamAccumRef.current);
          setAnalysisBody(body);
          setAnalysisSummary(result.summary?.trim() || body.slice(0, 280));
          if (result.dimensionProfile) {
            setDimensionProfile(normalizeTeamDimensionProfile(result.dimensionProfile));
          }
          setVideoUploaded(true);
          showToast('AI 分析完成');
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '分析失败';
      setAnalyzeError(msg);
      showToast(msg, 'error');
    } finally {
      setAiAnalyzing(false);
      setAnalyzeStep('');
    }
  };

  const handleSubmitPending = async () => {
    try {
      await submitTeamFormation(classId);
      setWaitingForTeacher(true);
      onSubmitted();
      showToast('已提交，等待教师组队');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '提交失败', 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Spin tip="加载组队测评…" />
      </div>
    );
  }

  if (questions.length < 3) {
    return (
      <div className="py-12 text-center text-gray-500 text-sm">
        教师尚未为本班配置组队测评题，请联系任课教师。
      </div>
    );
  }

  const dimensionBars = (
    <div className="grid grid-cols-3 gap-2 mt-4 max-w-md mx-auto text-left">
      {TEAM_DIMENSION_BARS.map((item) => (
        <div key={item.key} className="bg-white rounded-lg p-2.5 border border-orange-100">
          <p className="text-xs text-gray-500 mb-1">{item.label}</p>
          <p className="text-sm font-bold text-gray-900 mb-1.5">{dimensionProfile[item.key]}</p>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
              style={{ width: `${Math.min(100, dimensionProfile[item.key])}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  if (waitingForTeacher) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-8 text-center">
        <i className="ri-time-line text-4xl text-amber-500 mb-3 block" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">已提交，等待教师组队</h3>
        <p className="text-sm text-gray-600">
          {aiMatchedRoleLabel ? `AI 匹配角色：${aiMatchedRoleLabel}` : ''}
        </p>
        {dimensionBars}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!assessmentCompleted ? (
        <div className="flex-1 bg-white border-2 border-gray-100 rounded-xl p-5">
            <span className="inline-block px-2.5 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full mb-4">
              问题 {currentQuestion + 1}/{questions.length}
            </span>
            <h3 className="text-base font-bold text-gray-900 mb-5">{q?.title}</h3>
            {q?.questionType === 'short' && (
              <Input.TextArea
                maxLength={100}
                showCount
                rows={4}
                value={String(answers[q.id] ?? '')}
                onChange={(e) => setAnswerForCurrent(e.target.value)}
                placeholder="请输入（最多 100 字）"
              />
            )}
            {q?.questionType === 'single' && (
              <div className="space-y-2.5">
                {q.options.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setAnswerForCurrent(option.value, { autoNext: true })}
                    className={`w-full p-3.5 text-left border-2 rounded-xl transition-colors cursor-pointer ${
                      answers[q.id] === option.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <span className="text-sm text-gray-800">{option.label}</span>
                  </button>
                ))}
              </div>
            )}
            {q?.questionType === 'multi' && (
              <div className="space-y-2.5">
                {q.options.map((option, index) => {
                  const selected = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(option.value);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        const prev = Array.isArray(answers[q.id]) ? [...(answers[q.id] as string[])] : [];
                        const next = selected ? prev.filter((v) => v !== option.value) : [...prev, option.value];
                        setAnswerForCurrent(next);
                      }}
                      className={`w-full p-3.5 text-left border-2 rounded-xl transition-colors cursor-pointer ${
                        selected ? 'border-teal-500 bg-teal-50' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-sm text-gray-800">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              {currentQuestion > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentQuestion(currentQuestion - 1)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg cursor-pointer"
                >
                  上一题
                </button>
              )}
              <button
                type="button"
                onClick={() => void goNext()}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg cursor-pointer"
              >
                {currentQuestion < questions.length - 1 ? '下一题' : '完成答题'}
              </button>
            </div>
          </div>
      ) : !videoUploaded ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-5 text-white">
            <h3 className="text-base font-bold">答题完成</h3>
            <p className="text-white/80 text-xs mt-1">请上传自我介绍视频（≤50MB）</p>
          </div>
          <div className="bg-white border-2 border-gray-100 rounded-xl p-5">
            {!(videoFile || serverHasVideo) ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-xl p-6 text-center mb-4">
                <p className="text-xs text-gray-500 mb-4">支持 MP4、WebM，最大 50MB，需浏览器可在线预览</p>
                <input
                  type="file"
                  accept="video/mp4,video/webm,.mp4,.webm"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload-tf"
                />
                <label
                  htmlFor="video-upload-tf"
                  className="inline-block px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium rounded-xl cursor-pointer"
                >
                  选择视频
                </label>
              </div>
            ) : null}
            {(localPreviewUrl || serverPreviewUrl) && (
              <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 bg-black">
                <video
                  src={localPreviewUrl || serverPreviewUrl || undefined}
                  controls
                  className="w-full max-h-64"
                  playsInline
                />
              </div>
            )}
            {(videoFile || serverVideoName) && (
              <div className="flex items-center justify-between gap-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-600 min-w-0 truncate">
                  {videoFile
                    ? `${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`
                    : `已上传：${serverVideoName}`}
                </p>
                <button
                  type="button"
                  onClick={handleRemoveVideo}
                  disabled={aiAnalyzing}
                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded cursor-pointer whitespace-nowrap flex-shrink-0"
                >
                  删除视频
                </button>
              </div>
            )}
            {analyzeError && !aiAnalyzing && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <i className="ri-error-warning-line mr-1.5"></i>
                {analyzeError}
              </div>
            )}
            {aiAnalyzing && (
              <div className="mb-4 rounded-xl border border-teal-200 bg-gradient-to-b from-white to-teal-50/40 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-teal-100 bg-teal-50/80">
                  <Spin size="small" />
                  <span className="text-sm font-medium text-teal-900">{analyzeStep || 'AI 分析中…'}</span>
                </div>
                <div
                  ref={streamBoxRef}
                  className="min-h-[10rem] max-h-56 overflow-y-auto px-4 py-3"
                >
                  {liveStreamText ? (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{liveStreamText}</p>
                  ) : (
                    <p className="text-xs text-gray-500 animate-pulse">
                      正在连接大模型，思考过程将在此实时显示…
                    </p>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSubmitVideo()}
              disabled={(!videoFile && !serverHasVideo) || aiAnalyzing}
              className="w-full px-5 py-3 text-sm font-medium rounded-xl bg-teal-600 text-white disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer"
            >
              {aiAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <Spin size="small" />
                  {analyzeStep || 'AI 分析中…'}
                </span>
              ) : (
                '提交并开始分析'
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-5 text-white">
            <h3 className="text-base font-bold">AI 分析完成</h3>
            <p className="text-sm mt-2">匹配角色：{aiMatchedRoleLabel || '—'}</p>
          </div>
          {(analysisBody || analysisSummary) ? (
            <div className="bg-white border border-teal-100 rounded-xl p-4 shadow-sm max-h-64 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {analysisBody || analysisSummary}
              </p>
            </div>
          ) : null}
          {dimensionBars}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSubmitPending()}
              className="flex-1 px-5 py-3 bg-teal-600 text-white text-sm font-medium rounded-xl cursor-pointer"
            >
              提交并等待教师组队
            </button>
            <button
              type="button"
              onClick={handleRetakeAssessment}
              className="flex-1 px-5 py-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 cursor-pointer"
            >
              重新测评
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
