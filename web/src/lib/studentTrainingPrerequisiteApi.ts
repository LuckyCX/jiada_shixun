import { portalAuthenticatedFetch } from './authApi';
import type { ModulePrerequisiteResult } from './trainingModulePrerequisite';

export type TrainingModulePrerequisitePayload = ModulePrerequisiteResult & {
  allowed: boolean;
  prerequisiteModuleKey: string;
  requiredKnowledgePointCount: number;
  passedKnowledgePointCount: number;
};

export async function fetchTrainingModulePrerequisite(
  classId: string,
  moduleKey: string
): Promise<TrainingModulePrerequisitePayload> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${classId}/training-modules/${moduleKey}/prerequisite`
  ) as Promise<TrainingModulePrerequisitePayload>;
}
