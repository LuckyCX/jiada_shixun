import { useEffect, useState } from 'react';
import { fetchPublicDictItems } from '../dictionary/adminDictApi';

/** 公开字典下拉：value 为 data_key 字符串，与业务表存储一致 */
export function usePublicDictOptions(typeCode: string, enabled = true) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !typeCode) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPublicDictItems(typeCode)
      .then((rows) => {
        if (cancelled) return;
        setOptions(rows.map((r) => ({ label: r.name, value: String(r.dataKey) })));
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
  }, [typeCode, enabled]);

  const labelByValue = (val: string) => {
    const hit = options.find((o) => o.value === val);
    return hit?.label ?? val;
  };

  return { options, loading, labelByValue };
}
