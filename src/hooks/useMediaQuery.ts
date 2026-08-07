import { useState, useEffect } from 'react';

/**
 * useMediaQuery — JS 层面媒体查询
 * @param query CSS 媒体查询字符串，如 '(max-width: 768px)'
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = () => setMatches(media.matches);
    media.addEventListener('change', handler);
    setMatches(media.matches);
    return () => media.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** 断点常量（与 Tailwind 一致） */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * useBreakpoint — 返回当前断点信息
 * - isMobile: < 768px
 * - isTablet: 768px - 1023px
 * - isDesktop: >= 1024px
 */
export function useBreakpoint() {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
  const isTablet = useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
  );
  const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);

  return { isMobile, isTablet, isDesktop };
}
