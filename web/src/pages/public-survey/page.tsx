import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Checkbox, Form, Input, Radio, Rate, Spin, message } from 'antd';
import {
  fetchPublicMarketSurvey,
  submitPublicMarketSurvey,
  type MarketSurveyQuestion,
} from '../../lib/studentMarketResearchApi';

export default function PublicSurveyPage() {
  const { slug = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'published' | 'withdrawn'>('published');
  const [questions, setQuestions] = useState<MarketSurveyQuestion[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    void fetchPublicMarketSurvey(slug)
      .then((data) => {
        setTitle(data.title);
        setStatus(data.status);
        setQuestions(data.questions || []);
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '加载失败');
        setQuestions([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const onFinish = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await submitPublicMarketSurvey(slug, values as Record<string, string | number | string[]>);
      setSubmitted(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50">
        <Spin size="large" />
      </div>
    );
  }

  if (status === 'withdrawn') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50 p-6">
        <Alert type="warning" showIcon message="问卷已暂停" description="该问卷已撤回，暂不接受填写。" className="max-w-md" />
      </div>
    );
  }

  if (!questions.length && !submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50 p-6">
        <Alert type="error" showIcon message="问卷不可用" className="max-w-md" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
          <i className="ri-checkbox-circle-fill text-5xl text-green-500 mb-4 block"></i>
          <h1 className="text-xl font-bold text-gray-900 mb-2">提交成功</h1>
          <p className="text-gray-600 text-sm">感谢您的参与</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 py-0 px-0">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-green-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-teal-500 px-8 py-6 text-white">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-white/90 mt-1">创业实训 · 市场调研问卷</p>
        </div>
        <Form form={form} layout="vertical" className="p-8 space-y-4" onFinish={(v) => void onFinish(v)}>
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-xl border border-green-100 bg-gradient-to-br from-white to-green-50/40 p-5 shadow-sm"
            >
              <div className="text-base font-medium text-gray-900 mb-4 leading-relaxed">
                <span className="text-green-600 mr-1">{idx + 1}.</span>
                {q.text}
              </div>
              <Form.Item name={q.id} rules={[{ required: true, message: '请完成此题' }]} className="mb-0">
                {q.type === '单选' && (
                  <Radio.Group className="flex flex-col gap-2 w-full">
                    {(q.options || []).map((opt) => (
                      <Radio
                        key={opt}
                        value={opt}
                        className="!m-0 !flex items-center w-full rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-green-300 [&.ant-radio-wrapper-checked]:border-green-500 [&.ant-radio-wrapper-checked]:bg-green-50/80 [&_.ant-radio]:top-0 [&_.ant-radio+span]:flex-1 [&_.ant-radio+span]:pl-2"
                      >
                        {opt}
                      </Radio>
                    ))}
                  </Radio.Group>
                )}
                {q.type === '多选' && (
                  <Checkbox.Group className="flex flex-col gap-2 w-full">
                    {(q.options || []).map((opt) => (
                      <Checkbox
                        key={opt}
                        value={opt}
                        className="!m-0 !flex items-center w-full rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-green-300 [&.ant-checkbox-wrapper-checked]:border-green-500 [&.ant-checkbox-wrapper-checked]:bg-green-50/80 [&_.ant-checkbox]:top-0 [&_.ant-checkbox+span]:flex-1 [&_.ant-checkbox+span]:pl-2"
                      >
                        {opt}
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                )}
                {q.type === '评分' && <Rate count={5} />}
                {q.type === '填空' && <Input.TextArea rows={3} placeholder="请输入" />}
              </Form.Item>
            </div>
          ))}
          <Button type="primary" htmlType="submit" loading={submitting} block size="large" className="!bg-green-500 hover:!bg-green-600">
            提交问卷
          </Button>
        </Form>
      </div>
    </div>
  );
}
