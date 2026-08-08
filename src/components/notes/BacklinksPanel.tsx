import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link2, ArrowUpRight, FileText } from 'lucide-react';
import { findBacklinks } from '../../lib/links/link-parser';
import { getDisplayTitle } from '../../lib/note-utils';
import type { Note } from '../../types';

interface Props {
  noteId: string;
  onNoteClick: (noteId: string) => void;
  onClose?: () => void;
}

export function BacklinksPanel({ noteId, onNoteClick }: Props) {
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    findBacklinks(noteId).then((results) => {
      setBacklinks(results);
      setLoading(false);
    });
  }, [noteId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium mb-3">
        <Link2 size={16} className="text-[var(--accent-ocean)]" />
        反向链接
        <span className="text-xs text-[var(--text-secondary)] ml-1">
          {backlinks.length > 0 ? `${backlinks.length} 篇笔记引用了此笔记` : '暂无反向链接'}
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--text-secondary)]">加载中...</p>
      ) : backlinks.length > 0 ? (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {backlinks.map((note) => (
            <motion.button
              key={note.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ x: 2 }}
              onClick={() => onNoteClick(note.id)}
              className="w-full text-left glass rounded-xl p-3 hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FileText size={12} className="text-[var(--accent-ocean)]" />
                  <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-mint)] transition-colors">
                    {getDisplayTitle(note)}
                  </span>
                </div>
                <ArrowUpRight size={12} className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                {note.plainText || note.content.replace(/[#*`>\-|_\[\]()]/g, '').slice(0, 80)}
              </p>
            </motion.button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          在其他笔记中使用 <code className="px-1 py-0.5 rounded bg-white/10 text-[var(--accent-mint)]">[[笔记标题]]</code> 语法链接到此笔记，将在此处显示。
        </p>
      )}
    </motion.div>
  );
}
