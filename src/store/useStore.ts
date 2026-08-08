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

// 获取主内容区滚动位置
function getMainScrollTop(): number {
  const main = document.querySelector('main');
  if (!main) return 0;
  const scrollEl = main.querySelector('[class*="overflow-y-auto"]') as HTMLElement | null;
  return scrollEl?.scrollTop || 0;
}

interface AppState {
  currentPage: string;
  pageHistory: string[];
  scrollPositions: Record<string, number>;
  selectedFolderId: string | null;
  selectedTagId: string | null;
  selectedNoteId: string | null;
  searchQuery: string;
  showFavorites: boolean;
  showAllNotes: boolean;
  settings: AppSettings;
  resolvedTheme: ResolvedTheme;

  // 笔记列表缓存：保存进入编辑器前的笔记ID顺序快照
  notesCache: string[] | null;

  setCurrentPage: (page: string) => void;
  navigateTo: (page: string) => void;
  goBack: () => void;
  goHome: () => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedTagId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setShowFavorites: (v: boolean) => void;
  setShowAllNotes: (v: boolean) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
  setViewMode: (mode: ViewMode) => void;
  setHomeViewMode: (mode: ViewMode) => void;
  setFoldersViewMode: (mode: 'list' | 'grid') => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  setNotesCache: (ids: string[]) => void;
  clearNotesCache: () => void;
  toggleSectionCollapse: (section: string) => void;
  moveHomeStat: (id: string, direction: 'up' | 'down') => void;
  recentItems: { id: string; name: string; icon: string; openedAt: number }[];
  addRecentItem: (id: string, name: string, icon: string) => void;
  homeTitleCollapsed: boolean;
  setHomeTitleCollapsed: (v: boolean) => void;
}

