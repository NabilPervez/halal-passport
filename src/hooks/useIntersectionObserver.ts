import { useEffect, useRef, useState } from "react";

/**
 * Thin wrapper around IntersectionObserver.
 * Attach the returned `ref` to any sentinel element — `isIntersecting` flips
 * true whenever that element enters the viewport.
 *
 * Takes `rootMargin`/`threshold` as separate primitive params rather than an
 * IntersectionObserverInit object — callers typically pass a fresh object
 * literal on every render (e.g. `{ rootMargin: "200px" }`), and depending on
 * that object's identity in the effect below would tear down and rebuild
 * the observer on every render instead of only when the actual value
 * changes.
 */
export function useIntersectionObserver({
  rootMargin,
  threshold = 0.1,
}: { rootMargin?: string; threshold?: number | number[] } = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
    // threshold can be an array; JSON.stringify keeps the dep list to
    // primitives without pulling in a deep-equality helper for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootMargin, JSON.stringify(threshold)]);

  return { ref, isIntersecting };
}
