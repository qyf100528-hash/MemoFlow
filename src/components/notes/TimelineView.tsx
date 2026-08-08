import { motion } from 'framer-motion';
import { Pin, Lock, Paperclip, Calendar } from 'lucide-react';
import type { Note, Tag } from '../../types';
import { getDisplayTitle } from '../../lib/note-utils';

interface Props {
  notes: Note[];
  tags: Tag[];
  folderName?: (note: Note) => string | undefined;
  onNoteClick: (noteId: string) => void;
}

interface TimeGroup {
  label: string;
  icon: string;
  notes: Note[];
}

function groupNotesByTime(notes: Note[]): TimeGroup[] {
  const now = Date.now();
  const today: Note[] = [];
  const yesterday: Note[] = [];
  const thisWeek: Note[] = [];
  const thisMonth: Note[] = [];
  const older: Note[] = [];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 86400000;
  const weekMs = todayMs - 7 * 86400000;
  const monthMs = todayMs - 30 * 86400000;

  for (const note of notes) {
    const ts = note.updatedAt;
    if (ts >= todayMs) today.push(note);
    else if (ts >= yesterdayMs) yesterday.push(note);
    else if (ts >= weekMs) thisWeek.push(note);
    else if (ts >= monthMs) thisMonth.push(note);
    else older.push(note);
  }

  const groups: TimeGroup[] = [];
  if (today.length > 0) groups.push({ label: '今天', icon: '☀️', notes: today });
  if (yesterday.length > 0) groups.push({ label: '昨天', icon: '🌤️', notes: yesterday });
  if (thisWeek.length > 0) groups.push({ label: '本周', icon: '📅', notes: thisWeek });
  if (thisMonth.length > 0) groups.push({ label: '本月', icon: '🗓️', notes: thisMonth });
  if (older.length > 0) groups.push({ label: '更早', icon: '📦', notes: older });

  return groups;
}

export function TimelineView({ notes, tags, folderName, onNoteClick }: Props) {
  const groups = groupNotesByTime(notes);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
        <Calendar size={32} className="opacity-50" />
      </div>
    );
  }

  return (
    <div className="relative max-w-3xl mx-auto">
      {/* 时间线竖线 */}
      <div
        className="absolute left-[19px] top-2 bottom-2 w-0.5"
        style={{ background: 'linear-gradient(to bottom, var(--accent-mint), var(--accent-ocean), transparent)' }}
      />

      {groups.map((group, groupIdx) => (
        <div key={group.label} className="mb-8">
          {/* 时间分组标签 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: groupIdx * 0.1 }}
            className="flex items-center gap-3 mb-4 relative z-10"
          >
            <div
              className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-sm flex-shrink-0"
              style={{ borderColor: 'var(--accent-mint)' }}
            >
              {group.icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{group.label}</h3>
              <p className="text-xs text-[var(--text-secondary)]">{group.notes.length} 条笔记</p>
            </div>
          </motion.div>

          {/* 笔记列表 */}
          <div className="ml-13 pl-7 space-y-3">
            {group.notes.map((note, i) => {
              const noteTags = tags.filter(t => note.tagIds.includes(t.id));
              const preview = note.plainText || note.content.replace(/[#*`>\-|]/g, '').slice(0, 100);
              const fn = folderName?.(note);

              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIdx * 0.1 + i * 0.04 }}
                  whileHover={{ x: 4 }}
                  onClick={() => onNoteClick(note.id)}
                  className="glass-card p-4 cursor-pointer group relative"
                >
                  {/* 时间线节点 */}
                  <div
                    className="absolute left-[-27px] top-5 w-3 h-3 rounded-full border-2"
                    style={{
                      borderColor: 'var(--accent-mint)',
                      background: 'var(--bg-primary, #1a1a2e)',
                    }}
                  />

                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {note.isPinned && <Pin size={13} className="text-[var(--accent-mint)] fill-current" />}
                      {note.isLocked && <Lock size={13} className="text-[var(--accent-ocean)]" />}
                      {note.attachments.length > 0 && <Paperclip size={13} className="text-[var(--text-secondary)]" />}
                      <h4 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-mint)] transition-colors">
                        {getDisplayTitle(note)}
                      </h4>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] flex-shrink-0 ml-2">
                      {formatTime(note.updatedAt)}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2 leading-relaxed">
                    {preview}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {noteTags.slice(0, 3).map(t => (
                      <span
                        key={t.id}
                        className="px-1.5 py-0.5 rounded-full text-[10px]"
                        style={{ background: `${t.color}20`, color: t.color }}
                      >
                        {t.name}
                      </span>
                    ))}
                    {fn && (
                      <span className="text-[10px] text-[var(--text-secondary)] opacity-60">· {fn}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
