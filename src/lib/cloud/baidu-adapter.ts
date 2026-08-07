import type { CloudProvider, CloudAccount } from '../../types';

interface BaiduFileItem {
  filename: string;
  path: string;
  size: number;
  mtime: number;
  isdir: number;
}
import type { CloudAdapter, CloudCredentials, CloudFile } from './adapter';
import { startOAuth, handleOAuthCallback, refreshToken } from './oauth';

export class BaiduAdapter implements CloudAdapter {
  provider: CloudProvider = 'baidu';
  name = '百度网盘';
  icon = '🌐';
  color = '#06a7ff';

  async connect(creds: CloudCredentials): Promise<CloudAccount> {
    if (creds.accessToken) {
      return {
        id: `cloud-baidu-${Date.now()}`,
        provider: 'baidu',
        displayName: '百度网盘',
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        expiresAt: Date.now() + 3600000,
        isConnected: true,
        lastSyncAt: null,
        autoSync: false,
        syncInterval: 30,
        remotePath: '/MemoFlow/',
      };
    }
    // 启动 OAuth 流程
    await startOAuth('baidu');
    throw new Error('请在弹窗中完成授权');
  }

  async disconnect(account: CloudAccount): Promise<void> {}

  async upload(account: CloudAccount, path: string, data: Blob): Promise<string> {
    const form = new FormData();
    form.append('file', data, path.split('/').pop());
    const res = await fetch(`https://pan.baidu.com/rest/2.0/xpan/file?method=upload&access_token=${account.accessToken}&path=${encodeURIComponent(path)}`, {
      method: 'POST', body: form,
    });
    if (!res.ok) throw new Error(`上传失败: ${res.statusText}`);
    return path;
  }

  async download(account: CloudAccount, path: string): Promise<Blob> {
    const res = await fetch(`https://pan.baidu.com/rest/2.0/xpan/file?method=download&access_token=${account.accessToken}&path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`下载失败: ${res.statusText}`);
    return res.blob();
  }

  async listFiles(account: CloudAccount, path: string): Promise<CloudFile[]> {
    const res = await fetch(`https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token=${account.accessToken}&dir=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`列表获取失败: ${res.statusText}`);
    const data = await res.json();
    return (data.list || []).map((f: BaiduFileItem) => ({
      name: f.filename, path: f.path, size: f.size, modifiedAt: f.mtime * 1000, isFolder: f.isdir === 1,
    }));
  }

  async deleteFile(account: CloudAccount, path: string): Promise<void> {
    await fetch(`https://pan.baidu.com/rest/2.0/xpan/file?method=delete&access_token=${account.accessToken}&path=${encodeURIComponent(path)}`, { method: 'POST' });
  }

  async createFolder(account: CloudAccount, path: string): Promise<void> {
    await fetch(`https://pan.baidu.com/rest/2.0/xpan/file?method=create&access_token=${account.accessToken}&path=${encodeURIComponent(path)}`, { method: 'POST' });
  }
}
