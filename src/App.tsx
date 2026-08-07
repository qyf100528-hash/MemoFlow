import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Search, Plus, ChevronLeft } from 'lucide-react';
import { useRef } from 'react';
import { useStore } from './store/useStore';
import { seedDatabase, cleanupDefaultTags, seedTemplates } from './lib/db';
import { tokenRefreshService } from './lib/cloud/token-refresh-service';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Home } from './pages/Home';
import { Notes } from './pages/Notes';
import { NoteEditor } from './components/notes/NoteEditor';
import { CloudSync } from './pages/CloudSync';
import { Migration } from './pages/Migration';
import { Settings } from './pages/Settings';
import type { AccentColor } from './types';

const ACCENT_PRESETS: Record<AccentColor, { primary: string; secondary: string; gradient: string }> = {
  mint:   { primary: '#2dd4bf', secondary: '#38bdf8', gradient: 'linear-gradient(135deg, #2dd4bf, #0ea5e9)' },
  ocean:  { primary: '#38bdf8', secondary: '#818cf8', gradient: 'linear-gradient(135deg, #38bdf8, #6366f1)' },
  sunset: { primary: '#fb923c', secondary: '#f43f5e', gradient: 'linear-gradient(135deg, #fb923c, #f43f5e)' },
  rose:   { primary: '#f472b6', secondary: '#c084fc', gradient: 'linear-gradient(135deg, #f472b6, #a855f7)' },
  violet: { primary: '#a78bfa', secondary: '#22d3ee', gradient: 'linear-gradient(135deg, #a78bfa, #06b6d4)' },
};

// 背景色预设 — 与重点色同 5 个选项，每个定义深/浅模式的背景色调与光晕色
const BG_PRESETS: Record<AccentColor, { dark: { primary: string; secondary: string; tertiary: string; glowPrimary: string; glowSecondary: string }; light: { primary: string; secondary: string; tertiary: string; glowPrimary: string; glowSecondary: string } }> = {
  mint: {
    dark:  { primary: '#0a1418', secondary: '#0f1a1e', tertiary: '#152227', glowPrimary: '#2dd4bf', glowSecondary: '#38bdf8' },
    light: { primary: '#f0f7f6', secondary: '#ffffff', tertiary: '#e6efee', glowPrimary: '#5eead4', glowSecondary: '#99f6e0' },
  },
  ocean: {
    dark:  { primary: '#0a1e30', secondary: '#0f2742', tertiary: '#143252', glowPrimary: '#38bdf8', glowSecondary: '#818cf8' },
    light: { primary: '#d9ecfb', secondary: '#ffffff', tertiary: '#c8e0f6', glowPrimary: '#38bdf8', glowSecondary: '#818cf8' },
  },
  sunset: {
    dark:  { primary: '#1a0f08', secondary: '#1f140c', tertiary: '#271a10', glowPrimary: '#fb923c', glowSecondary: '#f43f5e' },
    light: { primary: '#fbf6f0', secondary: '#ffffff', tertiary: '#f6ede2', glowPrimary: '#fdba74', glowSecondary: '#fed7aa' },
  },
  rose: {
    dark:  { primary: '#1a0c12', secondary: '#1f1016', tertiary: '#27151d', glowPrimary: '#f472b6', glowSecondary: '#c084fc' },
    light: { primary: '#fbf0f5', secondary: '#ffffff', tertiary: '#f6e6ee', glowPrimary: '#f9a8d4', glowSecondary: '#fbcfe8' },
  },
  violet: {
    dark:  { primary: '#0e0a1a', secondary: '#130f22', tertiary: '#191530', glowPrimary: '#a78bfa', glowSecondary: '#22d3ee' },
    light: { primary: '#f4f0fb', secondary: '#ffffff', tertiary: '#ebe6f6', glowPrimary: '#c4b5fd', glowSecondary: '#ddd6fe' },
  },
};

