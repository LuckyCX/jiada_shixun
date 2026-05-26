import { Dropdown } from 'antd';
import type { StudentPersonalEnrollment } from '../../../lib/studentPortalApi';

type Props = {
  enrollments: StudentPersonalEnrollment[];
  selectedClassId: string;
  onClassChange: (classId: string) => void;
};

export default function StudentClassSwitcher({ enrollments, selectedClassId, onClassChange }: Props) {
  const current = enrollments.find((e) => e.classId === selectedClassId) ?? enrollments[0];
  const label = current?.className ?? '未加入班级';
  const canSwitch = enrollments.length > 1;

  if (enrollments.length === 0) {
    return <span className="text-sm text-gray-400">暂无教学班级</span>;
  }

  return (
    <Dropdown
      menu={{
        items: enrollments.map((e) => ({
          key: e.classId,
          disabled: !e.canEnterTraining,
          label: (
            <span className="flex items-center justify-between gap-3">
              <span>{e.className}</span>
              {!e.canEnterTraining && <span className="text-xs text-gray-400">未到团队组建日期</span>}
            </span>
          ),
        })),
        selectedKeys: selectedClassId ? [selectedClassId] : [],
        onClick: ({ key }) => {
          const target = enrollments.find((item) => item.classId === String(key));
          if (target?.canEnterTraining) onClassChange(String(key));
        },
      }}
      trigger={['click']}
      disabled={!canSwitch}
    >
      <button
        type="button"
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-lg whitespace-nowrap transition-colors ${
          canSwitch
            ? 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100 cursor-pointer'
            : 'text-gray-700 bg-gray-50 border-gray-200 cursor-default'
        }`}
      >
        <i className="ri-building-4-line text-teal-600" />
        <span className="max-w-[180px] truncate">{label}</span>
        {canSwitch && <i className="ri-arrow-down-s-line" />}
      </button>
    </Dropdown>
  );
}
