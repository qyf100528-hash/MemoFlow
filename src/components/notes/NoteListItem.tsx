import { motion } from 'framer-motion';
import { Pin, Lock } from 'lucide-react';
import type { Note, Tag } from '../../types';
import { getDisplayTitle } from '../../lib/note-utils';

interface NoteListItemProps {
  note: Note;
  tags: Tag[];
  folderName?: string;
  onClick: () => void;
}

export function NoteListItem({ note, tags, folderName, onClick }: NoteListItemProps) {
  const noteTags = tags.filter(t => note.tagIds.includes(t.id));
  const rawPreview = note.plainText || note.content.replace(/[#*`>\-|]/g, '').trim();
  // 空内容时显示文件夹名或占位文字，保证列表项不为空
  const preview = rawPreview || (folderName ? `${folderName}` : '无内容');

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="ios-pill-note w-full text-left flex items-center gap-3 px-4 py-2.5"
    >
      {/* 左侧：置顶/锁定标记 */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-5">
        {note.isPinned && <Pin size={13} className="text-[var(--accent-mint)] fill-current" />}
        {note.isLocked && <Lock size={13} className="text-[var(--accent-ocean)]" />}
      </div>

      {/* 中间：标题 + 摘要 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="typo-note-title truncate">
            {getDisplayTitle(note)}
          </span>
          {noteTags.length > 0 && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: noteTags[0].color }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="typo-meta truncate flex-1 min-w-0">{preview}</span>
        </div>
      </div>

      {/* 右侧：时间 + 文件夹 */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="typo-meta">
          {formatTime(note.updatedAt)}
        </span>
        {folderName && (
          <span className="typo-meta" style={{ opacity: 0.5 }}>
            {folderName}
          </span>
        )}
      </div>
    </motion.button>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
