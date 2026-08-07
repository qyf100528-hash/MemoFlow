/**
 * 双向链接解析器
 *
 * 支持 [[笔记名]] 语法，类似 Obsidian/Roam
 */

import { db } from '../db';
import type { Note } from '../../types';

export interface NoteLink {
  target: string;
  raw: string;
  resolved: boolean;
  noteId?: string;
}

/**
 * 从文本中提取所有 [[链接]]
 */
export function extractLinks(text: string): NoteLink[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: NoteLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    links.push({
      target: match[1].trim(),
      raw: match[0],
      resolved: false,
    });
  }

  return links;
}

/**
 * 解析链接，匹配笔记数据库中的笔记
 */
export async function resolveLinks(text: string): Promise<NoteLink[]> {
  const links = extractLinks(text);
  if (links.length === 0) return [];

  const allNotes = await db.notes.toArray();

  for (const link of links) {
    // 精确匹配标题
    const exact = allNotes.find(n => n.title === link.target);
    if (exact) {
      link.resolved = true;
      link.noteId = exact.id;
      continue;
    }

    // 模糊匹配（不区分大小写）
    const lowerTarget = link.target.toLowerCase();
    const fuzzy = allNotes.find(n =>
      n.title.toLowerCase() === lowerTarget ||
      n.title.toLowerCase().includes(lowerTarget) ||
      lowerTarget.includes(n.title.toLowerCase())
    );
    if (fuzzy) {
      link.resolved = true;
      link.noteId = fuzzy.id;
    }
  }

  return links;
}

/**
 * 查找引用了指定笔记的所有反向链接
 */
export async function findBacklinks(noteId: string): Promise<Note[]> {
  const allNotes = await db.notes.toArray();
  const targetNote = allNotes.find(n => n.id === noteId);
  if (!targetNote || !targetNote.title) return [];

  const linkPattern = `[[${targetNote.title}]]`;
  const lowerPattern = linkPattern.toLowerCase();

  return allNotes.filter(n =>
    n.id !== noteId &&
    (n.content.includes(linkPattern) ||
     n.content.toLowerCase().includes(lowerPattern))
  );
}

/**
 * 将 [[笔记名]] 链接渲染为可点击的 HTML
 */
export function renderLinksAsHtml(content: string, links: NoteLink[]): string {
  let rendered = content;

  for (const link of links) {
    const escapedTarget = link.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\[\\[${escapedTarget}\\]\\]`, 'g');

    if (link.resolved && link.noteId) {
      rendered = rendered.replace(
        regex,
        `<a class="note-link" data-note-id="${link.noteId}" href="#note-${link.noteId}">${link.target}</a>`
      );
    } else {
      rendered = rendered.replace(
        regex,
        `<span class="note-link-unresolved">${link.target}</span>`
      );
    }
  }

  return rendered;
}

/**
 * 获取笔记的链接建议（输入 [[ 时弹出）
 */
export async function getLinkSuggestions(query: string, excludeId?: string): Promise<Note[]> {
  const allNotes = await db.notes.toArray();
  let result = allNotes.filter(n => !n.isArchived);

  if (excludeId) {
    result = result.filter(n => n.id !== excludeId);
  }

  if (query) {
    const q = query.toLowerCase();
    result = result.filter(n =>
      n.title.toLowerCase().includes(q) || n.plainText.toLowerCase().includes(q)
    );
  }

  return result.slice(0, 10);
}
