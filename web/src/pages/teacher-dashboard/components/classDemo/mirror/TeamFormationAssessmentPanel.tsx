import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Spin, Input } from 'antd';
import {
  analyzeTeamFormationStream,
  deleteTeamVideo,
  fetchTeamQuestions,
  fetchTeamSubmission,
  resetTeamAssessment,
  saveTeamAnswers,
  submitTeamFormation,
  uploadTeamVideo,
  withdrawTeamFormationPool,
  loadTeamIntroVideoObjectUrl,
  type TeamQuestion,
  TEAM_DIMENSION_BARS,
  normalizeTeamDimensionProfile,
  stripTeamAnalysisStreamDisplay,
  type TeamDimensionProfile,
  fetchTeamFormationWithdrawEligibility,
} from '../demoTeamApi';
import { DemoMarkdown } from '../demoMarkdown';
import { appAlert, appConfirm } from '../../../../../lib/appDialog';

const MAX_VIDEO = 50 * 1024 * 1024;

type Props = {
  classId: string;
  onSubmitted: (mode: 'pool' | 'solo') => void;
  /** 撤回组队池申请后回调，父级可刷新等待态并切回测评 */
  onPoolWithdrawn?: () => void;
};

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-5 py-3 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-sm font-medium`;
  div.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i><span>${message}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

export default function TeamFormationAssessmentPanel({ classId, onSubmitted, onPoolWithdrawn }: Props) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<TeamQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
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
  const [introVideoOpen, setIntroVideoOpen] = useState(false);
  const [groupingModalOpen, setGroupingModalOpen] = useState(false);
  const [submittingGrouping, setSubmittingGrouping] = useState(false);
  const [withdrawingPool, setWithdrawingPool] = useState(false);
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
      // videoUploaded：表示 AI 分析已完成（与是否上传视频无关）
      setVideoUploaded(Boolean(sub.aiMatchedRole));
      if (
        !sub.aiMatchedRole &&
        qs.length > 0 &&
        Object.keys(sub.answers || {}).length >= qs.length
      ) {
        setCurrentQuestion(Math.max(0, qs.length - 1));
      }
      setWaitingForTeacher(sub.status === 'pending_teacher');
      if (sub.status === 'pending_teacher') {
        onSubmitted('pool');
      } else if (sub.status === 'confirmed' && sub.groupingPreference === 'solo') {
        onSubmitted('solo');
      }
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
    }
  };

  const appendLiveStream = (text: string) => {
    if (!text) return;
    liveStreamRef.current += text;
    const tail = liveStreamRef.current.slice(-8000);
    setLiveStreamText(tail);
  };

  const handleSubmitVideo = async () => {
    setAiAnalyzing(true);
    setAnalyzeStep(videoFile ? '正在上传视频…' : '正在提交分析…');
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

  /** 最后一题：校验后提交 AI 分析 */
  const handleSubmitForAnalysis = async () => {
    if (!q) return;
    await flushPersistAnswers();
    const val = answers[q.id];
    if (q.required && (val == null || val === '' || (Array.isArray(val) && val.length === 0))) {
      showToast('请先作答', 'error');
      return;
    }
    await handleSubmitVideo();
  };

  const handleQuizPrimaryClick = async () => {
    if (currentQuestion < questions.length - 1) {
      await goNext();
      return;
    }
    await handleSubmitForAnalysis();
  };

  const isLastQuestion = questions.length > 0 && currentQuestion >= questions.length - 1;

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

  const hasIntroVideo = Boolean(videoFile || serverHasVideo);

  const introVideoDialog = (
    <Modal
      title="个人介绍（非必选）"
      open={introVideoOpen}
      onCancel={() => setIntroVideoOpen(false)}
      footer={
        <button
          type="button"
          onClick={() => setIntroVideoOpen(false)}
          className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg cursor-pointer"
        >
          关闭
        </button>
      }
      destroyOnClose={false}
      width={520}
    >
      <p className="text-xs text-gray-500 mb-4">支持 MP4、WebM，最大 50MB。可在答题任意时刻上传，提交 AI 分析时一并处理。</p>
      {!(videoFile || serverHasVideo) ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-xl p-6 text-center mb-4">
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
        <div className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
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
    </Modal>
  );

  const handleConfirmGrouping = async (preference: 'pool' | 'solo') => {
    setSubmittingGrouping(true);
    try {
      const result = await submitTeamFormation(classId, preference);
      setGroupingModalOpen(false);
      if (preference === 'solo' || result.solo) {
        showToast('已成立单人公司，可前往「我的团队」完善信息');
        onSubmitted('solo');
        return;
      }
      setWaitingForTeacher(true);
      onSubmitted('pool');
      showToast('已加入组队池，等待教师智能组队');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '提交失败', 'error');
    } finally {
      setSubmittingGrouping(false);
    }
  };

  const handleSubmitPending = () => {
    setGroupingModalOpen(true);
  };

  const handleWithdrawPool = async () => {
    setWithdrawingPool(true);
    try {
      const gate = await fetchTeamFormationWithdrawEligibility(classId);
      if (!gate.canWithdraw) {
        await appAlert(gate.reason || '当前状态不可撤回组队', '无法撤回');
        return;
      }
      const ok = await appConfirm(
        '撤回后将退出组队池或解散单人公司，可重新选择「进入组队池」或「成立单人公司」。测评与 AI 分析结果会保留。',
        '撤回组队申请',
        { okText: '确认撤回', cancelText: '取消', danger: true }
      );
      if (!ok) return;
      await withdrawTeamFormationPool(classId);
      setWaitingForTeacher(false);
      showToast('已撤回组队申请，可重新选择组队方式');
      onPoolWithdrawn?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '撤回失败';
      if (/无法|不可|请联系教师|已分配|已开始|AI 分析/.test(msg)) {
        await appAlert(msg, '无法撤回');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setWithdrawingPool(false);
    }
  };

  const groupingChoiceModal = (
    <Modal
      title="选择组队方式"
      open={groupingModalOpen}
      onCancel={() => !submittingGrouping && setGroupingModalOpen(false)}
      footer={null}
      width={480}
      destroyOnClose={false}
    >
      <p className="text-sm text-gray-600 mb-4">
        测评与 AI 分析已完成。请选择后续组队方式（可随时在「我的团队」查看状态）。
      </p>
      <div className="space-y-3">
        <button
          type="button"
          disabled={submittingGrouping}
          onClick={() => void handleConfirmGrouping('pool')}
          className="w-full text-left p-4 rounded-xl border-2 border-teal-200 bg-teal-50/50 hover:border-teal-400 transition-colors cursor-pointer disabled:opacity-60"
        >
          <div className="font-semibold text-gray-900 mb-1">进入组队池</div>
          <p className="text-xs text-gray-600">
            加入班级待分组队列，由教师使用 AI 智能组队与其他同学组成 3～6 人创业团队。
          </p>
        </button>
        <button
          type="button"
          disabled={submittingGrouping}
          onClick={() => void handleConfirmGrouping('solo')}
          className="w-full text-left p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:border-indigo-400 transition-colors cursor-pointer disabled:opacity-60"
        >
          <div className="font-semibold text-gray-900 mb-1">成立单人公司</div>
          <p className="text-xs text-gray-600">
            立即创建仅含你一人的团队，不参与智能组队；后续实训按团队流程由你一人完成队长职责。
          </p>
        </button>
      </div>
      {submittingGrouping ? (
        <div className="flex justify-center items-center gap-2 mt-4 text-sm text-gray-500">
          <Spin size="small" />
          提交中…
        </div>
      ) : null}
    </Modal>
  );

  const introVideoButton = (
    <button
      type="button"
      onClick={() => setIntroVideoOpen(true)}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-blue-200 text-blue-700 bg-blue-50/80 rounded-lg hover:bg-blue-50 cursor-pointer"
    >
      <i className="ri-video-upload-line text-base" />
      个人介绍（非必选）
      {hasIntroVideo ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800">已添加</span>
      ) : null}
    </button>
  );

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
        <p className="text-sm text-gray-600 mb-4">
          {aiMatchedRoleLabel ? `AI 匹配角色：${aiMatchedRoleLabel}` : ''}
        </p>
        {dimensionBars}
        <button
          type="button"
          disabled={withdrawingPool}
          onClick={() => void handleWithdrawPool()}
          className="mt-6 px-5 py-2.5 border border-orange-300 text-orange-700 bg-white text-sm font-medium rounded-xl hover:bg-orange-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {withdrawingPool ? '撤回中…' : '撤回提交，重新选择组队方式'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!videoUploaded ? (
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
            {analyzeError && !aiAnalyzing && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <i className="ri-error-warning-line mr-1.5"></i>
                {analyzeError}
              </div>
            )}
            {aiAnalyzing && (
              <div className="mt-4 rounded-xl border border-teal-200 bg-gradient-to-b from-white to-teal-50/40 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-teal-100 bg-teal-50/80">
                  <Spin size="small" />
                  <span className="text-sm font-medium text-teal-900">{analyzeStep || 'AI 分析中…'}</span>
                </div>
                <div
                  ref={streamBoxRef}
                  className="min-h-[10rem] max-h-56 overflow-y-auto px-4 py-3"
                >
                  {liveStreamText ? (
                    <DemoMarkdown text={liveStreamText} className="text-xs text-gray-700 leading-relaxed" />
                  ) : (
                    <p className="text-xs text-gray-500 animate-pulse">
                      正在连接大模型，思考过程将在此实时显示…
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 mt-6">
              {currentQuestion > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentQuestion(currentQuestion - 1)}
                  disabled={aiAnalyzing}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  上一题
                </button>
              )}
              {isLastQuestion ? introVideoButton : null}
              <button
                type="button"
                onClick={() => void handleQuizPrimaryClick()}
                disabled={aiAnalyzing}
                className="inline-flex items-center justify-center gap-2 min-w-[8.5rem] px-4 py-2 text-sm bg-teal-600 text-white rounded-lg cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {aiAnalyzing && isLastQuestion ? (
                  <>
                    <Spin size="small" />
                    <span>{analyzeStep || 'AI 分析中…'}</span>
                  </>
                ) : isLastQuestion ? (
                  '提交给 AI 分析'
                ) : (
                  '下一题'
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
          {dimensionBars}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmitPending}
              className="flex-1 px-5 py-3 bg-teal-600 text-white text-sm font-medium rounded-xl cursor-pointer"
            >
              选择组队方式并提交
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
      {introVideoDialog}
      {groupingChoiceModal}
    </div>
  );
}
