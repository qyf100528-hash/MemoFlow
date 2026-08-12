import JSZip from 'jszip';
import { db } from './db';
import type { Note, Folder, Tag, CloudAccount } from '../types';

const BACKUP_VERSION = 1;
const APP_NAME = 'MemoFlow';

/**
 * 触发浏览器下载给定 Blob 的辅助函数。
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 去除文件名中的非法字符，生成安全的文件名。
 */
function sanitizeFilename(name: string, fallback = '未命名'): string {
  const cleaned = (name || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 100);
  return cleaned || fallback;
}

/**
 * 解析纯文本笔记的 front-matter 形式的元数据，并返回正文 Markdown。
 * 已加密笔记会返回空内容并附带提示。
 */
function noteToMarkdown(note: Note, folders: Folder[], tags: Tag[]): string {
  const folder = folders.find(f => f.id === note.folderId);
  const noteTags = tags.filter(t => note.tagIds.includes(t.id));
  const lines: string[] = [];
  lines.push('---');
  lines.push(`id: ${note.id}`);
  lines.push(`title: ${JSON.stringify(note.title || '未命名')}`);
  lines.push(`createdAt: ${new Date(note.createdAt).toISOString()}`);
  lines.push(`updatedAt: ${new Date(note.updatedAt).toISOString()}`);
  if (folder) lines.push(`folder: ${JSON.stringify(folder.name)}`);
  if (noteTags.length > 0) lines.push(`tags: ${noteTags.map(t => JSON.stringify(t.name)).join(', ')}`);
  if (note.isPinned) lines.push('pinned: true');
  if (note.isLocked) lines.push('locked: true');
  lines.push('---');
  lines.push('');
  if (note.isLocked && note.isEncrypted) {
    lines.push('> ⚠️ 此笔记已加密，内容已省略。请在 MemoFlow 中解锁后重新导出。');
    lines.push('');
  } else {
    lines.push(note.content);
  }
  return lines.join('\n');
}

/**
 * 导出单个笔记为 Markdown 文件并下载。
 */
export async function exportNoteAsMarkdown(note: Note): Promise<void> {
  const folders = await db.folders.toArray();
  const tags = await db.tags.toArray();
  const md = noteToMarkdown(note, folders, tags);
  const filename = sanitizeFilename(note.title, '未命名') + '.md';
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * 批量导出多个笔记为 ZIP 压缩包。
 * 顶层 notes/ 目录下每个笔记一个 .md 文件；附件图片提取为 assets/。
 */
export async function exportNotesAsZip(notes: Note[]): Promise<void> {
  if (notes.length === 0) return;
  const folders = await db.folders.toArray();
  const tags = await db.tags.toArray();
  const zip = new JSZip();
  const notesDir = zip.folder('notes');
  const assetsDir = zip.folder('assets');

  const usedNames = new Set<string>();
  for (const note of notes) {
    let base = sanitizeFilename(note.title, '未命名');
    let name = base;
    let i = 1;
    while (usedNames.has(name)) {
      name = `${base}_${i++}`;
    }
    usedNames.add(name);

    const md = noteToMarkdown(note, folders, tags);
    notesDir!.file(`${name}.md`, md);

    // 附件图片提取到 assets/<attachmentId>.<ext>
    if (note.attachments && assetsDir) {
      for (const att of note.attachments) {
        if (att.type === 'image' && att.url?.startsWith('data:')) {
          const base64 = att.url.split(',')[1];
          if (base64) {
            const ext = att.mimeType.split('/')[1] || 'png';
            assetsDir.file(`${att.id}.${ext}`, base64, { base64: true });
          }
        }
      }
    }
  }

  zip.file(
    'README.txt',
    `MemoFlow 笔记导出\n导出时间: ${new Date().toLocaleString('zh-CN')}\n笔记数量: ${notes.length}\n\n目录结构:\n  notes/  笔记 Markdown 文件\n  assets/ 附件图片 (按 attachmentId 命名)\n`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `MemoFlow-批量导出-${formatDateForFilename(Date.now())}.zip`;
  downloadBlob(blob, filename);
}

/**
 * 导出整个数据库（笔记、文件夹、标签、附件元数据）为 JSON。
 * 包含版本号和导出时间，便于后续恢复时校验。
 */
export async function exportFullBackup(): Promise<void> {
  const [notes, folders, tags, accounts] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.tags.toArray(),
    db.cloudAccounts.toArray(),
  ]);
  const backup = {
    app: APP_NAME,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: { notes: notes.length, folders: folders.length, tags: tags.length, accounts: accounts.length },
    data: { notes, folders, tags, cloudAccounts: accounts },
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const filename = `MemoFlow-整库备份-${formatDateForFilename(Date.now())}.json`;
  downloadBlob(blob, filename);
}

/**
 * 从 JSON 备份恢复笔记、文件夹、标签到当前数据库。
 * 使用 put 保留 id，重复执行会覆盖同 id 数据。
 * 附件图片以 data URL 形式保留。
 */
export async function importFullBackup(file: File, options: { merge?: boolean } = {}): Promise<{ notes: number; folders: number; tags: number; accounts: number }> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('备份文件不是有效的 JSON');
  }
  if (parsed?.app !== APP_NAME) {
    throw new Error('备份文件不是 MemoFlow 格式');
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new Error(`备份版本 ${parsed.version} 不受支持`);
  }
  const { notes = [], folders = [], tags = [], cloudAccounts = [] } = parsed.data || {};

  if (!options.merge) {
    await Promise.all([
      db.notes.clear(),
      db.folders.clear(),
      db.tags.clear(),
      db.cloudAccounts.clear(),
    ]);
  }

  if (notes.length) await db.notes.bulkPut(notes);
  if (folders.length) await db.folders.bulkPut(folders);
  if (tags.length) await db.tags.bulkPut(tags);
  if (cloudAccounts.length) await db.cloudAccounts.bulkPut(cloudAccounts);

  return {
    notes: notes.length,
    folders: folders.length,
    tags: tags.length,
    accounts: cloudAccounts.length,
  };
}

function formatDateForFilename(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}