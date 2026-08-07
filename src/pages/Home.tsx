
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { FileText, Star, Folder as FolderIcon, Cloud, TrendingUp, ArrowRight } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { NoteCard } from '../components/notes/NoteCard';

export function Home() {
  const { setCurrentPage, navigateTo, setSelectedNoteId, setSelectedFolderId, setShowAllNotes, setShowFavorites } = useStore();
  const notes = useLiveQuery(async () => { const all = await db.notes.toArray(); return all.filter(n => !n.isArchived).sort((a, b) => b.updatedAt - a.updatedAt); }, []);
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const cloudAccounts = useLiveQuery(() => db.cloudAccounts.toArray(), []);
  const pinnedNotes = notes?.filter(n => n.isPinned).slice(0, 3) || [];
  const recentNotes = notes?.slice(0, 6) || [];
  const connectedClouds = cloudAccounts?.filter(a => a.isConnected).length || 0;

  const stats = [
    { label: '全部笔记', value: notes?.length || 0, icon: FileText, color: '#2dd4bf', action: () => { setShowAllNotes(true); navigateTo('notes'); } },
    { label: '收藏笔记', value: notes?.filter(n => n.isPinned).length || 0, icon: Star, color: '#fbbf24', action: () => { setShowFavorites(true); navigateTo('notes'); } },
    { label: '文件夹', value: folders?.length || 0, icon: FolderIcon, color: '#38bdf8', action: () => { setShowAllNotes(true); navigateTo('notes'); } },
    { label: '已连接网盘', value: connectedClouds, icon: Cloud, color: '#a78bfa', action: () => navigateTo('cloud') },
  ];

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            <span className="gradient-text">让你的记忆</span>
            <br />
            <span className="text-[var(--text-primary)]">自由流动</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-base sm:text-lg mt-2 sm:mt-3">
            MemoFlow · 跨平台备忘录 · 数据完全自主
          </p>
        </motion.div>

        {/* 统计卡片 */}
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
                <div className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">{stat.label}</div>
              </motion.button>
            );
          })}
        </div>

        {/* 置顶笔记 */}
        {pinnedNotes.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Star size={18} className="text-[#fbbf24] fill-current" /> 置顶笔记
              </h2>
              <button onClick={() => { setShowAllNotes(true); navigateTo('notes'); }} className="text-sm text-[var(--accent-mint)] flex items-center gap-1 hover:gap-2 transition-all">
                查看全部 <ArrowRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {pinnedNotes.map((note, i) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  tags={tags || []}
                  folderName={folders?.find(f => f.id === note.folderId)?.name}
                  onClick={() => { setSelectedNoteId(note.id); setCurrentPage('editor'); }}
                  index={i}
                />
              ))}
            </div>
          </section>
        )}

        {/* 最近笔记 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-[var(--accent-mint)]" /> 最近编辑
            </h2>
            <button onClick={() => { setShowAllNotes(true); navigateTo('notes'); }} className="text-sm text-[var(--accent-mint)] flex items-center gap-1 hover:gap-2 transition-all">
              查看全部 <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {recentNotes.map((note, i) => (
              <NoteCard
                key={note.id}
                note={note}
                tags={tags || []}
                folderName={folders?.find(f => f.id === note.folderId)?.name}
                onClick={() => { setSelectedNoteId(note.id); setCurrentPage('editor'); }}
                index={i}
              />
            ))}
          </div>
        </section>
      </div>

    </>
  );
}
