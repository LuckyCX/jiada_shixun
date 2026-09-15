import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPublicMajors, type PublicMajorRow } from '../collegeApi';

export function useMajorOptions(enabled: boolean, collegeId?: string) {
  const [rows, setRows] = useState<PublicMajorRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    const cid = collegeId != null ? String(collegeId).trim() : '';
    // 无学院 ID 时不请求，避免先拉全量再清空只剩当前项
    if (!cid || !/^\d+$/.test(cid)) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setRows([]);
    setLoading(true);
    fetchPublicMajors(cid)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, collegeId]);

  const options = useMemo(
    () => rows.map((m) => ({ value: m.id, label: m.name })),
    [rows]
  );

  const labelByValue = useCallback(
    (id: string) => rows.find((m) => m.id === id)?.name ?? '',
    [rows]
  );

  const reload = useCallback(async (collegeIdOverride?: string) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchPublicMajors(collegeIdOverride ?? collegeId);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, collegeId]);

  return { options, loading, labelByValue, rows, reload };
}
