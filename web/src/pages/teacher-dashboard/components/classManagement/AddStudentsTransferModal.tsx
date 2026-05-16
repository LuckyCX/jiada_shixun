import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Select, Space, Spin, Transfer, message } from 'antd';
import type { TransferItem } from 'antd/es/transfer';
import { useTranslation } from 'react-i18next';

import {
  fetchPublicColleges,
  fetchTeacherAdminClasses,
  fetchTeacherStudentPool,
  listPersonalClassStudents,
  putPersonalClassStudents,
  type TeacherPooledStudent,
  type TeacherRosterStudent,
} from '../../teacherPortalApi';

interface AddStudentsTransferModalProps {
  open: boolean;
  personalClassId: string;
  groupName?: string;
  onClose: () => void;
  onSaved: () => void;
}

function pooledToTransferItem(row: TeacherPooledStudent): TransferItem {
  const subtitle = [row.collegeName, row.adminClassName].filter(Boolean).join(' · ');
  return {
    key: row.id,
    title: `${row.name}（${row.studentNo || '-'}）`,
    description: subtitle || undefined,
  };
}

function rosterToTransferItem(row: TeacherRosterStudent): TransferItem {
  const subtitle = row.collegeName || undefined;
  return {
    key: row.id,
    title: `${row.name}（${row.studentNo || '-'}）`,
    description: subtitle,
  };
}

/** 同名 key：后者覆盖前者 */
function mergePreferOverlay(base: TransferItem[], overlay: TransferItem[]): TransferItem[] {
  const m = new Map<string, TransferItem>();
  base.forEach((x) => m.set(String(x.key), x));
  overlay.forEach((x) => m.set(String(x.key), x));
  const lng =
    typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh-Hans-CN' : undefined;
  return [...m.values()].sort((a, b) => String(a.title).localeCompare(String(b.title), lng));
}

