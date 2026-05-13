export interface Task {
  id: number;
  title: string;
  description: string;
  module: string;
  deadline: string;
  attachments: { name: string; url: string; size: string }[];
  scope: 'all' | 'specific';
  targetTeams: string[];
  status: 'published' | 'draft' | 'expired';
  publishedAt: string;
  publishedBy: string;
  submissionCount: number;
  totalTargets: number;
}

export interface TaskFormData {
  title: string;
  description: string;
  module: string;
  deadline: string;
  attachments: File[];
  scope: 'all' | 'specific';
  targetTeams: string[];
}