import { Sun, Moon, Cloud } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';

export function TopBar() {
  const { settings, setTheme, currentPage } = useStore();
  const cloudAccounts = useLiveQuery(() => db.cloudAccounts.toArray(), []);
  const connectedCount = cloudAccounts?.filter(a => a.isConnected).length || 0;

  const pageTitles: Record<string, string> = {
    home: '首页',
    notes: '笔记',
    editor: '编辑器',
    cloud: '云同步',
    migration: '数据迁移',
    settings: '设置',
  };

  // 两态切换：dark ↔ light（auto 模式在设置里选）
  const toggleTheme = () => {
    setTheme(settings.theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="glass flex items-center gap-4 px-4 sm:px-6 h-14 shrink-0" style={{ borderBottom: '1px solid var(--glass-border)' }}>
      <h1 className="text-base font-semibold text-[var(--text-primary)]">
        {pageTitles[currentPage] || 'MemoFlow'}
      </h1>

      <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl">
        <Cloud size={16} className="text-[var(--accent-mint)]" />
        <span className="text-xs text-[var(--text-secondary)]">{connectedCount} 个网盘已连接</span>
      </div>

      <button
        onClick={toggleTheme}
        className="glass w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
      >
        {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
