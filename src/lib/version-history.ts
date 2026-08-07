import { db } from './db';
import type { Note, NoteVersion } from '../types';

/**
 * 保存笔记版本快照（在每次保存时调用）
 */
export async function saveVersionSnapshot(note: Note): Promise<void> {
  // 跳过空内容笔记
  if (!note.content && !note.title) return;

  // 获取最新的版本号
  const lastVersion = await db.noteVersions
    .where('noteId')
    .equals(note.id)
    .last();

  const version = (lastVersion?.version || 0) + 1;

  // 检查内容是否有变化
  if (lastVersion && lastVersion.content === note.content && lastVersion.title === note.title) {
    return; // 无变化，不保存版本
  }

  const newVersion: NoteVersion = {
    id: `ver-${note.id}-${Date.now()}`,
    noteId: note.id,
    title: note.title,
    content: note.content,
    plainText: note.plainText,
    createdAt: Date.now(),
    version,
  };

  await db.noteVersions.add(newVersion);

  // 保留最近 50 个版本，清理旧的
  const count = await db.noteVersions.where('noteId').equals(note.id).count();
  if (count > 50) {
    const oldVersions = await db.noteVersions
      .where('noteId')
      .equals(note.id)
      .sortBy('version');
    const toDelete = oldVersions.slice(0, count - 50);
    await db.noteVersions.bulkDelete(toDelete.map(v => v.id));
  }
}

/**
 * 获取笔记的所有版本
 */
export async function getNoteVersions(noteId: string): Promise<NoteVersion[]> {
  return db.noteVersions
    .where('noteId')
    .equals(noteId)
    .reverse()
    .sortBy('version');
}

/**
 * 回滚到指定版本
 */
export async function rollbackToVersion(versionId: string): Promise<NoteVersion | null> {
  const version = await db.noteVersions.get(versionId);
  if (!version) return null;

  const note = await db.notes.get(version.noteId);
  if (!note) return null;

  // 将当前版本保存为快照
  await saveVersionSnapshot(note);

  // 回滚笔记内容
  note.title = version.title;
  note.content = version.content;
  note.plainText = version.plainText;
  note.updatedAt = Date.now();
  await db.notes.put(note);

  return version;
}
