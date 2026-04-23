export interface TopicSubmission {
  id: string;
  teamId: string;
  teamName: string;
  leaderName: string;
  memberCount: number;
  projectName: string;
  direction: string;
  description: string;
  targetUsers: string;
  coreValue: string;
  marketSize: string;
  competitiveAdvantage: string;
  submitTime: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewComment?: string;
  reviewTime?: string;
}