import { useState } from 'react';
import { motion } from 'framer-motion';
import { History, RotateCcw, X, Clock, FileText } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getNoteVersions, rollbackToVersion } from '../../lib/version-history';
import type { NoteVersion } from '../../types';

interface Props {
  noteId: string;
  onClose: () => void;
  onRollback: (version: NoteVersion) => void;
}

export function VersionHistory({ noteId, onClose, onRollback }: Props) {
  const versions = useLiveQuery(() => getNoteVersions(noteId), [noteId]);
  const [rollbacking, setRollbacking] = useState<string | null>(null);

  const handleRollback = async (version: NoteVersion) => {
    if (!confirm(`确定回滚到版本 ${version.version}？当前内容将保存为新版本。`)) return;
    setRollbacking(version.id);
    const result = await rollbackToVersion(version.id);
    if (result) {
      onRollback(result);
      onClose();
    }
    setRollbacking(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-2xl p-4 max-h-[60vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History size={16} className="text-[var(--accent-mint)]" />
          版本历史
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-[var(--text-secondary)]">
          <X size={14} />
        </button>
      </div>

      {(!versions || versions.length === 0) ? (
        <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
          <Clock size={32} className="mx-auto mb-2 opacity-40" />
          暂无历史版本
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((v, i) => (
            <div key={v.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-mint)]/10 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-[var(--accent-mint)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">版本 {v.version}</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {new Date(v.createdAt).toLocaleString('zh-CN')}
                  {i === 0 ? ' · 当前版本' : ''}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                  {v.title || '无标题'}
                </div>
              </div>
              {i > 0 && (
                <button
                  onClick={() => handleRollback(v)}
                  disabled={rollbacking === v.id}
                  className="glass px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 text-[var(--accent-mint)] hover:bg-white/10 disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                  {rollbacking === v.id ? '回滚中...' : '回滚'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
