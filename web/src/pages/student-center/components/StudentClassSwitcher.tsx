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

  if (enrollments.length === 0) {
    return <span className="text-sm text-gray-400">暂无教学班级</span>;
  }

  if (enrollments.length === 1) {
    return (
      <span className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg whitespace-nowrap">
        <i className="ri-building-4-line text-teal-600" />
        {label}
      </span>
    );
  }

  return (
    <Dropdown
      menu={{
        items: enrollments.map((e) => ({ key: e.classId, label: e.className })),
        selectedKeys: selectedClassId ? [selectedClassId] : [],
        onClick: ({ key }) => onClassChange(String(key)),
      }}
      trigger={['click']}
    >
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg cursor-pointer whitespace-nowrap hover:bg-teal-100 transition-colors"
      >
        <i className="ri-building-4-line" />
        {label}
        <i className="ri-arrow-down-s-line" />
      </button>
    </Dropdown>
  );
}
