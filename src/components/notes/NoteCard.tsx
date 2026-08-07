import { motion } from 'framer-motion';
import { Pin, Star, Lock, Paperclip } from 'lucide-react';
import type { Note, Tag } from '../../types';

interface NoteCardProps {
  note: Note;
  tags: Tag[];
  folderName?: string;
  onClick: () => void;
  index?: number;
}

export function NoteCard({ note, tags, folderName, onClick, index = 0 }: NoteCardProps) {
  const noteTags = tags.filter(t => note.tagIds.includes(t.id));
  const preview = note.plainText || note.content.replace(/[#*`>\-|]/g, '').slice(0, 120);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="glass-card p-4 sm:p-5 cursor-pointer group"
    >
      {/* 顶部图标 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {note.isPinned && <Pin size={14} className="text-[var(--accent-mint)] fill-current" />}
          {note.isLocked && <Lock size={14} className="text-[var(--accent-ocean)]" />}
          {note.attachments.length > 0 && <Paperclip size={14} className="text-[var(--text-secondary)]" />}
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          {formatTime(note.updatedAt)}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="font-semibold text-[var(--text-primary)] mb-2 line-clamp-1 group-hover:text-[var(--accent-mint)] transition-colors">
        {note.title || '无标题'}
      </h3>

      {/* 预览 */}
      <p className="text-sm text-[var(--text-secondary)] line-clamp-3 mb-3 leading-relaxed">
        {preview}
      </p>

      {/* 底部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {noteTags.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}
            >
              {t.name}
            </span>
          ))}
          {folderName && (
            <span className="text-xs text-[var(--text-secondary)] opacity-60">
              · {folderName}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
