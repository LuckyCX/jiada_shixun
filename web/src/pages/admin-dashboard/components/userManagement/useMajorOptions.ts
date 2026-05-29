import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPublicMajors, type PublicMajorRow } from '../collegeApi';

export function useMajorOptions(enabled: boolean, collegeId?: string) {
  const [rows, setRows] = useState<PublicMajorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchPublicMajors(collegeId);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, collegeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(
    () => rows.map((m) => ({ value: m.id, label: m.name })),
    [rows]
  );

  const labelByValue = useCallback(
    (id: string) => rows.find((m) => m.id === id)?.name ?? '',
    [rows]
  );

  return { options, loading, labelByValue, rows };
}
