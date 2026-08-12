import { motion } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Pin, Lock, Paperclip, CheckSquare, Square } from 'lucide-react';
import type { Note, Tag } from '../../types';
import { getDisplayTitle } from '../../lib/note-utils';

interface NoteCardProps {
  note: Note;
  tags: Tag[];
  folderName?: string;
  onClick: () => void;
  index?: number;
  selectMode?: boolean;
  selected?: boolean;
}

export function NoteCard({ note, tags, folderName, onClick, index = 0, selectMode, selected }: NoteCardProps) {
  const noteTags = tags.filter(t => note.tagIds.includes(t.id));
  const rawPreview = note.plainText || note.content.replace(/[#*`>\-|]/g, '').trim();
  // 空内容时显示文件夹名或占位文字
  const preview = rawPreview || (folderName ? folderName : '无内容');
  const title = getDisplayTitle(note);

  // 动态对齐：短标题居中，长标题（接近溢出）左对齐
  const titleRef = useRef<HTMLDivElement>(null);
  const [align, setAlign] = useState<'center' | 'left'>('center');

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    // 比较 scrollWidth 和 clientWidth，溢出则左对齐
    const checkOverflow = () => {
      if (el.scrollWidth > el.clientWidth + 1) {
        setAlign('left');
      } else {
        setAlign('center');
      }
    };
    checkOverflow();
    // 监听容器尺寸变化
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      className={`cursor-pointer group flex flex-col ${selected ? 'note-grid-card-selected' : ''}`}
    >
      {/* 预览卡片 — 内部只显示内容 */}
      <div className="note-grid-card-inner relative">
        {/* 多选状态角标 */}
        {selectMode && (
          <div className="absolute top-1.5 right-1.5 z-10">
            {selected ? <CheckSquare size={16} className="text-[var(--accent-mint)] fill-current" /> : <Square size={16} className="text-[var(--text-secondary)]" />}
          </div>
        )}
        {/* 顶部状态图标 — 极淡 */}
        <div className="flex items-center gap-1 mb-1.5 opacity-60">
          {note.isPinned && <Pin size={10} className="text-[var(--accent-mint)] fill-current shrink-0" />}
          {note.isLocked && <Lock size={10} className="text-[var(--accent-ocean)] shrink-0" />}
          {note.attachments.length > 0 && <Paperclip size={10} className="text-[var(--text-secondary)] shrink-0" />}
          {noteTags.slice(0, 1).map((t) => (
            <span key={t.id} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
          ))}
        </div>

        {/* 内容预览 — 占满剩余空间 */}
        <p className="text-xs text-[var(--text-secondary)] leading-[1.55] flex-1 overflow-hidden">
          {preview}
        </p>
      </div>

      {/* 卡片外部标题区 — Apple Notes 风格 */}
      <div className="mt-1.5 px-0.5">
        {/* 标题 — 动态对齐，单行省略 */}
        <div
          ref={titleRef}
          className="text-xs font-semibold text-[var(--text-primary)] truncate leading-tight group-hover:text-[var(--accent-mint)] transition-colors"
          style={{ textAlign: align }}
        >
          {title}
        </div>
        {/* 时间 — 小灰字 */}
        <div
          className="typo-caption mt-0.5 leading-tight"
          style={{ textAlign: align }}
        >
          {formatTime(note.updatedAt)}{folderName ? ` · ${folderName}` : ''}
        </div>
      </div>
    </motion.div>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
