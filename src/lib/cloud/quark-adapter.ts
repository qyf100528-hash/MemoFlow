import type { CloudProvider, CloudAccount } from '../../types';

interface QuarkFileItem {
  file_name: string;
  file_path: string;
  dir_path: string;
  size: number;
  update_time: number;
  dir: boolean;
}
import type { CloudAdapter, CloudCredentials, CloudFile } from './adapter';
import { startOAuth } from './oauth';

export class QuarkAdapter implements CloudAdapter {
  provider: CloudProvider = 'quark';
  name = '夸克网盘';
  icon = '⚡';
  color = '#7c3aed';

  async connect(creds: CloudCredentials): Promise<CloudAccount> {
    if (creds.accessToken) {
      return {
        id: `cloud-quark-${Date.now()}`,
        provider: 'quark',
        displayName: '夸克网盘',
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        expiresAt: Date.now() + 3600000,
        isConnected: true,
        lastSyncAt: null,
        autoSync: false,
        syncInterval: 30,
        remotePath: '/MemoFlow/',
        sortOrder: Date.now(),
      };
    }
    await startOAuth('quark');
    throw new Error('请在弹窗中完成授权');
  }

  async disconnect(account: CloudAccount): Promise<void> {}

  async upload(account: CloudAccount, path: string, data: Blob): Promise<string> {
    const form = new FormData();
    form.append('file', data, path.split('/').pop());
    const res = await fetch(`https://drive-quark.quark.cn/1/files/upload?access_token=${account.accessToken}&dir_path=${encodeURIComponent(path.substring(0, path.lastIndexOf('/')))}`, {
      method: 'POST', body: form,
    });
    if (!res.ok) throw new Error(`上传失败`);
    return path;
  }

  async download(account: CloudAccount, path: string): Promise<Blob> {
    const res = await fetch(`https://drive-quark.quark.cn/1/files/download?access_token=${account.accessToken}&file_path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`下载失败`);
    return res.blob();
  }

  async listFiles(account: CloudAccount, path: string): Promise<CloudFile[]> {
    const res = await fetch(`https://drive-quark.quark.cn/1/files?access_token=${account.accessToken}&dir=${encodeURIComponent(path)}&page=1&size=50`);
    if (!res.ok) throw new Error(`列表获取失败`);
    const data = await res.json();
    return (data.list || []).map((f: QuarkFileItem) => ({
      name: f.file_name, path: f.file_path, size: f.size || 0, modifiedAt: f.update_time * 1000, isFolder: f.dir === true,
    }));
  }

  async deleteFile(account: CloudAccount, path: string): Promise<void> {
    await fetch(`https://drive-quark.quark.cn/1/files/delete?access_token=${account.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_paths: [path] }),
    });
  }

  async createFolder(account: CloudAccount, path: string): Promise<void> {
    await fetch(`https://drive-quark.quark.cn/1/files/create?access_token=${account.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir_path: path }),
    });
  }
}
