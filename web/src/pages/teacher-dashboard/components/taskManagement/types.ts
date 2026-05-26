import type { Dayjs } from 'dayjs';
import type { PersonalClassTask, TaskPriority } from '../../../../lib/personalClassTaskApi';

export type Task = PersonalClassTask;

export type TaskFormValues = {
  title: string;
  description: string;
  module: string;
  priority: TaskPriority;
  deadline: Dayjs | string;
  attachmentsEnabled: boolean;
  requiresStudentAttachment: boolean;
  scope: 'all' | 'specific';
  teamIds: string[];
};
