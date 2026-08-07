import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Grid, List, Kanban, Clock, Plus } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteListItem } from '../components/notes/NoteListItem';
import { KanbanView } from '../components/notes/KanbanView';
import { TimelineView } from '../components/notes/TimelineView';

export function Notes() {
  const {
    settings, setViewMode,
    selectedFolderId, selectedTagId,
    showFavorites, showAllNotes,
    searchQuery, setSelectedNoteId, setCurrentPage,
  } = useStore();

  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);

  const notes = useLiveQuery(async () => {
    const allNotes = await db.notes.toArray();
    let result = allNotes.filter(n => !n.isArchived);

    if (showFavorites) {
      result = result.filter(n => n.isPinned);
    }
    if (showAllNotes) {
      // 全部笔记，不过滤
    }
    if (selectedFolderId) {
      result = result.filter(n => n.folderId === selectedFolderId);
    }
    if (selectedTagId) {
      result = result.filter(n => n.tagIds.includes(selectedTagId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.plainText.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    }

    // 置顶在前，然后按更新时间排序
    result.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    return result;
  }, [selectedFolderId, selectedTagId, showFavorites, showAllNotes, searchQuery]);

  const currentFolder = folders?.find(f => f.id === selectedFolderId);
  const currentTag = tags?.find(t => t.id === selectedTagId);

  const getTitle = () => {
    if (showFavorites) return '收藏笔记';
    if (showAllNotes) return '全部笔记';
    if (currentFolder) return `${currentFolder.icon} ${currentFolder.name}`;
    if (currentTag) return `# ${currentTag.name}`;
    if (searchQuery) return `搜索: "${searchQuery}"`;
    return '全部笔记';
  };

  const handleNoteClick = (noteId: string) => {
    setSelectedNoteId(noteId);
    setCurrentPage('editor');
  };

  const viewModes = [
    { mode: 'list' as const, icon: List, label: '列表' },
    { mode: 'grid' as const, icon: Grid, label: '网格' },
    { mode: 'kanban' as const, icon: Kanban, label: '看板' },
    { mode: 'timeline' as const, icon: Clock, label: '时间线' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{getTitle()}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{notes?.length || 0} 条笔记</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 4 种视图切换 */}
          <div className="flex items-center gap-1 glass rounded-xl p-1">
            {viewModes.map(({ mode, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  settings.viewMode === mode
                    ? 'bg-[var(--accent-mint)]/20 text-[var(--accent-mint)]'
                    : 'text-[var(--text-secondary)] hover:bg-white/5'
                }`}
                title={mode}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          <button
            onClick={() => { setSelectedNoteId(null); setCurrentPage('editor'); }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={18} /> 新建
          </button>
        </div>
      </div>

      {/* 笔记列表 */}
      {notes && notes.length > 0 ? (
        <>
          {/* 列表视图 — Apple Notes 紧凑列表风格 */}
          {settings.viewMode === 'list' && (
            <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
              {notes.map((note, i) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  tags={tags || []}
                  folderName={folders?.find(f => f.id === note.folderId)?.name}
                  onClick={() => handleNoteClick(note.id)}
                />
              ))}
            </div>
          )}

          {/* 网格视图 */}
          {settings.viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {notes.map((note, i) => (
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
          )}

          {/* 看板视图 */}
          {settings.viewMode === 'kanban' && (
            <KanbanView
              notes={notes}
              folders={folders || []}
              tags={tags || []}
              onNoteClick={handleNoteClick}
            />
          )}

          {/* 时间线视图 */}
          {settings.viewMode === 'timeline' && (
            <TimelineView
              notes={notes}
              tags={tags || []}
              folderName={(note) => folders?.find(f => f.id === note.folderId)?.name}
              onNoteClick={handleNoteClick}
            />
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
            <Plus size={28} className="text-[var(--text-secondary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">还没有笔记</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">点击右上角「新建」开始记录</p>
          <button
            onClick={() => { setSelectedNoteId(null); setCurrentPage('editor'); }}
            className="btn-primary text-sm"
          >
            创建第一条笔记
          </button>
        </motion.div>
      )}
    </div>
  );
}