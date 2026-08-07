import { Pin, Lock, Paperclip } from 'lucide-react';
import type { Note, Tag } from '../../types';

interface NoteListItemProps {
  note: Note;
  tags: Tag[];
  folderName?: string;
  onClick: () => void;
}

export function NoteListItem({ note, tags, folderName, onClick }: NoteListItemProps) {
  const noteTags = tags.filter(t => note.tagIds.includes(t.id));
  const preview = note.plainText || note.content.replace(/[#*`>\-|]/g, '').slice(0, 80);

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
      style={{ borderBottom: '1px solid var(--glass-border)' }}
    >
      {/* 左侧图标区域 */}
      <div className="flex items-center gap-1 shrink-0 w-6">
        {note.isPinned && <Pin size={12} className="text-[var(--accent-mint)] fill-current" />}
        {note.isLocked && <Lock size={12} className="text-[var(--accent-ocean)]" />}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="typo-note-title truncate">
            {note.title || '无标题'}
          </span>
          {noteTags.length > 0 && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: noteTags[0].color }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="typo-meta truncate">{preview}</span>
          <span className="typo-meta shrink-0">
            {formatTime(note.updatedAt)}
          </span>
          {folderName && (
            <span className="typo-meta shrink-0" style={{ opacity: 0.5 }}>
              · {folderName}
            </span>
          )}
        </div>
      </div>
    </button>
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