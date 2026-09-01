import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { COURSE_SETTING_STAGES } from '../routes/courseSettings.js';
import { formatCalendarDateFromPg } from '../lib/calendarDate.js';

const stageNameByKey = new Map(COURSE_SETTING_STAGES.map((stage) => [stage.key, stage.name]));
let running = false;
let started = false;

function dateOnly(value) {
  return formatCalendarDateFromPg(value);
}

async function notifySetting(client, setting) {
  const { rows: students } = await client.query(
    `SELECT student_id FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1`,
    [setting.teacher_personal_class_id]
  );
  const stageName = stageNameByKey.get(setting.module_key) || '实训任务';
  const deadline = dateOnly(setting.deadline_date);
  const reminderDays = Number(setting.reminder_days || 0);
  const title = `${stageName}截止提醒`;
  const content = `「${setting.class_name}」${stageName}将于 ${deadline} 截止，请按时完成相关任务。`;
  const relatedLink = setting.module_key === 'team' ? '/student-center?tab=module-team' : '/student-center?tab=overview';

  for (const row of students) {
    await client.query(
      `INSERT INTO notifications (receiver_id, sender_id, type, title, content, related_module, related_link, is_read)
       VALUES ($1, $2, 'reminder', $3, $4, 'course_setting', $5, false)`,
      [row.student_id, setting.teacher_id, title, reminderDays > 0 ? `截止前 ${reminderDays} 天提醒：${content}` : content, relatedLink]
    );
  }
}

export async function runCourseSettingReminderScan() {
  if (running) return;
  running = true;
  let client;
  try {
    // connect 必须在 try 内：PG 重启/断连时否则会变成未捕获异常打垮整个 API 进程
    client = await getPool().connect();
    const { rows } = await client.query(
      `SELECT cs.id, cs.teacher_personal_class_id, cs.teacher_id, cs.module_key,
              cs.deadline_date, cs.reminder_days, tpc.name AS class_name
       FROM teacher_personal_class_course_settings cs
       JOIN teacher_personal_classes tpc ON tpc.id = cs.teacher_personal_class_id
       WHERE cs.reminder_enabled = true
         AND cs.deadline_date IS NOT NULL
         AND CURRENT_DATE BETWEEN (cs.deadline_date - cs.reminder_days::int) AND cs.deadline_date
         AND cs.last_reminded_deadline IS DISTINCT FROM cs.deadline_date
       ORDER BY cs.deadline_date ASC, cs.id ASC
       LIMIT 200`
    );

    for (const setting of rows) {
      await client.query('BEGIN');
      try {
        await notifySetting(client, setting);
        await client.query(
          `UPDATE teacher_personal_class_course_settings
           SET last_reminded_at = now(), last_reminded_deadline = deadline_date, updated_at = now()
           WHERE id = $1`,
          [setting.id]
        );
        await client.query('COMMIT');
      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          logError(`course setting reminder rollback settingId=${setting.id}`, rollbackErr);
        }
        logError(`course setting reminder settingId=${setting.id}`, e);
      }
    }
  } catch (e) {
    logError('course setting reminder scan', e);
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseErr) {
        logError('course setting reminder release', releaseErr);
      }
    }
    running = false;
  }
}

export function startCourseSettingReminderJob() {
  if (started) return;
  started = true;
  const intervalMs = 60 * 60 * 1000;
  const tick = () => {
    void runCourseSettingReminderScan().catch((e) => logError('course setting reminder tick', e));
  };
  setTimeout(tick, 10000);
  setInterval(tick, intervalMs);
}