export default function AddStudentsTransferModal({
  open,
  personalClassId,
  groupName,
  onClose,
  onSaved,
}: AddStudentsTransferModalProps) {
  const { t } = useTranslation();

  const [submitting, setSubmitting] = useState(false);
  const [colleges, setColleges] = useState<{ label: string; value: string }[]>([]);
  const [adminClasses, setAdminClasses] = useState<{ label: string; value: string }[]>([]);

  const [collegeId, setCollegeId] = useState<string | undefined>();
  const [adminClassId, setAdminClassId] = useState<string | undefined>();

  const [adminClassesLoading, setAdminClassesLoading] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  const [memberDs, setMemberDs] = useState<TransferItem[]>([]);
  const [poolDs, setPoolDs] = useState<TransferItem[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  const dataSource = useMemo(() => mergePreferOverlay(memberDs, poolDs), [memberDs, poolDs]);

  const resetLocalFilters = useCallback(() => {
    setCollegeId(undefined);
    setAdminClassId(undefined);
    setAdminClasses([]);
    setMemberDs([]);
    setPoolDs([]);
    setTargetKeys([]);
    setPoolLoading(false);
    setInitLoading(false);
  }, []);

  useEffect(() => {
    if (!open) resetLocalFilters();
  }, [open, resetLocalFilters]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchPublicColleges()
      .then((rows) => {
        if (cancelled) return;
        setColleges(rows.map((c) => ({ label: c.name, value: c.id })));
      })
      .catch((e: unknown) =>
        message.error(e instanceof Error ? e.message : t('teacher_class.add_students.colleges_load_fail'))
      );
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  useEffect(() => {
    if (!open || !personalClassId) return;
    let cancelled = false;
    setInitLoading(true);
    listPersonalClassStudents(personalClassId)
      .then((rows) => {
        if (cancelled) return;
        setMemberDs(rows.map(rosterToTransferItem));
        setTargetKeys(rows.map((r) => r.id));
      })
      .catch((e: unknown) =>
        message.error(e instanceof Error ? e.message : t('teacher_class.add_students.roster_load_fail'))
      )
      .finally(() => {
        if (!cancelled) setInitLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, personalClassId, t]);

  useEffect(() => {
    if (!open || !collegeId) {
      setAdminClasses([]);
      return;
    }
    let cancelled = false;
    setAdminClassesLoading(true);
    fetchTeacherAdminClasses(collegeId)
      .then((rows) => {
        if (cancelled) return;
        setAdminClasses(rows.map((c) => ({ label: c.name, value: c.id })));
      })
      .catch(() => setAdminClasses([]))
      .finally(() => {
        if (!cancelled) setAdminClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, collegeId]);

  /** 仅在选择教务班级后加载学生池（仅选院系不加载） */
  useEffect(() => {
    if (!open || !collegeId || !adminClassId) {
      setPoolDs([]);
      return;
    }
    let cancelled = false;
    setPoolLoading(true);
    fetchTeacherStudentPool(collegeId, adminClassId)
      .then((rows) => {
        if (cancelled) return;
        setPoolDs(rows.map(pooledToTransferItem));
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          message.error(e instanceof Error ? e.message : t('teacher_class.add_students.pool_load_fail'));
          setPoolDs([]);
        }
      })
      .finally(() => {
        if (!cancelled) setPoolLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, collegeId, adminClassId, t]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await putPersonalClassStudents(personalClassId, targetKeys);
      message.success(t('teacher_class.add_students.save_success'));
      onSaved();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('teacher_class.add_students.save_fail'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWrapClose = () => {
    resetLocalFilters();
    onClose();
  };

  const modalTitle =
    groupName != null && groupName !== ''
      ? `${t('teacher_class.add_students.title_prefix')}${t('teacher_class.add_students.title_join')}${groupName}`
      : t('teacher_class.add_students.title_prefix');

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={handleWrapClose}
      width={860}
      destroyOnHidden
      okText={t('teacher_class.add_students.ok')}
      confirmLoading={submitting}
      onOk={() => void handleSave()}
      cancelText={t('teacher_class.add_students.cancel')}
    >

      <Space wrap className="mb-4 w-full" size="middle">
        <Select
          placeholder={t('teacher_class.add_students.college_placeholder')}
          style={{ width: 220 }}
          allowClear
          options={colleges}
          value={collegeId}
          onChange={(v) => {
            setCollegeId(v);
            setAdminClassId(undefined);
          }}
        />
        <Select
          placeholder={t('teacher_class.add_students.admin_class_placeholder')}
          style={{ minWidth: 260 }}
          allowClear
          options={adminClasses}
          loading={adminClassesLoading}
          disabled={!collegeId}
          value={adminClassId}
          onChange={setAdminClassId}
          showSearch
          optionFilterProp="label"
        />
      </Space>

      <Spin spinning={initLoading || poolLoading}>
        <Transfer
          dataSource={dataSource}
          targetKeys={targetKeys}
          titles={[t('teacher_class.add_students.transfer_titles_0'), t('teacher_class.add_students.transfer_titles_1')]}
          operations={[t('teacher_class.add_students.transfer_operations_0'), t('teacher_class.add_students.transfer_operations_1')]}
          showSearch={{ placeholder: t('teacher_class.add_students.search_placeholder') }}
          filterOption={(input, item) => {
            const s = `${item.title || ''}${item.description || ''}`;
            return s.toLowerCase().includes(input.toLowerCase());
          }}
          render={(item) => (
            <span className="text-sm">
              <div className="font-medium">{item.title}</div>
              {item.description && <div className="text-xs text-gray-400">{item.description}</div>}
            </span>
          )}
          listStyle={{ width: 360, height: 360 }}
          onChange={(keys) => setTargetKeys(keys.map(String))}
          disabled={submitting || initLoading || poolLoading}
        />
      </Spin>
    </Modal>
  );
}
