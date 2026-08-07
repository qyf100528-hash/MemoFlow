import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, ViewMode, ResolvedTheme } from '../types';

// 检测系统深浅模式
function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

// 解析 theme：auto → 跟随系统，dark/light → 直接使用
export function resolveTheme(theme: string): ResolvedTheme {
  if (theme === 'auto') return getSystemTheme();
  return theme as ResolvedTheme;
}

interface AppState {
  currentPage: string;
  pageHistory: string[];
  selectedFolderId: string | null;
  selectedTagId: string | null;
  selectedNoteId: string | null;
  searchQuery: string;
  showFavorites: boolean;
  showAllNotes: boolean;
  settings: AppSettings;
  resolvedTheme: ResolvedTheme;

  setCurrentPage: (page: string) => void;
  navigateTo: (page: string) => void;
  goBack: () => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedTagId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setShowFavorites: (v: boolean) => void;
  setShowAllNotes: (v: boolean) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
  setViewMode: (mode: ViewMode) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  theme: 'auto',
  viewMode: 'list',
  defaultFolderId: null,
  fontSize: 'medium',
  autoSave: true,
  autoSaveInterval: 3,
  markdownDefault: true,
  showLineNumbers: false,
  spellCheck: false,
  accentColor: 'rose',
  backgroundColor: 'ocean',
  customAccent: { primary: '#f472b6', secondary: '#c084fc' },
  customBg: { primary: '#0a1a24', secondary: '#3b82f6' },
  deepseekApiKey: '',
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 'home',
      pageHistory: [],
      selectedFolderId: null,
      selectedTagId: null,
      selectedNoteId: null,
      searchQuery: '',
      showFavorites: false,
      showAllNotes: false,
      settings: defaultSettings,
      resolvedTheme: getSystemTheme(),

      setCurrentPage: (page) => set({ currentPage: page }),
      navigateTo: (page) => set((s) => {
        if (s.currentPage === page) return { currentPage: page };
        return { currentPage: page, pageHistory: [...s.pageHistory, s.currentPage] };
      }),
      goBack: () => set((s) => {
        if (s.pageHistory.length === 0) return { currentPage: 'home', showFavorites: false, showAllNotes: false, selectedFolderId: null, selectedTagId: null };
        const history = [...s.pageHistory];
        const prev = history.pop()!;
        if (prev === 'home') return { currentPage: prev, pageHistory: history, showFavorites: false, showAllNotes: false, selectedFolderId: null, selectedTagId: null };
        return { currentPage: prev, pageHistory: history };
      }),
      setSelectedFolderId: (id) => set({ selectedFolderId: id, showFavorites: false, showAllNotes: false, selectedTagId: null }),
      setSelectedTagId: (id) => set({ selectedTagId: id, showFavorites: false, showAllNotes: false, selectedFolderId: null }),
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setShowFavorites: (v) => set({ showFavorites: v, showAllNotes: false, selectedFolderId: null, selectedTagId: null }),
      setShowAllNotes: (v) => set({ showAllNotes: v, showFavorites: false, selectedFolderId: null, selectedTagId: null }),
      setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme }, resolvedTheme: resolveTheme(theme) })),
      setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
      setViewMode: (mode) => set((s) => ({ settings: { ...s.settings, viewMode: mode } })),
      updateSettings: (ns) => set((s) => ({ settings: { ...s.settings, ...ns } })),
    }),
    {
      name: 'memoflow-store',
      version: 7,
      partialize: (s) => ({
        ...s,
        pageHistory: [],
      }),
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Partial<AppState>;
        const VALID_ACCENT = ['mint', 'ocean', 'sunset', 'rose', 'violet', 'custom'];
        const VALID_THEME = ['auto', 'dark', 'light'];
        if (s.settings) {
          if (!VALID_ACCENT.includes(s.settings.accentColor)) s.settings.accentColor = 'rose';
          if (!VALID_ACCENT.includes(s.settings.backgroundColor)) s.settings.backgroundColor = 'ocean';
          if (!VALID_THEME.includes(s.settings.theme)) s.settings.theme = 'auto';
          // v7: 补充自定义颜色默认值
          if (!s.settings.customAccent) s.settings.customAccent = { primary: '#f472b6', secondary: '#c084fc' };
          if (!s.settings.customBg) s.settings.customBg = { primary: '#0a1a24', secondary: '#3b82f6' };
        }
        return s as AppState;
      },
    }
  )
);
