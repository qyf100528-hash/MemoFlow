import { motion } from 'framer-motion';
import { Pin, Lock, CheckSquare, Square } from 'lucide-react';
import type { Note, Tag } from '../../types';
import { getDisplayTitle } from '../../lib/note-utils';
import { HighlightText } from '../HighlightText';
import { useStore } from '../../store/useStore';

interface NoteListItemProps {
  note: Note;
  tags: Tag[];
  folderName?: string;
  onClick: () => void;
  selectMode?: boolean;
  selected?: boolean;
}

export function NoteListItem({ note, tags, folderName, onClick, selectMode, selected }: NoteListItemProps) {
  const { searchQuery } = useStore();
  const noteTags = tags.filter(t => note.tagIds.includes(t.id));
  const rawPreview = note.plainText || note.content.replace(/[#*`>\-|]/g, '').trim();
  // 空内容时显示文件夹名或占位文字，保证列表项不为空
  const preview = rawPreview || (folderName ? `${folderName}` : '无内容');

  // 计算预览中匹配关键词的子串
  const matchedSnippet = searchQuery.trim() && preview
    ? getMatchedSnippet(preview, searchQuery.trim(), 80)
    : preview;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`ios-pill-note w-full text-left flex items-center gap-3 px-4 py-2.5 ${selected ? 'ring-1 ring-[var(--accent-mint)] bg-[var(--accent-mint)]/5' : ''}`}
    >
      {/* 左侧：多选框 / 置顶锁定标记 */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-5">
        {selectMode ? (
          selected ? <CheckSquare size={16} className="text-[var(--accent-mint)] fill-current" /> : <Square size={16} className="text-[var(--text-secondary)]" />
        ) : (
          <>
            {note.isPinned && <Pin size={13} className="text-[var(--accent-mint)] fill-current" />}
            {note.isLocked && <Lock size={13} className="text-[var(--accent-ocean)]" />}
          </>
        )}
      </div>

      {/* 中间：标题 + 摘要 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="typo-note-title truncate">
            <HighlightText text={getDisplayTitle(note)} query={searchQuery} />
          </span>
          {noteTags.length > 0 && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: noteTags[0].color }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="typo-meta truncate flex-1 min-w-0">
            <HighlightText text={matchedSnippet} query={searchQuery} />
          </span>
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

/**
 * 返回包含首个匹配项的子串片段，便于在列表中突出展示匹配上下文。
 * 例如 "...这是我的**笔记**内容..." 截取关键词前后约 halfLen 字符。
 */
function getMatchedSnippet(text: string, query: string, maxLen: number): string {
  if (!query || !text) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '');
  const halfLen = Math.floor((maxLen - query.length) / 2);
  const start = Math.max(0, idx - halfLen);
  const end = Math.min(text.length, idx + query.length + halfLen);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return prefix + text.slice(start, end) + suffix;
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
