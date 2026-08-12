import { useMemo, useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid, List, Kanban, Clock, Plus, SearchX, CloudOff, CheckSquare, X, Database, Tag as TagIcon, Folder as FolderIcon, Trash2, MoreHorizontal, FileDown } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteListItem } from '../components/notes/NoteListItem';
import { KanbanView } from '../components/notes/KanbanView';
import { TimelineView } from '../components/notes/TimelineView';
import { exportNotesAsZip, exportFullBackup, importFullBackup } from '../lib/export';
import { getFolderIcon } from '../lib/folderIcons';

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
      // 多关键词 AND 匹配：所有 token 都必须出现在笔记中
      const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(n => {
        const haystack = `${n.title} ${n.plainText} ${n.content}`.toLowerCase();
        return tokens.every(t => haystack.includes(t));
      });
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

  // 多选/导出状态
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showTagPickerSheet, setShowTagPickerSheet] = useState(false);
  const [showFolderPickerSheet, setShowFolderPickerSheet] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowExportMenu(false);
    setShowTagPickerSheet(false);
    setShowFolderPickerSheet(false);
  };

  // 多选模式快捷键: Esc 退出; Cmd/Ctrl+A 全选当前列表
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitSelectMode();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (notes) setSelectedIds(new Set(notes.map(n => n.id)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode, notes]);

  const handleBatchExport = async () => {
    if (selectedIds.size === 0) return;
    setExportBusy(true);
    try {
      const notesToExport = (notes || []).filter(n => selectedIds.has(n.id));
      await exportNotesAsZip(notesToExport);
      showToast('success', `已导出 ${notesToExport.length} 条笔记`);
      exitSelectMode();
    } catch (e) {
      console.error(e);
      showToast('error', '导出失败');
    } finally {
      setExportBusy(false);
    }
  };

  const handleFullBackup = async () => {
    setExportBusy(true);
    try {
      await exportFullBackup();
      showToast('success', '整库备份已开始下载');
    } catch (e) {
      console.error(e);
      showToast('error', '备份失败');
    } finally {
      setExportBusy(false);
      setShowExportMenu(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setExportBusy(true);
    try {
      const result = await importFullBackup(file, { merge: false });
      showToast('success', `恢复完成：笔记 ${result.notes}、文件夹 ${result.folders}、标签 ${result.tags}`);
    } catch (e) {
      console.error(e);
      showToast('error', e instanceof Error ? e.message : '恢复失败');
    } finally {
      setExportBusy(false);
      setShowExportMenu(false);
    }
  };

  const handleBatchTag = (tagId: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    Promise.all(ids.map(id => db.notes.get(id))).then(notesList => {
      const updates = notesList.filter(Boolean).map(n => ({
        ...n!,
        tagIds: n!.tagIds.includes(tagId) ? n!.tagIds : [...n!.tagIds, tagId],
        updatedAt: Date.now(),
      }));
      db.notes.bulkPut(updates).then(() => {
        showToast('success', `已为 ${updates.length} 条笔记添加标签`);
        exitSelectMode();
      });
    });
  };

  const handleBatchMove = (folderId: string | null) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    db.transaction('rw', db.notes, async () => {
      for (const id of ids) {
        await db.notes.update(id, { folderId, updatedAt: Date.now() });
      }
    }).then(() => {
      showToast('success', `已移动 ${ids.length} 条笔记`);
      exitSelectMode();
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`确定将 ${count} 条笔记移入回收站？`)) return;
    const ids = Array.from(selectedIds);
    db.transaction('rw', db.notes, async () => {
      for (const id of ids) {
        await db.notes.update(id, { isArchived: true, updatedAt: Date.now() });
      }
    }).then(() => {
      showToast('success', `已移入回收站 ${count} 条笔记`);
      exitSelectMode();
    });
  };

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
          <p className="typo-meta mt-1">{selectMode ? `已选 ${selectedIds.size} / ${notes?.length || 0}` : `${notes?.length || 0} 条笔记`}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 多选模式工具栏 — 极简顶部：仅全选 + 取消 */}
          {selectMode && (
            <>
              <button
                onClick={() => {
                  if (notes && selectedIds.size === notes.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set((notes || []).map(n => n.id)));
                  }
                }}
                className="icon-press glass px-3 h-9 rounded-xl flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title="全选/取消全选"
              >
                <CheckSquare size={15} /> 全选
              </button>
              <button
                onClick={exitSelectMode}
                className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] shrink-0"
                title="退出多选"
              >
                <X size={18} />
              </button>
            </>
          )}
            <>
              {/* 右上角三点菜单 — 仅保留备份/恢复与多选，与编辑界面风格一致 */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] shrink-0"
                  title="更多"
                >
                  <MoreHorizontal size={18} />
                </button>
                <AnimatePresence>
                  {showExportMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-11 z-50 glass-strong rounded-xl p-2 min-w-[160px] space-y-0.5"
                      >
                        <button
                          onClick={() => {
                            setShowExportMenu(false);
                            handleFullBackup();
                          }}
                          disabled={exportBusy}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)] disabled:opacity-50"
                        >
                          <Database size={16} className="text-[var(--accent-mint)]" /> 备份
                        </button>
                        <button
                          onClick={() => {
                            setShowExportMenu(false);
                            setSelectMode(true);
                          }}
                          disabled={(notes?.length || 0) === 0}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)] disabled:opacity-50"
                        >
                          <CheckSquare size={16} className="text-[var(--accent-violet)]" /> 多选
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
              {/* 4 种视图切换 — 仅桌面端显示，移动端由三点菜单统一管理 */}
              <div className="hidden sm:flex items-center gap-1 ios-glass-btn rounded-xl p-1">
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
            </>
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
                  onClick={() => selectMode ? toggleSelect(note.id) : handleNoteClick(note.id)}
                  selectMode={selectMode}
                  selected={selectedIds.has(note.id)}
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
                  onClick={() => selectMode ? toggleSelect(note.id) : handleNoteClick(note.id)}
                  index={i}
                  selectMode={selectMode}
                  selected={selectedIds.has(note.id)}
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

      {/* 底部多选操作栏 */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-40"
          >
            <div className="ios-glass border-t border-[var(--glass-border)] px-3 sm:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <div className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3">
                {/* 已选数量 — 展示当前进度 */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0" style={{ color: 'var(--accent-mint)' }}>
                  <CheckSquare size={14} />
                  <span className="typo-label">{selectedIds.size}</span>
                </div>

                {/* 主操作按钮 */}
                <div className="flex-1 flex items-center justify-end gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  <button
                    onClick={() => setShowTagPickerSheet(true)}
                    disabled={selectedIds.size === 0}
                    className="icon-press glass h-10 px-3.5 rounded-xl flex items-center gap-2 text-sm shrink-0 disabled:opacity-40 text-[var(--text-primary)] hover:text-[var(--accent-mint)]"
                    title="批量打标签"
                  >
                    <TagIcon size={15} /> <span className="hidden sm:inline">标签</span>
                  </button>
                  <button
                    onClick={() => setShowFolderPickerSheet(true)}
                    disabled={selectedIds.size === 0}
                    className="icon-press glass h-10 px-3.5 rounded-xl flex items-center gap-2 text-sm shrink-0 disabled:opacity-40 text-[var(--text-primary)] hover:text-[var(--accent-mint)]"
                    title="批量移动"
                  >
                    <FolderIcon size={15} /> <span className="hidden sm:inline">移动</span>
                  </button>
                  <button
                    onClick={handleBatchExport}
                    disabled={selectedIds.size === 0 || exportBusy}
                    className="icon-press glass h-10 px-3.5 rounded-xl flex items-center gap-2 text-sm shrink-0 disabled:opacity-40 text-[var(--text-primary)] hover:text-[var(--accent-mint)]"
                    title="批量导出"
                  >
                    <FileDown size={15} /> <span className="hidden sm:inline">导出</span>
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={selectedIds.size === 0}
                    className="icon-press h-10 w-10 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                    title="批量移到回收站"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 批量选择标签 — 底部 Action Sheet */}
      <AnimatePresence>
        {showTagPickerSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTagPickerSheet(false)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 ios-glass rounded-t-2xl p-5 pb-8 max-h-[70vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-[var(--text-secondary)] rounded-full mx-auto mb-4 opacity-30" />
              <div className="flex items-center gap-2 mb-4">
                <TagIcon size={18} className="text-[var(--accent-mint)]" />
                <span className="typo-note-title">批量添加标签</span>
                <span className="typo-meta">为 {selectedIds.size} 条笔记</span>
                <button onClick={() => setShowTagPickerSheet(false)} className="ml-auto typo-meta text-[var(--accent-mint)]">取消</button>
              </div>
              {tags && tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { handleBatchTag(t.id); setShowTagPickerSheet(false); }}
                      className="icon-press px-3.5 py-2 rounded-full text-sm flex items-center gap-1.5 transition-all ios-glass-btn text-[var(--text-primary)]"
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 typo-meta">暂无标签</p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 批量选择文件夹 — 底部 Action Sheet */}
      <AnimatePresence>
        {showFolderPickerSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFolderPickerSheet(false)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 ios-glass rounded-t-2xl p-4 pb-8 max-h-[60vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-[var(--text-secondary)] rounded-full mx-auto mb-3 opacity-30" />
              <div className="flex items-center gap-2 mb-3">
                <FolderIcon size={16} className="text-[var(--accent-mint)]" />
                <span className="typo-label">批量移动 {selectedIds.size} 条笔记</span>
                <button onClick={() => setShowFolderPickerSheet(false)} className="ml-auto typo-meta text-[var(--accent-mint)]">取消</button>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => { handleBatchMove(null); setShowFolderPickerSheet(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] hover:bg-white/5"
                >
                  <FolderIcon size={18} /> 本地
                </button>
                {(folders || []).filter(f => !f.id.startsWith('folder-cloud-')).map(f => {
                  const FIcon = getFolderIcon(f.icon);
                  return (
                    <button
                      key={f.id}
                      onClick={() => { handleBatchMove(f.id); setShowFolderPickerSheet(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] hover:bg-white/5"
                    >
                      <FIcon size={18} /> {f.name}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast 提示 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div
              className="glass-strong rounded-2xl px-4 py-2.5 text-sm shadow-lg flex items-center gap-2"
              style={{
                color: toast.type === 'success' ? 'var(--accent-mint)' : '#f87171',
              }}
            >
              {toast.type === 'success' ? <CheckSquare size={15} /> : <X size={15} />}
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}