-- 外国语学院：新增日语、日语(专升本)（新生班级/导入用）
-- 可重复执行

SET client_encoding = 'UTF8';

INSERT INTO majors (college_id, name, status)
SELECT c.id, v.major_name, 'active'
FROM colleges c
JOIN (
  VALUES
    ('外国语学院', '日语'),
    ('外国语学院', '日语(专升本)')
) AS v(college_name, major_name) ON c.name = v.college_name
ON CONFLICT (college_id, name) DO NOTHING;
