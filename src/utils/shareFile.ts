import { Platform } from 'react-native';
import Share from 'react-native-share';
import { logger } from '../services/logger/Logger';

export interface ShareFileOptions {
  uri: string;
  title?: string;
  message?: string;
  mimeType?: string;
  /** Opens native print sheet on iOS when supported */
  print?: boolean;
}

export async function shareFile(options: ShareFileOptions): Promise<void> {
  const url = options.uri.startsWith('file://') ? options.uri : `file://${options.uri}`;
  try {
    await Share.open({
      url,
      title: options.title,
      message: options.message,
      type: options.mimeType ?? 'application/pdf',
      failOnCancel: false,
      ...(options.print && Platform.OS === 'ios' ? { saveToFiles: false } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('User did not share') || message.includes('CANCELLED')) {
      return;
    }
    logger.error('Share failed', { message });
    throw error;
  }
}

export async function printFile(uri: string, title?: string): Promise<void> {
  await shareFile({ uri, title, print: true });
}
