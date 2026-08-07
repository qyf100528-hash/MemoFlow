/**
 * OAuth 2.0 服务 — 支持 PKCE 流程
 * 
 * 使用 OAuth 授权码 + PKCE 流程：
 * 1. 生成 code_verifier 和 code_challenge
 * 2. 打开 OAuth 授权页面
 * 3. 用户授权后通过回调获取授权码
 * 4. 交换授权码为 access_token + refresh_token
 */

// PKCE 工具
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

function base64URLEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 生成随机 state (防 CSRF)
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// 存储 OAuth 状态
interface OAuthState {
  verifier: string;
  state: string;
  provider: string;
  timestamp: number;
}

function saveOAuthState(provider: string, verifier: string, state: string): void {
  const oauthState: OAuthState = { verifier, state, provider, timestamp: Date.now() };
  sessionStorage.setItem(`oauth-state-${provider}`, JSON.stringify(oauthState));
}

function getOAuthState(provider: string): OAuthState | null {
  const stored = sessionStorage.getItem(`oauth-state-${provider}`);
  if (!stored) return null;
  const state: OAuthState = JSON.parse(stored);
  // 状态有效期 10 分钟
  if (Date.now() - state.timestamp > 600000) {
    sessionStorage.removeItem(`oauth-state-${provider}`);
    return null;
  }
  return state;
}

// OAuth 配置
interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  extraParams?: Record<string, string>;
}

// 提供商配置
const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  baidu: {
    authorizationUrl: 'https://openapi.baidu.com/oauth/2.0/authorize',
    tokenUrl: 'https://openapi.baidu.com/oauth/2.0/token',
    clientId: 'YOUR_BAIDU_CLIENT_ID', // 需要用户注册
    redirectUri: `${window.location.origin}/oauth/callback`,
    scopes: ['basic', 'netdisk'],
  },
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: 'YOUR_GOOGLE_CLIENT_ID',
    redirectUri: `${window.location.origin}/oauth/callback`,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  },
  quark: {
    authorizationUrl: 'https://drive-quark.quark.cn/oauth/authorize',
    tokenUrl: 'https://drive-quark.quark.cn/oauth/token',
    clientId: 'YOUR_QUARK_CLIENT_ID',
    redirectUri: `${window.location.origin}/oauth/callback`,
    scopes: ['user:info', 'file:read', 'file:write'],
  },
  onedrive: {
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: 'YOUR_ONEDRIVE_CLIENT_ID',
    redirectUri: `${window.location.origin}/oauth/callback`,
    scopes: ['files.readwrite', 'offline_access'],
  },
};

/**
 * 开始 OAuth 授权流程
 */
export async function startOAuth(provider: string): Promise<void> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) throw new Error(`不支持的提供商: ${provider}`);

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  saveOAuthState(provider, verifier, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    scope: config.scopes.join(' '),
    ...config.extraParams,
  });

  const authUrl = `${config.authorizationUrl}?${params.toString()}`;

  // 打开 OAuth 弹窗
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;
  window.open(
    authUrl,
    'oauth-popup',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

/**
 * 处理 OAuth 回调（从 URL 中提取授权码）
 */
export async function handleOAuthCallback(provider: string, url: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');
  const error = urlObj.searchParams.get('error');

  if (error) {
    throw new Error(`OAuth 错误: ${error}`);
  }

  if (!code || !state) return null;

  const savedState = getOAuthState(provider);
  if (!savedState || savedState.state !== state) {
    throw new Error('OAuth state 不匹配，可能遭受 CSRF 攻击');
  }

  // 清除状态
  sessionStorage.removeItem(`oauth-state-${provider}`);

  const config = OAUTH_CONFIGS[provider];
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: savedState.verifier,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`令牌交换失败: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * 刷新访问令牌
 */
export async function refreshToken(provider: string, refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) throw new Error(`不支持的提供商: ${provider}`);

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`令牌刷新失败: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}
