/**
 * 笔记模板管理
 */

import { db } from './db';
import type { NoteTemplate } from '../types';

/**
 * 替换模板中的变量占位符
 * {{date}} → 当前日期 YYYY-MM-DD
 * {{time}} → 当前时间 HH:MM
 */
export function fillTemplateVariables(content: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return content
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time);
}

/**
 * 获取所有模板
 */
export async function getAllTemplates(): Promise<NoteTemplate[]> {
  return db.templates.orderBy('createdAt').toArray();
}

/**
 * 根据分类获取模板
 */
export async function getTemplatesByCategory(category: NoteTemplate['category']): Promise<NoteTemplate[]> {
  return db.templates.where('category').equals(category).toArray();
}

/**
 * 创建自定义模板
 */
export async function createTemplate(data: Omit<NoteTemplate, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = Date.now();
  const id = `tpl-${now}`;
  await db.templates.add({
    ...data,
    id,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * 更新模板
 */
export async function updateTemplate(id: string, data: Partial<NoteTemplate>): Promise<void> {
  await db.templates.update(id, { ...data, updatedAt: Date.now() });
}

/**
 * 删除模板（内置模板不可删除）
 */
export async function deleteTemplate(id: string): Promise<void> {
  const tpl = await db.templates.get(id);
  if (tpl?.isBuiltIn) throw new Error('内置模板不可删除');
  await db.templates.delete(id);
}

/**
 * 从笔记创建模板
 */
export async function createTemplateFromNote(noteId: string, name: string, icon: string, description: string): Promise<string> {
  const note = await db.notes.get(noteId);
  if (!note) throw new Error('笔记不存在');
  return createTemplate({
    name,
    icon,
    description,
    content: note.content,
    category: 'custom',
  });
}
