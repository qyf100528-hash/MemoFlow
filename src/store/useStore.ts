import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, ViewMode } from '../types';

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

  setCurrentPage: (page: string) => void;
  navigateTo: (page: string) => void;
  goBack: () => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedTagId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setShowFavorites: (v: boolean) => void;
  setShowAllNotes: (v: boolean) => void;
  toggleTheme: () => void;
  setViewMode: (mode: ViewMode) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  viewMode: 'list',
  defaultFolderId: null,
  fontSize: 'medium',
  autoSave: true,
  autoSaveInterval: 3,
  markdownDefault: true,
  showLineNumbers: false,
  spellCheck: false,
  accentColor: 'ocean',
  backgroundColor: 'ocean',
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

      setCurrentPage: (page) => set({ currentPage: page }),
      navigateTo: (page) => set((s) => {
        if (s.currentPage === page) return { currentPage: page };
        return { currentPage: page, pageHistory: [...s.pageHistory, s.currentPage] };
      }),
      goBack: () => set((s) => {
        if (s.pageHistory.length === 0) return { currentPage: 'home', showFavorites: false, showAllNotes: false, selectedFolderId: null, selectedTagId: null };
        const history = [...s.pageHistory];
        const prev = history.pop()!;
        // 返回首页时重置所有筛选状态
        if (prev === 'home') return { currentPage: prev, pageHistory: history, showFavorites: false, showAllNotes: false, selectedFolderId: null, selectedTagId: null };
        return { currentPage: prev, pageHistory: history };
      }),
      setSelectedFolderId: (id) => set({ selectedFolderId: id, showFavorites: false, showAllNotes: false, selectedTagId: null }),
      setSelectedTagId: (id) => set({ selectedTagId: id, showFavorites: false, showAllNotes: false, selectedFolderId: null }),
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setShowFavorites: (v) => set({ showFavorites: v, showAllNotes: false, selectedFolderId: null, selectedTagId: null }),
      setShowAllNotes: (v) => set({ showAllNotes: v, showFavorites: false, selectedFolderId: null, selectedTagId: null }),
      toggleTheme: () => set((s) => ({ settings: { ...s.settings, theme: s.settings.theme === 'dark' ? 'light' : 'dark' } })),
      setViewMode: (mode) => set((s) => ({ settings: { ...s.settings, viewMode: mode } })),
      updateSettings: (ns) => set((s) => ({ settings: { ...s.settings, ...ns } })),
    }),
    {
      name: 'memoflow-store',
      version: 4,
      partialize: (s) => ({
        ...s,
        pageHistory: [], // 不持久化页面历史
      }),
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Partial<AppState>;
        // v4: 统一为新的默认配色（海洋重点色 + 海洋背景色）
        const VALID = ['mint', 'ocean', 'sunset', 'rose', 'violet'];
        if (s.settings) {
          if (!VALID.includes(s.settings.accentColor)) s.settings.accentColor = 'ocean';
          if (!VALID.includes(s.settings.backgroundColor)) s.settings.backgroundColor = 'ocean';
        }
        return s as AppState;
      },
    }
  )
);
