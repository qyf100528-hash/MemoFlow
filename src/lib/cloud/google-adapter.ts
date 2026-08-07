import type { CloudProvider, CloudAccount } from '../../types';

interface GoogleDriveFileItem {
  name: string;
  id: string;
  size?: string;
  modifiedTime?: string;
  mimeType: string;
}
import type { CloudAdapter, CloudCredentials, CloudFile } from './adapter';
import { startOAuth } from './oauth';

export class GoogleAdapter implements CloudAdapter {
  provider: CloudProvider = 'google';
  name = 'Google Drive';
  icon = '📁';
  color = '#4285f4';

  async connect(creds: CloudCredentials): Promise<CloudAccount> {
    if (creds.accessToken) {
      return {
        id: `cloud-google-${Date.now()}`,
        provider: 'google',
        displayName: 'Google Drive',
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        expiresAt: Date.now() + 3600000,
        isConnected: true,
        lastSyncAt: null,
        autoSync: false,
        syncInterval: 30,
        remotePath: 'MemoFlow',
        sortOrder: Date.now(),
      };
    }
    await startOAuth('google');
    throw new Error('请在弹窗中完成授权');
  }

  async disconnect(account: CloudAccount): Promise<void> {}

  async upload(account: CloudAccount, path: string, data: Blob): Promise<string> {
    const metadata = { name: path.split('/').pop(), parents: ['root'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', data);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}` },
      body: form,
    });
    if (!res.ok) throw new Error(`上传失败: ${res.statusText}`);
    const file = await res.json();
    return file.id || path;
  }

  async download(account: CloudAccount, path: string): Promise<Blob> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${path}?alt=media`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    if (!res.ok) throw new Error(`下载失败: ${res.statusText}`);
    return res.blob();
  }

  async listFiles(account: CloudAccount, path: string): Promise<CloudFile[]> {
    const query = `'${path || 'root'}' in parents and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime,mimeType)`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    if (!res.ok) throw new Error(`列表获取失败: ${res.statusText}`);
    const data = await res.json();
    return (data.files || []).map((f: GoogleDriveFileItem) => ({
      name: f.name, path: f.id, size: f.size || 0, modifiedAt: f.modifiedTime ? new Date(f.modifiedTime).getTime() : 0, isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    }));
  }

  async deleteFile(account: CloudAccount, path: string): Promise<void> {
    await fetch(`https://www.googleapis.com/drive/v3/files/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
  }

  async createFolder(account: CloudAccount, path: string): Promise<void> {
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: path, mimeType: 'application/vnd.google-apps.folder', parents: ['root'] }),
    });
    if (!res.ok) throw new Error(`创建文件夹失败: ${res.statusText}`);
  }
}
