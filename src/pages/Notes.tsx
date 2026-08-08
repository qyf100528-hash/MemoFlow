import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Grid, List, Kanban, Clock, Plus, SearchX, CloudOff } from 'lucide-react';
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
    searchQuery, setSearchQuery, setSelectedNoteId, navigateTo,
    notesCache, setNotesCache, addRecentItem,
  } = useStore();

  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const cloudAccounts = useLiveQuery(() => db.cloudAccounts.filter(a => a.isConnected).toArray(), []);

  // 从 Dexie 获取原始数据，不做排序
  const rawNotes = useLiveQuery(async () => {
    const allNotes = await db.notes.toArray();
    let result = allNotes.filter(n => !n.isArchived);

    if (showFavorites) {
      result = result.filter(n => n.isPinned);
    }
    // showAllNotes 不再排除置顶笔记：置顶笔记在全部笔记中也显示并置顶排序
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

    return result;
  }, [selectedFolderId, selectedTagId, showFavorites, showAllNotes, searchQuery]);

  // 应用排序：如果有缓存快照则保持缓存顺序，否则按更新时间排序
  const notes = useMemo(() => {
    if (!rawNotes) return undefined;

    if (notesCache && notesCache.length > 0) {
      // 使用缓存顺序恢复列表快照
      const orderMap = new Map(notesCache.map((id, i) => [id, i]));
      // 只保留在当前过滤结果中且存在于缓存的笔记
      const filtered = rawNotes.filter(n => orderMap.has(n.id));
      // 按缓存顺序排列
      filtered.sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
      return filtered;
    }

    // 无缓存时：默认按最后更新时间排序（仅在用户主动触发时）
    const sorted = [...rawNotes];
    sorted.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return sorted;
  }, [rawNotes, notesCache]);

  const currentFolder = folders?.find(f => f.id === selectedFolderId);
  const currentTag = tags?.find(t => t.id === selectedTagId);

  // 检测是否选择了未连接的网盘文件夹
  const isCloudFolder = selectedFolderId?.startsWith('folder-cloud-');
  const cloudProvider = isCloudFolder ? selectedFolderId!.replace('folder-cloud-', '') : null;
  const isCloudConnected = cloudProvider ? cloudAccounts?.some(a => a.provider === cloudProvider) : false;

  const getTitle = () => {
    if (showFavorites) return '置顶笔记';
    if (showAllNotes) return '全部笔记';
    if (currentFolder) return currentFolder.name;
    if (currentTag) return `# ${currentTag.name}`;
    if (searchQuery) return `搜索: "${searchQuery}"`;
    return '全部笔记';
  };

  const handleNoteClick = (noteId: string) => {
    // 保存当前列表顺序快照到缓存
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

  const viewModes = [
    { mode: 'list' as const, icon: List, label: '列表' },
    { mode: 'grid' as const, icon: Grid, label: '网格' },
    { mode: 'kanban' as const, icon: Kanban, label: '看板' },
    { mode: 'timeline' as const, icon: Clock, label: '时间线' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      {/* 头部 — 标题下移避开返回按钮，与右侧按钮同一行对齐 */}
      <div className="flex items-center justify-between mb-6 pt-14 md:pt-0">
        <div>
          <h1 className="typo-title">{getTitle()}</h1>
          <p className="typo-meta mt-1">{notes?.length || 0} 条笔记</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 4 种视图切换 — ios-glass-btn 质感 */}
          <div className="flex items-center gap-1 ios-glass-btn rounded-xl p-1">
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
        </div>
      </div>

      {/* 笔记列表 */}
      {notes === undefined ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-20"
        >
          <span className="typo-body">加载中...</span>
        </motion.div>
      ) : notes.length > 0 ? (
        <>
          {/* 列表视图 — 统一独立胶囊卡片 */}
          {settings.viewMode === 'list' && (
            <div className="space-y-2">
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
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
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
      ) : isCloudFolder && !isCloudConnected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
            <CloudOff size={28} className="text-[var(--text-secondary)]" />
          </div>
          <h3 className="typo-section mb-1">网盘未连接</h3>
          <p className="typo-body mb-4">请先连接{currentFolder?.name || '该网盘'}后查看笔记</p>
          <button onClick={() => navigateTo('cloud')} className="btn-primary text-sm">
            前往云同步
          </button>
        </motion.div>
      ) : searchQuery.trim() ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
            <SearchX size={28} className="text-[var(--text-secondary)]" />
          </div>
          <h3 className="typo-section mb-1">未找到相关内容</h3>
          <p className="typo-body mb-4">没有匹配「{searchQuery}」的笔记</p>
          <button
            onClick={() => setSearchQuery('')}
            className="btn-primary text-sm"
          >
            清除搜索
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
            <Plus size={28} className="text-[var(--text-secondary)]" />
          </div>
          <h3 className="typo-section mb-1">还没有笔记</h3>
          <p className="typo-body mb-4">点击右上角「新建」开始记录</p>
          <button
            onClick={() => { setSelectedNoteId(null); navigateTo('editor'); }}
            className="btn-primary text-sm"
          >
            创建第一条笔记
          </button>
        </motion.div>
      )}
    </div>
  );
}