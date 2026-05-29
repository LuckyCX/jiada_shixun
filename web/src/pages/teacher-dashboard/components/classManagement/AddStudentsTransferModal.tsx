import { useCallback, useEffect, useMemo, useRef, useState, type Key } from 'react';
import { Modal, Spin, Transfer, Tree, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { TransferItem } from 'antd/es/transfer';
import { useTranslation } from 'react-i18next';

import {
  fetchPublicColleges,
  fetchPublicMajors,
  fetchTeacherAdminClasses,
  fetchTeacherStudentPoolByAdminClass,
  listPersonalClassStudents,
  putPersonalClassStudents,
  type PublicMajorOption,
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

type CatalogTreeNode = DataNode & {
  nodeKind?: 'college' | 'major' | 'class';
  collegeId?: string;
  majorId?: string;
  classId?: string;
};

function majorCacheKey(collegeId: string, majorId: string) {
  return `${collegeId}:${majorId}`;
}

function parseMajorKey(key: string): { collegeId: string; majorId: string } | null {
  const m = /^m-(\d+)-(\d+)$/.exec(key);
  if (!m) return null;
  return { collegeId: m[1], majorId: m[2] };
}

function pooledToTransferItem(row: TeacherPooledStudent): TransferItem {
  const subtitle = [row.collegeName, row.majorName].filter(Boolean).join(' · ');
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
  const [majors, setMajors] = useState<PublicMajorOption[]>([]);

  const [adminClassId, setAdminClassId] = useState<string | undefined>();
  const [classesByMajor, setClassesByMajor] = useState<Record<string, { id: string; name: string }[]>>({});
  const [loadingMajorKeys, setLoadingMajorKeys] = useState<Record<string, boolean>>({});
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const classesByMajorRef = useRef(classesByMajor);
  classesByMajorRef.current = classesByMajor;
  const loadingMajorRef = useRef(loadingMajorKeys);
  loadingMajorRef.current = loadingMajorKeys;

  const [poolLoading, setPoolLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  const [memberDs, setMemberDs] = useState<TransferItem[]>([]);
  const [poolDs, setPoolDs] = useState<TransferItem[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  const dataSource = useMemo(() => mergePreferOverlay(memberDs, poolDs), [memberDs, poolDs]);

  const treeData = useMemo((): CatalogTreeNode[] => {
    return colleges.map((c) => ({
      key: `c-${c.value}`,
      title: c.label,
      nodeKind: 'college',
      collegeId: c.value,
      selectable: false,
      children: majors
        .filter((m) => m.collegeId === c.value)
        .map((m) => {
          const majorKey = `m-${c.value}-${m.id}`;
          const cacheKey = majorCacheKey(c.value, m.id);
          const loaded = classesByMajor[cacheKey];
          const loading = !!loadingMajorKeys[majorKey];
          const classChildren: CatalogTreeNode[] | undefined =
            loaded === undefined
              ? loading
                ? [
                    {
                      key: `${majorKey}-loading`,
                      title: t('teacher_class.add_students.catalog_loading'),
                      selectable: false,
                      disabled: true,
                      isLeaf: true,
                    },
                  ]
                : undefined
              : loaded.length === 0
                ? [
                    {
                      key: `${majorKey}-empty`,
                      title: t('teacher_class.add_students.catalog_empty_class'),
                      selectable: false,
                      disabled: true,
                      isLeaf: true,
                    },
                  ]
                : loaded.map((cl) => ({
                    key: `cl-${cl.id}`,
                    title: cl.name,
                    nodeKind: 'class',
                    classId: cl.id,
                    collegeId: c.value,
                    majorId: m.id,
                    isLeaf: true,
                  }));

          return {
            key: majorKey,
            title: m.name,
            nodeKind: 'major',
            collegeId: c.value,
            majorId: m.id,
            selectable: false,
            isLeaf: false,
            children: classChildren,
          };
        }),
    }));
  }, [colleges, majors, classesByMajor, loadingMajorKeys, t]);

  const selectedTreeKeys = adminClassId ? [`cl-${adminClassId}`] : [];

  const loadClassesForMajor = useCallback(
    async (majorKey: string) => {
      const parsed = parseMajorKey(majorKey);
      if (!parsed) return;
      const { collegeId, majorId } = parsed;
      const cacheKey = majorCacheKey(collegeId, majorId);
      if (classesByMajorRef.current[cacheKey] !== undefined || loadingMajorRef.current[majorKey]) return;

      setLoadingMajorKeys((prev) => ({ ...prev, [majorKey]: true }));
      try {
        const rows = await fetchTeacherAdminClasses(collegeId, majorId);
        setClassesByMajor((prev) => ({
          ...prev,
          [cacheKey]: rows.map((r) => ({ id: r.id, name: r.name })),
        }));
      } catch (e: unknown) {
        message.error(e instanceof Error ? e.message : t('teacher_class.add_students.pool_load_fail'));
        setClassesByMajor((prev) => ({ ...prev, [cacheKey]: [] }));
      } finally {
        setLoadingMajorKeys((prev) => {
          const next = { ...prev };
          delete next[majorKey];
          return next;
        });
      }
    },
    [t]
  );

  const resetLocalFilters = useCallback(() => {
    setAdminClassId(undefined);
    setClassesByMajor({});
    setLoadingMajorKeys({});
    setExpandedKeys([]);
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
    Promise.all([fetchPublicColleges(), fetchPublicMajors()])
      .then(([colRows, majorRows]) => {
        if (cancelled) return;
        setColleges(colRows.map((c) => ({ label: c.name, value: c.id })));
        setMajors(majorRows);
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
    if (!open || !adminClassId) {
      setPoolDs([]);
      return;
    }
    let cancelled = false;
    setPoolLoading(true);
    fetchTeacherStudentPoolByAdminClass(adminClassId)
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
  }, [open, adminClassId, t]);

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

  const handleTreeExpand = (keys: Key[], info: { expanded: boolean; node: CatalogTreeNode }) => {
    setExpandedKeys(keys.map(String));
    if (info.expanded && info.node.nodeKind === 'major') {
      void loadClassesForMajor(String(info.node.key));
    }
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
      width={1040}
      destroyOnHidden
      okText={t('teacher_class.add_students.ok')}
      confirmLoading={submitting}
      onOk={() => void handleSave()}
      cancelText={t('teacher_class.add_students.cancel')}
    >
      <div className="flex gap-4">
        <aside className="flex w-[220px] shrink-0 flex-col rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white shadow-sm">
          <div className="border-b border-slate-100 px-3 py-2.5 text-xs font-semibold tracking-wide text-slate-500">
            {t('teacher_class.add_students.catalog_tree_title')}
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
            <Tree
              className="add-students-catalog-tree bg-transparent text-[13px] leading-snug [&_.ant-tree-indent-unit]:w-3 [&_.ant-tree-node-content-wrapper]:min-h-[30px] [&_.ant-tree-node-content-wrapper]:rounded-lg [&_.ant-tree-node-content-wrapper]:px-2 [&_.ant-tree-node-content-wrapper]:py-1 [&_.ant-tree-node-content-wrapper:hover]:bg-slate-100/90 [&_.ant-tree-node-selected]:!bg-teal-50 [&_.ant-tree-node-selected]:!text-teal-800 [&_.ant-tree-switcher]:flex [&_.ant-tree-switcher]:items-center [&_.ant-tree-treenode]:mb-0.5 [&_.ant-tree-treenode]:py-0.5"
              blockNode
              expandAction="click"
              treeData={treeData}
              expandedKeys={expandedKeys}
              selectedKeys={selectedTreeKeys}
              onExpand={handleTreeExpand}
              onSelect={(keys, info) => {
                const node = info.node as CatalogTreeNode;
                if (node.nodeKind !== 'class' || !node.classId) {
                  setAdminClassId(undefined);
                  return;
                }
                setAdminClassId(node.classId);
              }}
              height={368}
              showLine={{ showLeafIcon: false }}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <Spin spinning={initLoading || poolLoading}>
            <Transfer
              dataSource={dataSource}
              targetKeys={targetKeys}
              titles={[
                t('teacher_class.add_students.transfer_titles_0'),
                t('teacher_class.add_students.transfer_titles_1'),
              ]}
              operations={[
                t('teacher_class.add_students.transfer_operations_0'),
                t('teacher_class.add_students.transfer_operations_1'),
              ]}
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
              listStyle={{ width: 340, height: 360 }}
              onChange={(keys) => setTargetKeys(keys.map(String))}
              disabled={submitting || initLoading || poolLoading}
            />
          </Spin>
        </div>
      </div>
    </Modal>
  );
}