const defaultSettings: AppSettings = {
  theme: 'custom',
  viewMode: 'list',
  homeViewMode: 'list',
  foldersViewMode: 'grid',
  defaultFolderId: null,
  fontSize: 'medium',
  autoSave: true,
  autoSaveInterval: 3,
  markdownDefault: true,
  showLineNumbers: false,
  spellCheck: false,
  accentColor: 'rose',
  backgroundColor: 'ocean',
  deepseekApiKey: '',
  showHomeTitle: true,
  homeStatOrder: ['allNotes', 'pinned', 'folders', 'clouds'],
  collapsedSections: [],
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 'home',
      pageHistory: [],
      scrollPositions: {},
      selectedFolderId: null,
      selectedTagId: null,
      selectedNoteId: null,
      searchQuery: '',
      showFavorites: false,
      showAllNotes: false,
      settings: defaultSettings,
      resolvedTheme: getSystemTheme(),
      notesCache: null,
      recentItems: [],
      homeTitleCollapsed: false,

      setCurrentPage: (page) => set({ currentPage: page }),

      // 导航到新页面：保存当前页面到历史栈 + 保存滚动位置
      navigateTo: (page) => set((s) => {
        if (s.currentPage === page) return { currentPage: page };
        const scrollTop = getMainScrollTop();
        return {
          currentPage: page,
          pageHistory: [...s.pageHistory, s.currentPage],
          scrollPositions: { ...s.scrollPositions, [s.currentPage]: scrollTop },
        };
      }),

      // 返回上一页：从历史栈弹出 + 保存当前滚动位置
      goBack: () => set((s) => {
        const scrollTop = getMainScrollTop();
        const scrollPositions = { ...s.scrollPositions, [s.currentPage]: scrollTop };

        if (s.pageHistory.length > 0) {
          const history = [...s.pageHistory];
          const prev = history.pop()!;
          if (prev === 'home') {
            return { currentPage: prev, pageHistory: history, scrollPositions, showFavorites: false, showAllNotes: false, selectedFolderId: null, selectedTagId: null, searchQuery: '' };
          }
          // 返回 notes 页时保留筛选状态
          return { currentPage: prev, pageHistory: history, scrollPositions };
        }
        // 无历史记录时的兜底：根据筛选状态判断
        if (s.showAllNotes || s.showFavorites || s.selectedFolderId || s.selectedTagId || s.searchQuery) {
          return { currentPage: 'notes', scrollPositions };
        }
        return { currentPage: 'home', pageHistory: [], scrollPositions, showFavorites: false, showAllNotes: false, selectedFolderId: null, selectedTagId: null, searchQuery: '' };
      }),

      // 直接回首页：清空历史栈 + 重置筛选
      goHome: () => set({
        currentPage: 'home',
        pageHistory: [],
        showFavorites: false,
        showAllNotes: false,
        selectedFolderId: null,
        selectedTagId: null,
        searchQuery: '',
      }),

      setSelectedFolderId: (id) => set({ selectedFolderId: id, showFavorites: false, showAllNotes: false, selectedTagId: null, searchQuery: '', notesCache: null }),
      setSelectedTagId: (id) => set({ selectedTagId: id, showFavorites: false, showAllNotes: false, selectedFolderId: null, searchQuery: '', notesCache: null }),
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSearchQuery: (q) => set({ searchQuery: q, notesCache: null }),
      setShowFavorites: (v) => set({ showFavorites: v, showAllNotes: false, selectedFolderId: null, selectedTagId: null, searchQuery: '', notesCache: null }),
      setShowAllNotes: (v) => set({ showAllNotes: v, showFavorites: false, selectedFolderId: null, selectedTagId: null, searchQuery: '', notesCache: null }),
      setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme }, resolvedTheme: resolveTheme(theme) })),
      setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
      setViewMode: (mode) => set((s) => ({ settings: { ...s.settings, viewMode: mode } })),
      setHomeViewMode: (mode) => set((s) => ({ settings: { ...s.settings, homeViewMode: mode } })),
      setFoldersViewMode: (mode) => set((s) => ({ settings: { ...s.settings, foldersViewMode: mode } })),
      updateSettings: (ns) => set((s) => ({ settings: { ...s.settings, ...ns } })),
      setNotesCache: (ids) => set({ notesCache: ids }),
      clearNotesCache: () => set({ notesCache: null }),
      addRecentItem: (id, name, icon) => set((s) => {
        const filtered = s.recentItems.filter(f => f.id !== id);
        return { recentItems: [{ id, name, icon, openedAt: Date.now() }, ...filtered].slice(0, 5) };
      }),
      setHomeTitleCollapsed: (v) => set({ homeTitleCollapsed: v }),
      toggleSectionCollapse: (section) => set((s) => {
        const collapsed = s.settings.collapsedSections || [];
        const isCollapsed = collapsed.includes(section);
        return {
          settings: {
            ...s.settings,
            collapsedSections: isCollapsed
              ? collapsed.filter(id => id !== section)
              : [...collapsed, section],
          },
        };
      }),
      moveHomeStat: (id, direction) => set((s) => {
        const order = [...(s.settings.homeStatOrder || ['allNotes', 'pinned', 'folders', 'clouds'])];
        const idx = order.indexOf(id);
        if (idx === -1) return {};
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= order.length) return {};
        [order[idx], order[target]] = [order[target], order[idx]];
        return { settings: { ...s.settings, homeStatOrder: order } };
      }),
    }),
    {
      name: 'memoflow-store',
      version: 12,
      // 仅持久化设置、主题和最近访问记录，不持久化运行时导航状态
      partialize: (s) => ({
        settings: s.settings,
        resolvedTheme: s.resolvedTheme,
        recentItems: s.recentItems,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Partial<AppState>;
        const VALID_ACCENT = ['mint', 'ocean', 'sunset', 'rose', 'violet'];
        const VALID_THEME = ['auto', 'dark', 'light', 'custom'];
        const VALID_VIEW = ['list', 'grid', 'kanban', 'timeline'];
        if (s.settings) {
          if (!VALID_ACCENT.includes(s.settings.accentColor as string)) s.settings.accentColor = 'rose';
          if (!VALID_ACCENT.includes(s.settings.backgroundColor as string)) s.settings.backgroundColor = 'ocean';
          if (!VALID_THEME.includes(s.settings.theme)) s.settings.theme = 'custom';
          if (!VALID_VIEW.includes(s.settings.homeViewMode as string)) s.settings.homeViewMode = 'list';
          // v11: 初始化首页布局设置
          if (s.settings.showHomeTitle === undefined) s.settings.showHomeTitle = true;
          if (!Array.isArray(s.settings.homeStatOrder) || s.settings.homeStatOrder.length === 0) s.settings.homeStatOrder = ['allNotes', 'pinned', 'folders', 'clouds'];
          if (!Array.isArray(s.settings.collapsedSections)) s.settings.collapsedSections = [];
          const old = s.settings as unknown as Record<string, unknown>;
          delete old.customAccent;
          delete old.customBg;
        }
        // v12: 持久化 recentItems，确保刷新后保留最近访问记录
        return {
          settings: s.settings,
          resolvedTheme: s.resolvedTheme,
          recentItems: Array.isArray(s.recentItems) ? s.recentItems : [],
        } as Partial<AppState>;
      },
    }
  )
);
