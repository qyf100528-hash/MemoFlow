import type { CloudProvider, CloudAccount, Note, ExportFormat } from '../../types';
import { BaiduAdapter } from './baidu-adapter';
import { GoogleAdapter } from './google-adapter';
import { QuarkAdapter } from './quark-adapter';
import { OneDriveAdapter } from './onedrive-adapter';
import { withRefresh } from './token-manager';
import { enqueueRetry } from './sync-queue';

export interface CloudAdapter {
  provider: CloudProvider;
  name: string;
  icon: string;
  color: string;
  connect: (credentials: CloudCredentials) => Promise<CloudAccount>;
  disconnect: (account: CloudAccount) => Promise<void>;
  upload: (account: CloudAccount, path: string, data: Blob) => Promise<string>;
  download: (account: CloudAccount, path: string) => Promise<Blob>;
  listFiles: (account: CloudAccount, path: string) => Promise<CloudFile[]>;
  deleteFile: (account: CloudAccount, path: string) => Promise<void>;
  createFolder: (account: CloudAccount, path: string) => Promise<void>;
}

export interface CloudCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface CloudFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: number;
  isFolder: boolean;
}

// 网盘元数据
export const cloudProviders: Record<CloudProvider, { name: string; icon: string; color: string; desc: string }> = {
  baidu: { name: '百度网盘', icon: '🌐', color: '#06a7ff', desc: '国内主流网盘，大容量存储' },
  google: { name: 'Google Drive', icon: '📁', color: '#4285f4', desc: 'Google 生态云存储' },
  quark: { name: '夸克网盘', icon: '⚡', color: '#7c3aed', desc: '年轻用户群体网盘' },
  onedrive: { name: 'OneDrive', icon: '☁️', color: '#0078d4', desc: '微软生态云存储' },
};

// 创建一个带 Token 自动刷新的代理适配器
function createRefreshAwareAdapter(adapter: CloudAdapter): CloudAdapter {
  const proxy: CloudAdapter = {
    ...adapter,
    connect: (creds) => adapter.connect(creds),
    disconnect: (account) => adapter.disconnect(account),
    upload: async (account, path, data) => {
      const { result } = await withRefresh(account, (acc) => adapter.upload(acc, path, data));
      return result;
    },
    download: async (account, path) => {
      const { result } = await withRefresh(account, (acc) => adapter.download(acc, path));
      return result;
    },
    listFiles: async (account, path) => {
      const { result } = await withRefresh(account, (acc) => adapter.listFiles(acc, path));
      return result;
    },
    deleteFile: async (account, path) => {
      await withRefresh(account, (acc) => adapter.deleteFile(acc, path));
    },
    createFolder: async (account, path) => {
      await withRefresh(account, (acc) => adapter.createFolder(acc, path));
    },
  };
  return proxy;
}

// 获取真实适配器（自动包装 Token 刷新）
export function getAdapter(provider: CloudProvider): CloudAdapter {
  let adapter: CloudAdapter;
  switch (provider) {
    case 'baidu': adapter = new BaiduAdapter(); break;
    case 'google': adapter = new GoogleAdapter(); break;
    case 'quark': adapter = new QuarkAdapter(); break;
    case 'onedrive': adapter = new OneDriveAdapter(); break;
    default: throw new Error(`不支持的提供商: ${provider}`);
  }
  return createRefreshAwareAdapter(adapter);
}

// 批量同步：失败项自动进入重试队列
export async function syncAllNotes(account: CloudAccount, notes: Note[]): Promise<{ success: number; failed: number }> {
  const adapter = getAdapter(account.provider);
  let success = 0;
  let failed = 0;
  for (const note of notes) {
    const data = formatNoteForExport(note, 'json');
    const path = `notes/${note.id}.json`;
    try {
      await adapter.upload(account, path, data);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Sync] 笔记同步失败，已入队待重试: ${note.title}`, err);
      // 将失败项入队，等待指数退避重试
      await enqueueRetry(account, 'update', path, await data.text(), note.id, msg);
      failed++;
    }
  }
  return { success, failed };
}

// 格式化笔记用于导出
export function formatNoteForExport(note: Note, format: ExportFormat): Blob {
  switch (format) {
    case 'markdown':
      return new Blob([`# ${note.title}\n\n${note.content}`], { type: 'text/markdown' });
    case 'json':
      return new Blob([JSON.stringify(note, null, 2)], { type: 'application/json' });
    case 'html':
      return new Blob([`<html><body><h1>${note.title}</h1>${note.content}</body></html>`], { type: 'text/html' });
    case 'pdf':
    case 'word':
      return new Blob([note.content], { type: 'application/octet-stream' });
    default:
      return new Blob([note.content], { type: 'text/plain' });
  }
}
