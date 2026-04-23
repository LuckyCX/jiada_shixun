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
  
  // 商业计划书内容
  executiveSummary: string;
  marketAnalysis: string;
  productService: string;
  marketingStrategy: string;
  operationPlan: string;
  financialPlan: string;
  teamIntroduction: string;
  riskAnalysis: string;
  
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
}