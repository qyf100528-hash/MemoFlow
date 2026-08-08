
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Star, Folder as FolderIcon, Cloud, Smartphone, TrendingUp, ArrowRight, LayoutGrid, List, Grid, Kanban, Clock, Check, Plus, ChevronDown, ChevronRight, FolderPlus } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { getDisplayTitle } from '../lib/note-utils';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteListItem } from '../components/notes/NoteListItem';
import { KanbanView } from '../components/notes/KanbanView';
import { TimelineView } from '../components/notes/TimelineView';

// 紧凑时间格式：今天显示时分，昨天显示"昨天"，更早显示月日
function formatRecentTime(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  if (ts >= today) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (ts >= yesterday) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function Home() {
  const { settings, setHomeViewMode, navigateTo, setSelectedNoteId, setShowAllNotes, setShowFavorites, notesCache, setNotesCache, toggleSectionCollapse, setSelectedFolderId, addRecentItem, homeTitleCollapsed, setHomeTitleCollapsed, recentItems } = useStore();
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [showFolderCreator, setShowFolderCreator] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [newFolderLocation, setNewFolderLocation] = useState<'local' | string>('local');

  const FOLDER_ICON_OPTIONS = ['📁', '💼', '🏡', '💡', '📝', '⭐', '📌', '🎯', '📚', '🎨', '🎵', '✈️', '🏠', '❤️', '🔥', '🌟'];

  const CLOUD_LABELS: Record<string, string> = {
    baidu: '百度网盘',
    google: 'Google Drive',
    quark: '夸克网盘',
    onedrive: 'OneDrive',
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const count = await db.folders.count();
    // 保存位置：本地 → folder-xxx，网盘 → folder-cloud-{provider}
    const isCloud = newFolderLocation !== 'local';
    const folderId = isCloud ? `folder-cloud-${newFolderLocation}-${Date.now()}` : `folder-${Date.now()}`;
    await db.folders.add({
      id: folderId,
      name: newFolderName.trim(),
      icon: newFolderIcon,
      color: '#2dd4bf',
      parentId: null,
      sortOrder: count,
      createdAt: Date.now(),
    });
    setNewFolderName('');
    setNewFolderIcon('📁');
    setNewFolderLocation('local');
    setShowFolderCreator(false);
  };

  // 原始数据，不做排序
  const rawNotes = useLiveQuery(async () => { const all = await db.notes.toArray(); return all.filter(n => !n.isArchived); }, []);
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const cloudAccounts = useLiveQuery(() => db.cloudAccounts.toArray(), []);
  const connectedClouds = cloudAccounts?.filter(a => a.isConnected).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) || [];

  // 应用顺序：有缓存时保持缓存顺序，否则按更新时间排序
  const notes = useMemo(() => {
    if (!rawNotes) return undefined;
    if (notesCache && notesCache.length > 0) {
      const orderMap = new Map(notesCache.map((id, i) => [id, i]));
      const filtered = rawNotes.filter(n => orderMap.has(n.id));
      filtered.sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
      return filtered;
    }
    const sorted = [...rawNotes];
    sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted;
  }, [rawNotes, notesCache]);

  // 全部笔记：包含置顶笔记，置顶笔记排在最前
  const allNotes = notes?.slice().sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  }) || [];

  // 最近访问：基于 recentItems（已按时间倒序），根据 id 取笔记详情，最多5条
  const recentNotes = useMemo(() => {
    if (!notes || !recentItems.length) return [];
    const map = new Map(notes.map(n => [n.id, n]));
    return recentItems
      .map(item => map.get(item.id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .slice(0, 5);
  }, [notes, recentItems]);

  // 统计卡片数据 — 按 settings.homeStatOrder 排序
  const statsMap: Record<string, { label: string; value: number; icon: typeof FileText; color: string; action: () => void }> = {
    allNotes: { label: '全部笔记', value: notes?.length || 0, icon: FileText, color: '#2dd4bf', action: () => { setShowAllNotes(true); navigateTo('notes'); } },
    pinned: { label: '置顶笔记', value: notes?.filter(n => n.isPinned).length || 0, icon: Star, color: '#fbbf24', action: () => { setShowFavorites(true); navigateTo('notes'); } },
    folders: { label: '文件夹', value: folders?.length || 0, icon: FolderIcon, color: '#38bdf8', action: () => navigateTo('folders') },
    clouds: { label: '已连接网盘', value: connectedClouds.length, icon: Cloud, color: '#a78bfa', action: () => {
      if (connectedClouds.length > 0) {
        const first = connectedClouds[0];
        const folderId = `folder-cloud-${first.provider}`;
        setSelectedFolderId(folderId);
        navigateTo('notes');
      } else {
        navigateTo('cloud');
      }
    } },
  };

  const statOrder = settings.homeStatOrder || ['allNotes', 'pinned', 'folders', 'clouds'];
  const stats = statOrder.map(id => statsMap[id]).filter(Boolean);

  const homeViewModes = [
    { mode: 'list' as const, icon: List, label: '列表' },
    { mode: 'grid' as const, icon: Grid, label: '网格' },
    { mode: 'kanban' as const, icon: Kanban, label: '看板' },
    { mode: 'timeline' as const, icon: Clock, label: '时间线' },
  ];

  const handleNoteClick = (noteId: string) => {
    if (notes) {
      setNotesCache(notes.map(n => n.id));
      const note = notes.find(n => n.id === noteId);
      if (note) {
        const title = note.title || note.content.slice(0, 20) || '无标题';
        addRecentItem(noteId, title, 'note');
      }
    }
    setSelectedNoteId(noteId);
    navigateTo('editor');
  };

  const isCollapsed = (section: string) => (settings.collapsedSections || []).includes(section);

  // 按 homeViewMode 渲染笔记列表
  const renderNotes = (list: typeof allNotes) => {
    if (settings.homeViewMode === 'list') {
      return (
        <div className="space-y-2">
          {list.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              tags={tags || []}
              folderName={folders?.find(f => f.id === note.folderId)?.name}
              onClick={() => handleNoteClick(note.id)}
            />
          ))}
        </div>
      );
    }
    if (settings.homeViewMode === 'grid') {
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {list.map((note, i) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={tags || []}
              folderName={folders?.find(f => f.id === note.folderId)?.name}
              onClick={() => handleNoteClick(note.id)}
              index={i}
            />
          ))}
        </div>
      );
    }
    if (settings.homeViewMode === 'kanban') {
      return (
        <KanbanView
          notes={list}
          folders={folders || []}
          tags={tags || []}
          onNoteClick={handleNoteClick}
        />
      );
    }
    return (
      <TimelineView
        notes={list}
        tags={tags || []}
        folderName={(note) => folders?.find(f => f.id === note.folderId)?.name}
        onNoteClick={handleNoteClick}
      />
    );
  };

  // 区块标题：左侧收纳按钮 + 标题，右侧查看全部
  const SectionHeader = ({ section, icon, color, title, onSeeAll }: { section: string; icon: React.ReactNode; color: string; title: string; onSeeAll?: () => void }) => {
    const collapsed = isCollapsed(section);
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSectionCollapse(section)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all shrink-0"
            title={collapsed ? '展开' : '收纳'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <h2 className="typo-section flex items-center gap-2">
            {icon} {title}
          </h2>
        </div>
        {onSeeAll && !collapsed && (
          <button onClick={onSeeAll} className="text-sm text-[var(--accent-mint)] flex items-center gap-1 hover:gap-2 transition-all">
            查看全部 <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
        {/* 手机端固定右上角按钮 — 与汉堡菜单对齐 */}
        <div className="fixed top-3 right-3 z-30 flex items-center gap-2 md:hidden">
          <button
            onClick={() => setShowFolderCreator(true)}
            className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
            title="新建文件夹"
          >
            <FolderPlus size={18} />
          </button>
          <button
            onClick={() => setShowViewPicker(!showViewPicker)}
            className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
            title="切换视图"
          >
            <LayoutGrid size={18} />
          </button>
          <AnimatePresence>
            {showViewPicker && (
              <motion.div
                key="mobile-view-picker"
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                transition={{ duration: 0.18 }}
                className="absolute top-11 right-0 glass-strong rounded-2xl p-1.5 min-w-[140px] z-50 space-y-0.5"
              >
                {homeViewModes.map(({ mode, icon: Icon, label }) => {
                  const active = settings.homeViewMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => { setHomeViewMode(mode); setShowViewPicker(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                        active ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      style={active ? { background: 'rgba(45, 212, 191, 0.12)' } : {}}
                    >
                      <Icon size={16} />
                      <span className="flex-1 text-left">{label}</span>
                      {active && <Check size={14} />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hero — 标题可收起 */}
        <div className="mb-6 sm:mb-8 relative">
          {/* 标题区域 — 点击收起，左侧留出汉堡菜单空间 */}
          {settings.showHomeTitle && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: homeTitleCollapsed ? 0 : 1,
                y: homeTitleCollapsed ? -30 : 0,
                height: homeTitleCollapsed ? 0 : 'auto',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="overflow-hidden cursor-pointer mt-12 md:mt-0"
              onClick={() => setHomeTitleCollapsed(true)}
            >
              <h1 className="typo-hero mb-2">
                <span className="gradient-text">让你的记忆</span>
                <br />
                <span className="text-[var(--text-primary)]">自由流动</span>
              </h1>
              <p className="typo-body-lg mt-2 sm:mt-3">
                MemoFlow · 跨平台备忘录
              </p>
            </motion.div>
          )}

          {/* 桌面端视图切换 + 新建文件夹 */}
          <div className="hidden md:flex shrink-0 items-center gap-2 absolute top-0 right-0">
            <button
              onClick={() => setShowFolderCreator(true)}
              className="icon-press glass w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
              title="新建文件夹"
            >
              <FolderPlus size={18} />
            </button>
            <button
              onClick={() => setShowViewPicker(!showViewPicker)}
              className="icon-press glass w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
              title="切换视图"
            >
              <LayoutGrid size={18} />
            </button>
            <AnimatePresence>
              {showViewPicker && (
                <motion.div
                  key="desktop-view-picker"
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-12 right-0 glass-strong rounded-2xl p-1.5 min-w-[140px] z-50 space-y-0.5"
                >
                  {homeViewModes.map(({ mode, icon: Icon, label }) => {
                    const active = settings.homeViewMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => { setHomeViewMode(mode); setShowViewPicker(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                          active ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                        style={active ? { background: 'rgba(45, 212, 191, 0.12)' } : {}}
                      >
                        <Icon size={16} />
                        <span className="flex-1 text-left">{label}</span>
                        {active && <Check size={14} />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 新建文件夹弹窗 — iOS 玻璃风格，与全应用统一 */}
        <AnimatePresence>
          {showFolderCreator && (
            <div className="z-50 bg-black/40 backdrop-blur-sm" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }} onClick={() => { setShowFolderCreator(false); setNewFolderName(''); setNewFolderIcon('📁'); setNewFolderLocation('local'); }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="ios-glass rounded-[28px] p-5 sm:p-6 w-full max-w-sm"
              >
                <h3 className="typo-title mb-5">新建文件夹</h3>

                {/* 名称输入 — iOS 风格圆角输入框 */}
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
                  placeholder="文件夹名称"
                  className="w-full px-4 py-3 rounded-2xl bg-white/8 border-0 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:bg-white/12 transition-colors"
                />

                {/* 保存位置 — 分组列表，iOS Settings 风格 */}
                <div className="mt-4">
                  <p className="typo-meta mb-2 px-1">保存位置</p>
                  <div className="ios-pill-note overflow-hidden">
                    {/* 本地 */}
                    <button
                      onClick={() => setNewFolderLocation('local')}
                      className="icon-press w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                      style={newFolderLocation !== 'local' ? { borderBottom: '0.5px solid var(--glass-border)' } : {}}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#2dd4bf20' }}>
                        <Smartphone size={17} style={{ color: '#2dd4bf' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="typo-note-title">本地</div>
                      </div>
                      {newFolderLocation === 'local' && <Check size={16} className="text-[var(--accent-mint)] shrink-0" />}
                    </button>
                    {/* 已连接网盘 */}
                    {connectedClouds.map((cloud, idx) => {
                      const isLast = idx === connectedClouds.length - 1;
                      const active = newFolderLocation === cloud.provider;
                      return (
                        <button
                          key={cloud.id}
                          onClick={() => setNewFolderLocation(cloud.provider)}
                          className="icon-press w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                          style={!isLast ? { borderBottom: '0.5px solid var(--glass-border)' } : {}}
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#a78bfa20' }}>
                            <Cloud size={17} style={{ color: '#a78bfa' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="typo-note-title">{CLOUD_LABELS[cloud.provider] || cloud.displayName}</div>
                          </div>
                          {active && <Check size={16} className="text-[var(--accent-mint)] shrink-0" />}
                        </button>
                      );
                    })}
                    {connectedClouds.length === 0 && (
                      <div className="px-4 py-3 text-center">
                        <span className="typo-meta">未连接网盘，</span>
                        <button
                          onClick={() => { setShowFolderCreator(false); setNewFolderName(''); setNewFolderIcon('📁'); setNewFolderLocation('local'); navigateTo('cloud'); }}
                          className="typo-meta text-[var(--accent-mint)]"
                        >
                          去连接
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 图标选择 — 紧凑网格 */}
                <div className="mt-4">
                  <p className="typo-meta mb-2 px-1">选择图标</p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {FOLDER_ICON_OPTIONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => setNewFolderIcon(icon)}
                        className={`icon-press aspect-square rounded-xl flex items-center justify-center text-lg transition-all ${newFolderIcon === icon ? 'bg-[var(--accent-mint)]/20 ring-1 ring-[var(--accent-mint)]' : 'hover:bg-white/5'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 操作按钮 — iOS 风格 */}
                <div className="flex gap-2.5 mt-5">
                  <button
                    onClick={() => { setShowFolderCreator(false); setNewFolderName(''); setNewFolderIcon('📁'); setNewFolderLocation('local'); }}
                    className="icon-press flex-1 px-4 py-3 rounded-2xl ios-glass typo-body text-center"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="icon-press flex-1 btn-primary text-sm disabled:opacity-50"
                  >
                    创建
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 统计卡片 - 随视图模式变化布局 */}
        {settings.homeViewMode === 'list' ? (
          <div className="space-y-2 mb-5 sm:mb-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stat.action}
                  className="ios-pill-note w-full flex items-center gap-3 px-4 py-2.5 text-left"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}20` }}>
                    <Icon size={15} style={{ color: stat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="typo-label">{stat.label}</div>
                  </div>
                  <span className="typo-stat shrink-0">{stat.value}</span>
                </motion.button>
              );
            })}
          </div>
        ) : settings.homeViewMode === 'timeline' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stat.action}
                  className="text-left relative overflow-hidden"
                  style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '0.5px solid var(--glass-border)',
                    borderRadius: '18px',
                    boxShadow: 'var(--shadow-sm), var(--inset-highlight)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full" style={{ background: stat.color }} />
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}20` }}>
                      <Icon size={14} style={{ color: stat.color }} />
                    </div>
                    <span className="typo-label text-xs">{stat.label}</span>
                  </div>
                  <div className="typo-stat">{stat.value}</div>
                </motion.button>
              );
            })}
          </div>
        ) : settings.homeViewMode === 'kanban' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stat.action}
                  className="text-left relative overflow-hidden"
                  style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '0.5px solid var(--glass-border)',
                    borderRadius: '18px',
                    boxShadow: 'var(--shadow-sm), var(--inset-highlight)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: stat.color }} />
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}20` }}>
                      <Icon size={14} style={{ color: stat.color }} />
                    </div>
                    <span className="typo-label text-xs">{stat.label}</span>
                  </div>
                  <div className="typo-stat">{stat.value}</div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stat.action}
                  className="text-left"
                  style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '0.5px solid var(--glass-border)',
                    borderRadius: '18px',
                    boxShadow: 'var(--shadow-sm), var(--inset-highlight)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}20` }}>
                      <Icon size={16} style={{ color: stat.color }} />
                    </div>
                    <span className="typo-label text-xs">{stat.label}</span>
                  </div>
                  <div className="typo-stat">{stat.value}</div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* 最近访问 — 紧凑竖向列表，一行一个，胶囊样式 */}
        {recentNotes.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              section="recent"
              icon={<Clock size={16} className="text-[var(--accent-ocean)]" />}
              color="#38bdf8"
              title="最近访问"
            />
            {!isCollapsed('recent') && (
              settings.homeViewMode === 'list' ? (
                <div className="space-y-2">
                  {recentNotes.map((note, i) => {
                    const folder = folders?.find(f => f.id === note.folderId);
                    return (
                      <motion.button
                        key={note.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleNoteClick(note.id)}
                        className="ios-pill-note w-full flex items-center gap-3 px-4 py-2.5 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="typo-note-title truncate">
                            {getDisplayTitle(note)}
                          </div>
                          <div className="typo-meta truncate mt-0.5">
                            {folder ? folder.name : '本地'}
                          </div>
                        </div>
                        <span className="typo-meta shrink-0">
                          {formatRecentTime(note.updatedAt)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              ) : settings.homeViewMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
                  {recentNotes.map((note, i) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      tags={tags || []}
                      folderName={folders?.find(f => f.id === note.folderId)?.name}
                      onClick={() => handleNoteClick(note.id)}
                      index={i}
                    />
                  ))}
                </div>
              ) : settings.homeViewMode === 'kanban' ? (
                <KanbanView
                  notes={recentNotes}
                  folders={folders || []}
                  tags={tags || []}
                  onNoteClick={handleNoteClick}
                />
              ) : (
                <TimelineView
                  notes={recentNotes}
                  tags={tags || []}
                  folderName={(note) => folders?.find(f => f.id === note.folderId)?.name}
                  onNoteClick={handleNoteClick}
                />
              )
            )}
          </section>
        )}

        {/* 全部笔记 */}
        <section className="mb-8">
          <SectionHeader
            section="allNotes"
            icon={<TrendingUp size={18} className="text-[var(--accent-mint)]" />}
            color="var(--accent-mint)"
            title="全部笔记"
            onSeeAll={() => { setShowAllNotes(true); navigateTo('notes'); }}
          />
          {!isCollapsed('allNotes') && (
            <>
              {notes === undefined ? (
                <div className="flex items-center justify-center py-16">
                  <span className="typo-body">加载中...</span>
                </div>
              ) : allNotes.length > 0 ? (
                renderNotes(allNotes)
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
                    <Plus size={28} className="text-[var(--text-secondary)]" />
                  </div>
                  <h3 className="typo-section mb-1">还没有笔记</h3>
                  <p className="typo-body mb-4">点击下方「新建」开始记录</p>
                  <button
                    onClick={() => { setSelectedNoteId(null); navigateTo('editor'); }}
                    className="btn-primary text-sm"
                  >
                    创建第一条笔记
                  </button>
                </motion.div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
