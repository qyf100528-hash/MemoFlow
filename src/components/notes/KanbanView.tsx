import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pin, Lock, Inbox, GripVertical } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { db } from '../../lib/db';
import { getDisplayTitle } from '../../lib/note-utils';
import type { Note, Folder, Tag } from '../../types';

interface Props {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  onNoteClick: (noteId: string) => void;
}

interface ColumnData {
  id: string;
  name: string;
  icon: string;
  color: string;
  notes: Note[];
  folderId: string | null;
}

/** 可拖拽的笔记卡片 */
function DraggableNote({
  note,
  tags,
  onNoteClick,
}: {
  note: Note;
  tags: Tag[];
  onNoteClick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: note.id,
  });

  const noteTags = tags.filter(t => note.tagIds.includes(t.id));
  const preview = note.plainText || note.content.replace(/[#*`>\-|]/g, '').slice(0, 80);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // 拖拽中不触发点击
        if (isDragging) return;
        onNoteClick(note.id);
      }}
      className={`glass-card p-3 cursor-pointer group relative ${
        isDragging ? 'opacity-30' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* 拖拽手柄 */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical size={12} className="text-[var(--text-secondary)]" />
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {note.isPinned && <Pin size={11} className="text-[var(--accent-mint)] fill-current" />}
          {note.isLocked && <Lock size={11} className="text-[var(--accent-ocean)]" />}
        </div>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {formatTime(note.updatedAt)}
        </span>
      </div>

      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1 line-clamp-1 group-hover:text-[var(--accent-mint)] transition-colors">
        {getDisplayTitle(note)}
      </h4>

      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2 leading-relaxed">
        {preview}
      </p>

      {noteTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {noteTags.slice(0, 2).map(t => (
            <span
              key={t.id}
              className="px-1.5 py-0.5 rounded-full text-[10px]"
              style={{ background: `${t.color}20`, color: t.color }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 可放置的列 */
function DroppableColumn({
  column,
  children,
}: {
  column: ColumnData;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      {/* 列头 */}
      <div className="glass-card px-4 py-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{column.icon}</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{column.name}</span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: `${column.color}20`, color: column.color }}
        >
          {column.notes.length}
        </span>
      </div>

      {/* 卡片列表 */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] rounded-xl transition-colors ${
          isOver ? 'bg-[var(--accent-mint)]/5 border border-[var(--accent-mint)]/30 border-dashed' : ''
        }`}
        style={{ minHeight: '80px' }}
      >
        {children}
      </div>
    </div>
  );
}

export function KanbanView({ notes, folders, tags, onNoteClick }: Props) {
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // 构建列数据
  const columns: ColumnData[] = [];

  const pinnedNotes = notes.filter(n => n.isPinned);
  if (pinnedNotes.length > 0) {
    columns.push({
      id: 'pinned',
      name: '置顶',
      icon: '⭐',
      color: '#fbbf24',
      notes: pinnedNotes,
      folderId: '__pinned__',
    });
  }

  for (const folder of folders) {
    const folderNotes = notes.filter(n => n.folderId === folder.id && !n.isPinned);
    if (folderNotes.length > 0) {
      columns.push({
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        notes: folderNotes,
        folderId: folder.id,
      });
    }
  }

  const unfiledNotes = notes.filter(n => !n.folderId && !n.isPinned);
  if (unfiledNotes.length > 0) {
    columns.push({
      id: 'unfiled',
      name: '未分类',
      icon: '📥',
      color: '#94a3b8',
      notes: unfiledNotes,
      folderId: null,
    });
  }

  // 确保空列也显示（当所有笔记都在置顶时仍显示文件夹列）
  if (columns.length === 0 && folders.length > 0) {
    for (const folder of folders) {
      columns.push({
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        notes: [],
        folderId: folder.id,
      });
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const note = notes.find(n => n.id === event.active.id);
    setActiveNote(note || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveNote(null);

    const { active, over } = event;
    if (!over) return;

    const noteId = active.id as string;
    const targetColumnId = over.id as string;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // 确定目标文件夹 ID
    let targetFolderId: string | null;
    if (targetColumnId === 'pinned') {
      // 拖到置顶列：设为置顶
      if (!note.isPinned) {
        await db.notes.update(noteId, { isPinned: true });
      }
      return;
    } else if (targetColumnId === 'unfiled') {
      targetFolderId = null;
    } else {
      const match = columns.find(c => c.id === targetColumnId);
      targetFolderId = match?.folderId ?? null;
    }

    // 更新笔记的文件夹和取消置顶（如果移出置顶列）
    const updates: Partial<Note> = { folderId: targetFolderId };
    if (note.isPinned && targetColumnId !== 'pinned') {
      updates.isPinned = false;
    }

    await db.notes.update(noteId, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
        <Inbox size={32} className="opacity-50" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col, colIdx) => (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: colIdx * 0.08 }}
          >
            <DroppableColumn column={col}>
              {col.notes.map((note, i) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: colIdx * 0.08 + i * 0.03 }}
                >
                  <DraggableNote note={note} tags={tags} onNoteClick={onNoteClick} />
                </motion.div>
              ))}
              {col.notes.length === 0 && (
                <div className="text-center py-8 text-xs text-[var(--text-secondary)] opacity-50">
                  拖拽笔记到此处
                </div>
              )}
            </DroppableColumn>
          </motion.div>
        ))}
      </div>

      {/* 拖拽预览 */}
      <DragOverlay>
        {activeNote ? (
          <div className="glass-strong rounded-xl p-3 w-72 opacity-90 rotate-3">
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1 line-clamp-1">
              {getDisplayTitle(activeNote)}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
              {activeNote.plainText || '...'}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
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