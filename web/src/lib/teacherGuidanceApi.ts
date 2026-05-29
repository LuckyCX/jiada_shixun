import { getPortalToken } from './authApi';
import { teacherFetch } from '../pages/teacher-dashboard/teacherPortalApi';

export type GuidanceMessageType = 'broadcast' | 'oneOnOne' | 'resource' | 'urge';
export type GuidanceTargetScope = 'all' | 'team' | 'student';
export type GuidanceUrgency = 'urgent' | 'high' | 'normal' | 'low';

export type TeacherGuidanceAttachmentItem = {
  id: string;
  fileName: string;
  fileSize: number;
};

export type TeacherGuidanceHistoryRecord = {
  id: string;
  guidanceType: GuidanceMessageType;
  target: string;
  content: string;
  time: string;
  /** ISO 时间，用于历史列表排序 */
  sentAt?: string;
  status: 'sent' | 'read' | 'replied';
  recipientCount: number;
  readCount: number;
  targetScope?: GuidanceTargetScope;
  teamId?: string;
  studentId?: string;
  urgency?: GuidanceUrgency;
  attachments?: TeacherGuidanceAttachmentItem[];
  withdrawn?: boolean;
  makeupDeadline?: string;
};

export type WithdrawnGuidanceSnapshot = {
  id: string;
  guidanceType: GuidanceMessageType;
  target: string;
  content: string;
  time: string;
  targetScope: GuidanceTargetScope;
  teamId?: string;
  studentId?: string;
  urgency?: GuidanceUrgency;
  sortAt: number;
};

export type StudentGuidanceAttachment = {
  id: string;
  fileName: string;
  fileSize: number;
};

export async function sendTeacherGuidanceMessage(
  classId: string,
  body: {
    guidanceType: GuidanceMessageType;
    targetScope: GuidanceTargetScope;
    content: string;
    urgency?: GuidanceUrgency;
    teamId?: string;
    studentId?: string;
    makeupDeadline?: string;
  },
  files?: File[]
): Promise<{ sent: number; targetLabel: string; title: string }> {
  if (files?.length) {
    const fd = new FormData();
    fd.append('guidanceType', body.guidanceType);
    fd.append('targetScope', body.targetScope);
    fd.append('content', body.content);
    if (body.urgency) fd.append('urgency', body.urgency);
    if (body.teamId) fd.append('teamId', body.teamId);
    if (body.studentId) fd.append('studentId', body.studentId);
    if (body.makeupDeadline) fd.append('makeupDeadline', body.makeupDeadline);
    files.forEach((f) => fd.append('files', f));
    const token = getPortalToken('teacher') || '';
    const r = await fetch(`/api/teacher/personal-classes/${encodeURIComponent(classId)}/guidance/messages`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
    if (!r.ok || j.code !== 0) throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
    return j.data as { sent: number; targetLabel: string; title: string };
  }
  return teacherFetch(`/api/teacher/personal-classes/${classId}/guidance/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{ sent: number; targetLabel: string; title: string }>;
}

export async function listTeacherGuidanceMessages(classId: string): Promise<TeacherGuidanceHistoryRecord[]> {
  const data = (await teacherFetch(`/api/teacher/personal-classes/${classId}/guidance/messages`)) as {
    records?: TeacherGuidanceHistoryRecord[];
  };
  return Array.isArray(data?.records) ? data.records : [];
}

export async function deleteTeacherGuidanceHistory(
  classId: string,
  historyId: string
): Promise<void> {
  await teacherFetch(
    `/api/teacher/personal-classes/${classId}/guidance/history/${historyId}`,
    { method: 'DELETE' }
  );
}

export async function withdrawTeacherGuidanceMessage(
  classId: string,
  messageId: string
): Promise<{
  guidanceType: GuidanceMessageType;
  targetScope: GuidanceTargetScope;
  content: string;
  target: string;
  teamId?: string;
  studentId?: string;
  urgency?: GuidanceUrgency;
}> {
  return teacherFetch(
    `/api/teacher/personal-classes/${classId}/guidance/messages/${messageId}`,
    { method: 'DELETE' }
  ) as Promise<{
    guidanceType: GuidanceMessageType;
    targetScope: GuidanceTargetScope;
    content: string;
    target: string;
    teamId?: string;
    studentId?: string;
    urgency?: GuidanceUrgency;
  }>;
}

export async function downloadTeacherGuidanceAttachment(
  classId: string,
  attachmentId: string,
  fileName: string
) {
  const token = getPortalToken('teacher') || '';
  const r = await fetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/guidance-attachments/${encodeURIComponent(attachmentId)}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || '附件';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadStudentGuidanceAttachment(attachmentId: string, fileName: string) {
  const token = getPortalToken('student') || '';
  const r = await fetch(`/api/student/guidance-attachments/${encodeURIComponent(attachmentId)}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || '附件';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
