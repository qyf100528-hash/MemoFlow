import type { Note } from '../types';

// 提取显示标题：有标题用标题，无标题取内容首行（最多20字），都为空时显示"新建笔记"
export function getDisplayTitle(note: Note): string {
  if (note.title && note.title.trim()) return note.title.trim();
  const text = (note.plainText || note.content || '').trim();
  if (!text) return '新建笔记';
  // 取第一行非空文字
  const firstLine = text.split('\n').find(l => l.trim()) || '';
  const clean = firstLine.replace(/[#*`>\-|_\[\]()]/g, '').trim();
  if (!clean) return '新建笔记';
  return clean.slice(0, 20) || text.slice(0, 20);
}
