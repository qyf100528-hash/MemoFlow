
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Star, Folder as FolderIcon, Cloud, TrendingUp, ArrowRight, LayoutGrid, List, Grid, Kanban, Clock, Check, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteListItem } from '../components/notes/NoteListItem';
import { KanbanView } from '../components/notes/KanbanView';
import { TimelineView } from '../components/notes/TimelineView';
import type { CloudProvider } from '../types';

const CLOUD_NAMES: Record<CloudProvider, string> = {
  baidu: '百度网盘',
  google: 'Google Drive',
  quark: '夸克网盘',
  onedrive: 'OneDrive',
};

export function Home() {
  const { settings, setHomeViewMode, navigateTo, setSelectedNoteId, setShowAllNotes, setShowFavorites, notesCache, setNotesCache, toggleSectionCollapse } = useStore();
  const [showViewPicker, setShowViewPicker] = useState(false);

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

  const pinnedNotes = notes?.filter(n => n.isPinned).slice(0, 3) || [];
  const allNotes = notes || [];

  // 统计卡片数据 — 按 settings.homeStatOrder 排序
  const statsMap: Record<string, { label: string; value: number; icon: typeof FileText; color: string; action: () => void }> = {
    allNotes: { label: '全部笔记', value: notes?.length || 0, icon: FileText, color: '#2dd4bf', action: () => { setShowAllNotes(true); navigateTo('notes'); } },
    pinned: { label: '置顶笔记', value: notes?.filter(n => n.isPinned).length || 0, icon: Star, color: '#fbbf24', action: () => { setShowFavorites(true); navigateTo('notes'); } },
    folders: { label: '文件夹', value: folders?.length || 0, icon: FolderIcon, color: '#38bdf8', action: () => { setShowAllNotes(true); navigateTo('notes'); } },
    clouds: { label: '已连接网盘', value: connectedClouds.length, icon: Cloud, color: '#a78bfa', action: () => navigateTo('cloud') },
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
    }
    setSelectedNoteId(noteId);
    navigateTo('editor');
  };

  const isCollapsed = (section: string) => (settings.collapsedSections || []).includes(section);

  // 按 homeViewMode 渲染笔记列表
  const renderNotes = (list: typeof allNotes) => {
    if (settings.homeViewMode === 'list') {
      return (
        <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
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
        {/* Hero + 视图收纳图标 — 可在设置中关闭 */}
        {settings.showHomeTitle && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex items-start justify-between gap-4"
          >
            <div>
              <h1 className="typo-hero mb-2">
                <span className="gradient-text">让你的记忆</span>
                <br />
                <span className="text-[var(--text-primary)]">自由流动</span>
              </h1>
              <p className="typo-body-lg mt-2 sm:mt-3">
                MemoFlow · 跨平台备忘录
              </p>
            </div>

            {/* 视图切换收纳图标 */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowViewPicker(!showViewPicker)}
                className="glass w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
                title="切换视图"
              >
                <LayoutGrid size={18} />
              </button>
              <AnimatePresence>
                {showViewPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowViewPicker(false)} />
                    <motion.div
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
                  </>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* 统计卡片 — 根据首页视图模式切换布局，标签使用 typo-label 标题字体 */}
        {settings.homeViewMode === 'list' ? (
          <div className="glass rounded-2xl overflow-hidden mb-6 sm:mb-8" style={{ border: '1px solid var(--glass-border)' }}>
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={stat.action}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/5"
                  style={i < stats.length - 1 ? { borderBottom: '0.5px solid var(--glass-border)' } : {}}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${stat.color}20` }}>
                    <Icon size={18} style={{ color: stat.color }} />
                  </div>
                  <span className="typo-label">{stat.label}</span>
                  <span className="ml-auto typo-stat">{stat.value}</span>
                </motion.button>
              );
            })}
          </div>
        ) : settings.homeViewMode === 'timeline' ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  onClick={stat.action}
                  className="glass-card p-5 text-left relative pl-6"
                >
                  <div className="absolute left-4 top-5 bottom-5 w-0.5 rounded-full" style={{ background: `${stat.color}40` }} />
                  <div className="absolute left-2.5 top-5 w-3 h-3 rounded-full" style={{ background: stat.color }} />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                      <Icon size={16} style={{ color: stat.color }} />
                    </div>
                    <span className="typo-label">{stat.label}</span>
                  </div>
                  <div className="typo-stat">{stat.value}</div>
                </motion.button>
              );
            })}
          </div>
        ) : settings.homeViewMode === 'kanban' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                  onClick={stat.action}
                  className="glass-card p-4 text-left overflow-hidden relative"
                >
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: stat.color }} />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                      <Icon size={16} style={{ color: stat.color }} />
                    </div>
                  </div>
                  <div className="typo-stat">{stat.value}</div>
                  <div className="typo-label mt-1">{stat.label}</div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.button
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  onClick={stat.action}
                  className="glass-card p-5 text-left"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                      <Icon size={20} style={{ color: stat.color }} />
                    </div>
                  </div>
                  <div className="typo-stat">{stat.value}</div>
                  <div className="typo-label mt-1">{stat.label}</div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* 置顶笔记 */}
        {pinnedNotes.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              section="pinned"
              icon={<Star size={18} className="text-[#fbbf24] fill-current" />}
              color="#fbbf24"
              title="置顶笔记"
              onSeeAll={() => { setShowAllNotes(true); navigateTo('notes'); }}
            />
            {!isCollapsed('pinned') && renderNotes(pinnedNotes)}
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

        {/* 已连接网盘 — 默认显示在最下方 */}
        {connectedClouds.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              section="clouds"
              icon={<Cloud size={18} className="text-[var(--accent-violet)]" />}
              color="#a78bfa"
              title="已连接网盘"
              onSeeAll={() => navigateTo('cloud')}
            />
            {!isCollapsed('clouds') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {connectedClouds.map((cloud, i) => {
                  const name = CLOUD_NAMES[cloud.provider] || cloud.displayName;
                  return (
                    <motion.button
                      key={cloud.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ y: -3 }}
                      onClick={() => navigateTo('cloud')}
                      className="glass-card p-4 text-left flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#a78bfa20' }}>
                        <Cloud size={20} className="text-[var(--accent-violet)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="typo-label truncate">{name}</div>
                        <div className="typo-meta mt-0.5">
                          {cloud.lastSyncAt ? `上次同步 ${new Date(cloud.lastSyncAt).toLocaleDateString()}` : '未同步'}
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-[var(--text-secondary)] shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