export default function App() {
  const { currentPage, settings, searchQuery, setSearchQuery, showAllNotes, showFavorites, goBack } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);


  // 当页面变化时关闭侧边栏抽屉
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPage, showAllNotes, showFavorites]);

  useEffect(() => {
    seedDatabase();
    cleanupDefaultTags();
    seedTemplates();
    // 启动 Token 后台刷新服务
    tokenRefreshService.start();
    return () => tokenRefreshService.stop();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') { root.classList.add('light'); root.classList.remove('dark'); }
    else { root.classList.add('dark'); root.classList.remove('light'); }
  }, [settings.theme]);

  // 应用背景色预设 — 同时设置背景光晕色（独立于重点色）
  useEffect(() => {
    const preset = BG_PRESETS[settings.backgroundColor] || BG_PRESETS.ocean;
    const colors = settings.theme === 'light' ? preset.light : preset.dark;
    const root = document.documentElement;
    root.style.setProperty('--bg-primary', colors.primary);
    root.style.setProperty('--bg-secondary', colors.secondary);
    root.style.setProperty('--bg-tertiary', colors.tertiary);
    root.style.setProperty('--glow-primary', colors.glowPrimary);
    root.style.setProperty('--glow-secondary', colors.glowSecondary);
  }, [settings.backgroundColor, settings.theme]);

  // 重点色 — 仅影响强调元素（按钮、高亮、链接），不改变背景
  useEffect(() => {
    const preset = ACCENT_PRESETS[settings.accentColor] || ACCENT_PRESETS.rose;
    const root = document.documentElement;
    root.style.setProperty('--accent-mint', preset.primary);
    root.style.setProperty('--accent-ocean', preset.secondary);
    root.style.setProperty('--accent-gradient', preset.gradient);
  }, [settings.accentColor]);

  // 字体大小全局生效 — 通过 data-font-size 控制 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-font-size', settings.fontSize);
  }, [settings.fontSize]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[type="text"]');
        input?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        useStore.getState().setSelectedNoteId(null);
        useStore.getState().setCurrentPage('editor');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <Home />;
      case 'notes': return <Notes />;
      case 'editor': return <NoteEditor />;
      case 'cloud': return <CloudSync />;
      case 'migration': return <Migration />;
      case 'settings': return <Settings />;
      default: return <Home />;
    }
  };

  // 页面切换时关闭侧边栏
  const handlePageChange = (page: string) => {
    useStore.getState().setCurrentPage(page);
    setSidebarOpen(false);
  };

  return (
    <>
      <div className="app-bg" />
      <div className="flex h-screen w-screen overflow-hidden">
        {/* 桌面端侧边栏 */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* 手机端侧边栏抽屉 */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
              />
              <motion.div
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 bottom-0 z-50 md:hidden"
              >
                <Sidebar />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 手机端顶部栏 */}
          {currentPage !== 'editor' && (
          <div className="flex items-center gap-2 px-3 h-14 shrink-0 ios-glass md:hidden" style={{ borderBottom: '0.5px solid rgba(255, 255, 255, 0.12)' }}>
            {currentPage === 'home' ? (
              <button onClick={() => setSidebarOpen(true)} className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                <Menu size={20} />
              </button>
            ) : (
              <button onClick={() => goBack()} className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                <ChevronLeft size={22} />
              </button>
            )}
            {currentPage === 'home' && (
              <span className="text-base font-semibold gradient-text flex-1">MemoFlow</span>
            )}
          </div>
          )}

          {/* 桌面端顶部栏 */}
          <div className="hidden md:block">
            <TopBar />
          </div>

          <main className="flex-1 flex overflow-hidden">
            {renderPage()}
          </main>
        </div>
      </div>

      {/* iOS 风格底部搜索栏 + 新建按钮 — 全局固定 */}
      <BottomSearchBar />
    </>
  );
}

function BottomSearchBar() {
  const { searchQuery, setSearchQuery, setCurrentPage, navigateTo, setSelectedNoteId, setShowAllNotes, currentPage } = useStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 监听 visualViewport 变化，适配移动端键盘弹出
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // 仅在搜索框聚焦时调整
      if (document.activeElement === searchInputRef.current) {
        const offset = window.innerHeight - vv.height;
        setKeyboardOffset(offset > 0 ? offset : 0);
      }
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value && !useStore.getState().showAllNotes && currentPage !== 'editor') {
      setShowAllNotes(true);
      navigateTo('notes');
    }
  };

  const handleNewNote = () => {
    setSelectedNoteId(null);
    setCurrentPage('editor');
  };

  const handleSearchFocus = () => {
    setSearchFocused(true);
    // 延迟计算键盘偏移，等待键盘动画完成
    requestAnimationFrame(() => {
      const vv = window.visualViewport;
      if (vv) {
        const offset = window.innerHeight - vv.height;
        setKeyboardOffset(offset > 0 ? offset : 0);
      }
    });
  };

  const handleSearchBlur = () => {
    setSearchFocused(false);
    setKeyboardOffset(0);
  };

  // 编辑器页面不显示底部栏
  if (currentPage === 'editor') return null;

  return (
    <div
      className="fixed left-0 right-0 z-30 pointer-events-none"
      style={{
        bottom: `${keyboardOffset}px`,
        transition: keyboardOffset > 0 ? 'bottom 0.25s ease-out' : 'bottom 0.3s ease-in',
      }}
    >
      <div className="flex items-center gap-3 px-4 pt-3 pb-4 max-w-3xl mx-auto pointer-events-auto safe-bottom">
        <motion.div
          className="flex-1 relative"
          animate={{ scale: searchFocused ? 1.02 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="ios-pill-search flex items-center gap-2.5 px-5" style={{ height: 52 }}>
            <Search size={18} className="text-[var(--text-secondary)] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              placeholder="搜索笔记"
              className="flex-1 bg-transparent text-[15px] placeholder:text-[var(--text-secondary)] outline-none"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  className="shrink-0"
                >
                  <X size={16} className="text-[var(--text-secondary)]" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 600, damping: 15 }}
          onClick={handleNewNote}
          className="ios-pill-new flex items-center justify-center shrink-0"
          style={{ width: 52, height: 52 }}
        >
          <Plus size={24} className="text-white" />
        </motion.button>
      </div>
    </div>
  );
}
