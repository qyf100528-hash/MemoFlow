import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Trash2, RotateCcw, SearchX, AlertTriangle } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { getDisplayTitle } from '../lib/note-utils';
import { getFolderIcon } from '../lib/folderIcons';

export function Trash() {
  const { navigateTo, setSelectedNoteId } = useStore();
  const folders = useLiveQuery(() => db.folders.toArray(), []);
  const deletedNotes = useLiveQuery(() => db.notes.filter(n => n.isArchived).toArray(), []);

  const handleRestore = async (id: string) => {
    await db.notes.update(id, { isArchived: false });
  };

  const handlePermanentDelete = async (id: string) => {
    await db.notes.delete(id);
  };

  const handleEmptyTrash = async () => {
    if (!deletedNotes || deletedNotes.length === 0) return;
    if (!confirm(`确定要永久删除 ${deletedNotes.length} 条笔记吗？此操作不可恢复。`)) return;
    await Promise.all(deletedNotes.map(n => db.notes.delete(n.id)));
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    if (ts >= today) return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (ts >= yesterday) return '昨天';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      {/* 头部 — 与 Notes/Folders 统一，pt-14 避开移动端返回键 */}
      <div className="flex items-center justify-between mb-6 sm:mb-8 pt-14 md:pt-0">
        <div>
          <h1 className="typo-title">回收站</h1>
          <p className="typo-meta mt-1">{deletedNotes?.length || 0} 条笔记</p>
        </div>
        {deletedNotes && deletedNotes.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="ios-glass-btn px-3 h-9 rounded-xl flex items-center gap-2 text-sm text-red-400 transition-colors"
            title="清空回收站"
          >
            <Trash2 size={15} /> 清空
          </button>
        )}
      </div>

      {/* 列表 */}
      {deletedNotes === undefined ? (
        <div className="text-center py-12 typo-meta">加载中…</div>
      ) : deletedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
            <SearchX size={28} className="text-[var(--text-secondary)]" />
          </div>
          <p className="typo-body text-[var(--text-secondary)]">回收站为空</p>
          <p className="typo-meta mt-1">删除的笔记会出现在这里</p>
        </div>
      ) : (
        <>
          {/* 提示条 */}
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-2xl" style={{ background: 'rgba(251, 146, 60, 0.08)' }}>
            <AlertTriangle size={15} className="text-orange-400 shrink-0" />
            <span className="typo-meta text-orange-400/90">回收站中的笔记可随时恢复</span>
          </div>

          <div className="space-y-2">
            {deletedNotes.map((note, i) => {
              const folder = folders?.find(f => f.id === note.folderId);
              const FIcon = folder ? getFolderIcon(folder.icon) : null;
              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="ios-pill-note w-full text-left flex items-center gap-3 px-4 py-3"
                >
                  {/* 内容区 — 点击恢复 */}
                  <button
                    onClick={() => handleRestore(note.id)}
                    className="flex-1 min-w-0 text-left"
                    title="点击恢复"
                  >
                    <div className="typo-note-title truncate">
                      {getDisplayTitle(note) || '无标题'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="typo-meta">{formatTime(note.updatedAt)}</span>
                      {folder && FIcon && (
                        <span className="typo-meta flex items-center gap-1">
                          · <FIcon size={11} /> {folder.name}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* 操作按钮 */}
                  <button
                    onClick={() => handleRestore(note.id)}
                    className="icon-press w-8 h-8 rounded-lg flex items-center justify-center text-[var(--accent-mint)] hover:bg-[var(--accent-mint)]/10 transition-colors shrink-0"
                    title="恢复"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(note.id)}
                    className="icon-press w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                    title="永久删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
