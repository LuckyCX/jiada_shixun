
export interface ResearchPlan {
  goal: string;
  methods: string[];
  members: { role: string; member: string }[];
  startDate: string;
  endDate: string;
  savedAt?: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: '单选' | '多选' | '评分' | '填空';
  options?: string[];
}

export interface Survey {
  id: string;
  title: string;
  status: '进行中' | '草稿' | '已完成';
  questions: SurveyQuestion[];
  collected: number;
  target: number;
  link: string;
  createdAt: string;
  fromPlan?: boolean;
}

export interface AnalysisData {
  ageDistribution: { label: string; value: number; color: string }[];
  spendingDistribution: { label: string; value: number; color: string }[];
  satisfactionDistribution: { label: string; value: number; color: string }[];
  improvementNeeds: { label: string; value: number }[];
}

export interface UserPersona {
  id: string;
  name: string;
  age: number;
  occupation: string;
  major: string;
  avatar: string;
  painPoints: string[];
  needs: string[];
  habits: string[];
  borderColor: string;
  accentColor: string;
  fromSurvey?: boolean;
}
