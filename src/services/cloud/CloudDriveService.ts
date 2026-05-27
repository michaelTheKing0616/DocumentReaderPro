import * as FileSystem from 'expo-file-system';
import { logger } from '../logger/Logger';
import SecureTokenStore from '../security/SecureTokenStore';

export type CloudProvider = 'google' | 'dropbox' | 'onedrive';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface CloudFileMeta {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  modifiedAt?: string;
}

const TOKEN_KEY_PREFIX = 'cloud_drive_';

function readOAuthClientId(provider: CloudProvider): string | undefined {
  switch (provider) {
    case 'google':
      return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
    case 'dropbox':
      return process.env.EXPO_PUBLIC_DROPBOX_CLIENT_ID;
    case 'onedrive':
      return process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID;
    default:
      return undefined;
  }
}

function readOAuthClientSecret(provider: CloudProvider): string | undefined {
  switch (provider) {
    case 'google':
      return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_SECRET;
    case 'dropbox':
      return process.env.EXPO_PUBLIC_DROPBOX_CLIENT_SECRET;
    case 'onedrive':
      return process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_SECRET;
    default:
      return undefined;
  }
}

const OAUTH_CONFIG: Record<
  CloudProvider,
  { authUrl: string; tokenUrl: string; scopes: string[] }
> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  },
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scopes: ['files.metadata.read'],
  },
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Files.Read'],
  },
};

class CloudDriveService {
  private tokens: Partial<Record<CloudProvider, OAuthTokens>> = {};

  async loadStoredTokens(provider: CloudProvider): Promise<void> {
    const raw = await SecureTokenStore.getToken(`${TOKEN_KEY_PREFIX}${provider}`);
    if (raw) {
      try {
        this.tokens[provider] = JSON.parse(raw) as OAuthTokens;
      } catch {
        logger.warn('Invalid stored cloud tokens', { provider });
      }
    }
  }

  private async persistTokens(provider: CloudProvider, tokens: OAuthTokens): Promise<void> {
    this.tokens[provider] = tokens;
    await SecureTokenStore.setToken(`${TOKEN_KEY_PREFIX}${provider}`, JSON.stringify(tokens));
  }

  getAuthorizationUrl(provider: CloudProvider, redirectUri: string): string {
    const cfg = OAUTH_CONFIG[provider];
    const clientId = readOAuthClientId(provider);
    if (!clientId) {
      logger.warn('Cloud OAuth client ID not configured', { provider });
    }
    const params = new URLSearchParams({
      client_id: clientId ?? 'CONFIGURE_CLIENT_ID',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: cfg.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${cfg.authUrl}?${params.toString()}`;
  }

  async exchangeCode(
    provider: CloudProvider,
    code: string,
    redirectUri: string
  ): Promise<OAuthTokens> {
    const cfg = OAUTH_CONFIG[provider];
    const clientId = readOAuthClientId(provider);
    const clientSecret = readOAuthClientSecret(provider);

    const body = new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      client_id: clientId ?? '',
    });
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const response = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth token exchange failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
    await this.persistTokens(provider, tokens);
    logger.info('Cloud OAuth tokens stored', { provider });
    return tokens;
  }

  setTokens(provider: CloudProvider, tokens: OAuthTokens): void {
    void this.persistTokens(provider, tokens);
  }

  getTokens(provider: CloudProvider): OAuthTokens | undefined {
    return this.tokens[provider];
  }

  isConnected(provider: CloudProvider): boolean {
    const t = this.tokens[provider];
    if (!t) return false;
    if (t.expiresAt && t.expiresAt < Date.now()) return false;
    return Boolean(t.accessToken);
  }

  async listFiles(provider: CloudProvider): Promise<CloudFileMeta[]> {
    await this.loadStoredTokens(provider);
    if (!this.isConnected(provider)) {
      throw new Error(`${provider} not connected`);
    }
    const token = this.tokens[provider]!.accessToken;

    if (provider === 'google') {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,size,modifiedTime)',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        throw new Error(`Google Drive list failed: ${response.status}`);
      }
      const data = (await response.json()) as {
        files?: { id: string; name: string; mimeType?: string; size?: string; modifiedTime?: string }[];
      };
      return (data.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : undefined,
        modifiedAt: f.modifiedTime,
      }));
    }

    if (provider === 'dropbox') {
      const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: '', limit: 50 }),
      });
      if (!response.ok) {
        throw new Error(`Dropbox list failed: ${response.status}`);
      }
      const data = (await response.json()) as {
        entries?: { '.tag': string; id: string; name: string; size?: number; client_modified?: string }[];
      };
      return (data.entries ?? [])
        .filter((e) => e['.tag'] === 'file')
        .map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          modifiedAt: f.client_modified,
        }));
    }

    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=50',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      throw new Error(`OneDrive list failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      value?: { id: string; name: string; size?: number; file?: { mimeType?: string }; lastModifiedDateTime?: string }[];
    };
    return (data.value ?? [])
      .filter((item) => item.file)
      .map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.file?.mimeType,
        size: item.size,
        modifiedAt: item.lastModifiedDateTime,
      }));
  }

  async downloadFile(provider: CloudProvider, fileId: string, fileName: string): Promise<string> {
    await this.loadStoredTokens(provider);
    if (!this.isConnected(provider)) {
      throw new Error(`${provider} not connected`);
    }
    const token = this.tokens[provider]!.accessToken;
    const cacheDir = `${FileSystem.cacheDirectory}cloud-drive/`;
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    const localUri = `${cacheDir}${fileName}`;

    if (provider === 'google') {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        throw new Error(`Google Drive download failed: ${response.status}`);
      }
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await FileSystem.writeAsStringAsync(localUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return localUri;
    }

    if (provider === 'dropbox') {
      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
        },
      });
      if (!response.ok) {
        throw new Error(`Dropbox download failed: ${response.status}`);
      }
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await FileSystem.writeAsStringAsync(localUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return localUri;
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      throw new Error(`OneDrive download failed: ${response.status}`);
    }
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await FileSystem.writeAsStringAsync(localUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return localUri;
  }

  async disconnect(provider: CloudProvider): Promise<void> {
    delete this.tokens[provider];
    await SecureTokenStore.removeToken(`${TOKEN_KEY_PREFIX}${provider}`);
  }
}

export default new CloudDriveService();
