import type { CloudProvider, CloudAccount } from '../../types';

interface OneDriveFileItem {
  name: string;
  id: string;
  path: string;
  size: number;
  lastModifiedDateTime: string;
  folder?: Record<string, unknown>;
}
import type { CloudAdapter, CloudCredentials, CloudFile } from './adapter';
import { startOAuth } from './oauth';

export class OneDriveAdapter implements CloudAdapter {
  provider: CloudProvider = 'onedrive';
  name = 'OneDrive';
  icon = '☁️';
  color = '#0078d4';

  async connect(creds: CloudCredentials): Promise<CloudAccount> {
    if (creds.accessToken) {
      return {
        id: `cloud-onedrive-${Date.now()}`,
        provider: 'onedrive',
        displayName: 'OneDrive',
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        expiresAt: Date.now() + 3600000,
        isConnected: true,
        lastSyncAt: null,
        autoSync: false,
        syncInterval: 30,
        remotePath: '/MemoFlow',
        sortOrder: Date.now(),
      };
    }
    await startOAuth('onedrive');
    throw new Error('请在弹窗中完成授权');
  }

  async disconnect(account: CloudAccount): Promise<void> {}

  async upload(account: CloudAccount, path: string, data: Blob): Promise<string> {
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(path)}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${account.accessToken}` },
      body: data,
    });
    if (!res.ok) throw new Error(`上传失败: ${res.statusText}`);
    const file = await res.json();
    return file.id || path;
  }

  async download(account: CloudAccount, path: string): Promise<Blob> {
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${path}/content`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    if (!res.ok) throw new Error(`下载失败: ${res.statusText}`);
    return res.blob();
  }

  async listFiles(account: CloudAccount, path: string): Promise<CloudFile[]> {
    const url = path ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(path)}:/children` : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${account.accessToken}` } });
    if (!res.ok) throw new Error(`列表获取失败`);
    const data = await res.json();
    return (data.value || []).map((f: OneDriveFileItem) => ({
      name: f.name, path: f.id, size: f.size || 0, modifiedAt: new Date(f.lastModifiedDateTime).getTime(), isFolder: !!f.folder,
    }));
  }

  async deleteFile(account: CloudAccount, path: string): Promise<void> {
    await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
  }

  async createFolder(account: CloudAccount, path: string): Promise<void> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: path, folder: {} }),
    });
    if (!res.ok) throw new Error(`创建文件夹失败`);
  }
}
