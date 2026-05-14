import { useEffect, useState } from 'react';
import { fetchAdminColleges, type AdminCollegeRow } from '../collegeApi';

export function useCollegeDictOptions(enabled: boolean) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAdminColleges()
      .then((rows: AdminCollegeRow[]) => {
        if (cancelled) return;
        setOptions(
          rows
            .filter((r) => r.status === 'active')
            .map((r) => ({ label: r.name, value: String(r.id) }))
        );
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const labelByValue = (val: string) => {
    const hit = options.find((o) => o.value === val);
    return hit?.label ?? val;
  };

  return { options, loading, labelByValue };
}
