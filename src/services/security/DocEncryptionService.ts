import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { logger } from '../logger/Logger';

/**
 * Client-side document encryption before cloud upload.
 * Uses AES-GCM via Web Crypto when available; falls back to base64 obfuscation scaffold.
 */
class DocEncryptionService {
  async encryptFile(localUri: string, passphrase: string): Promise<{ uri: string; iv: string }> {
    const content = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const ivBytes = await Crypto.getRandomBytesAsync(12);
    const iv = this.bytesToBase64(ivBytes);

    if (typeof globalThis.crypto?.subtle !== 'undefined') {
      const keyMaterial = await globalThis.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      const plainBytes = this.base64ToBytes(content);
      const encrypted = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: ivBytes },
        keyMaterial,
        plainBytes
      );
      const outUri = `${FileSystem.cacheDirectory}enc_${Date.now()}.bin`;
      await FileSystem.writeAsStringAsync(outUri, this.bytesToBase64(new Uint8Array(encrypted)), {
        encoding: FileSystem.EncodingType.Base64,
      });
      logger.info('Document encrypted for upload', { outUri });
      return { uri: outUri, iv };
    }

    logger.warn('Web Crypto unavailable — using obfuscation scaffold only');
    const outUri = `${FileSystem.cacheDirectory}enc_${Date.now()}.bin`;
    await FileSystem.writeAsStringAsync(outUri, btoa(`${iv}:${content}`), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri: outUri, iv };
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export default new DocEncryptionService();
