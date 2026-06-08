import { useState, useEffect, useCallback, useRef } from 'react';
import { maestroClient } from '../utils/MaestroClient';
import type { DocEntry } from '../app/types/maestro';

const PAGE_SIZE = 50;

function inferDocKind(doc: DocEntry): 'markdown' | 'diagram' {
  if (doc.kind === 'diagram') return 'diagram';
  if (doc.filePath?.endsWith('.excalidraw')) return 'diagram';
  return 'markdown';
}

export function useProjectDocsPaginated(projectId: string, kind: 'markdown' | 'diagram') {
  const [items, setItems] = useState<DocEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  // Reset + initial load when projectId or kind changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setTotal(null);
    loadingRef.current = false;
    let cancelled = false;

    loadingRef.current = true;
    setLoading(true);
    maestroClient
      .getProjectDocsPaginated(projectId, kind, PAGE_SIZE, 0)
      .then((res) => {
        if (cancelled) return;
        const filtered = res.data.filter(d => inferDocKind(d) === kind);
        setItems(filtered);
        setOffset(res.data.length);
        setTotal(res.pagination.total);
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId, kind]);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    setOffset((currentOffset) => {
      if (total !== null && currentOffset >= total) return currentOffset;
      loadingRef.current = true;
      setLoading(true);
      maestroClient
        .getProjectDocsPaginated(projectId, kind, PAGE_SIZE, currentOffset)
        .then((res) => {
          const filtered = res.data.filter(d => inferDocKind(d) === kind);
          setItems((prev) => [...prev, ...filtered]);
          setOffset(currentOffset + res.data.length);
          setTotal(res.pagination.total);
        })
        .catch(() => {})
        .finally(() => {
          loadingRef.current = false;
          setLoading(false);
        });
      return currentOffset;
    });
  }, [projectId, kind, total]);

  return {
    items,
    loading,
    total,
    hasMore: total === null || offset < total,
    loadMore,
  };
}
