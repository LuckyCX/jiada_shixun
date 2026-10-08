export interface BusinessPlan {
  id: string;
  teamId: string;
  teamName: string;
  projectName: string;
  submitTime: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewComment?: string;
  reviewTime?: string;
  reviewer?: string;
  scores?: Record<string, number>;
  totalScore?: number | null;

  // 商业计划书内容
  executiveSummary: string;
  marketAnalysis: string;
  productService: string;
  marketingStrategy: string;
  operationPlan: string;
  financialPlan: string;
  teamIntroduction: string;
  riskAnalysis: string;

  /** 动态章节（后端返回） */
  sections?: Array<{ key: string; title: string; content: string }>;
  fullText?: string;
  cover?: {
    projectName?: string;
    leader?: string;
    members?: string[];
    collegeClass?: string;
    advisor?: string;
  };

  // 附件
  pptUrl?: string;
  attachments?: Array<{
    name: string;
    url: string;
    size: string;
  }>;
}

export interface ReviewFormData {
  status: 'approved' | 'rejected';
  comment: string;
  scores: Record<string, number>;
}