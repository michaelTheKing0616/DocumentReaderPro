import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import CloudDriveService, { CloudProvider, CloudFileMeta } from '../services/cloud/CloudDriveService';
import StripeService from '../services/billing/StripeService';
import DocumentLoaderService from '../services/document/DocumentLoaderService';
import DataService from '../services/storage/DataService';
import { Button } from '../components/common/Button';
import { Screen } from '../components/ui/Screen';
import { AppHeader } from '../components/ui/AppHeader';
import { Text } from '../components/ui/Text';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { IconButton } from '../components/ui/IconButton';
import { useTheme } from '../theme/useTheme';
import { logger } from '../services/logger/Logger';
import { useTranslation } from '../i18n';
import { generateIdSync } from '../utils/id';
import { Document } from '../types';

const REDIRECT_URI = 'readassist://oauth/callback';

const PROVIDERS: { id: CloudProvider; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'google', label: 'Google Drive', icon: 'logo-google' },
  { id: 'dropbox', label: 'Dropbox', icon: 'logo-dropbox' },
  { id: 'onedrive', label: 'OneDrive', icon: 'cloud-outline' },
];

export const CloudDriveScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [activeProvider, setActiveProvider] = useState<CloudProvider>('google');
  const [authCode, setAuthCode] = useState('');
  const [files, setFiles] = useState<CloudFileMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const hasAccess = StripeService.canAccess('cloud_sync');

  const refreshConnection = useCallback(async (provider: CloudProvider) => {
    await CloudDriveService.loadStoredTokens(provider);
    setConnected(CloudDriveService.isConnected(provider));
  }, []);

  useEffect(() => {
    void refreshConnection(activeProvider);
  }, [activeProvider, refreshConnection]);

  const handleUpgrade = async () => {
    const session = DataService.getCurrentUser();
    const opened = await StripeService.openCheckout(session?.id ?? 'local', session?.email);
    if (!opened) {
      Alert.alert(t('premium.title'), t('premium.checkoutUnavailable'));
    }
  };

  const handleConnect = async () => {
    const url = CloudDriveService.getAuthorizationUrl(activeProvider, REDIRECT_URI);
    try {
      await Linking.openURL(url);
      Alert.alert(t('cloudDrive.authorizeTitle'), t('cloudDrive.authorizeBody'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('cloudDrive.oauthFailed'));
    }
  };

  const handleExchangeCode = async () => {
    if (!authCode.trim()) {
      Alert.alert(t('common.error'), t('cloudDrive.codeRequired'));
      return;
    }
    setLoading(true);
    try {
      await CloudDriveService.exchangeCode(activeProvider, authCode.trim(), REDIRECT_URI);
      setConnected(true);
      setAuthCode('');
      Alert.alert(t('common.success'), t('cloudDrive.connectedSuccess', { provider: activeProvider }));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('library.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const handleListFiles = async () => {
    setLoading(true);
    try {
      const listed = await CloudDriveService.listFiles(activeProvider);
      setFiles(listed);
    } catch (error) {
      logger.error('Cloud list failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('library.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file: CloudFileMeta) => {
    setImportingId(file.id);
    try {
      const localUri = await CloudDriveService.downloadFile(activeProvider, file.id, file.name);
      const destPath = `${FileSystem.documentDirectory}${file.name}`;
      await FileSystem.copyAsync({ from: localUri, to: destPath });

      const format = DocumentLoaderService.detectFormat(file.name);
      const document: Document = {
        id: generateIdSync(),
        title: file.name,
        format,
        filePath: destPath,
        uploadDate: new Date(),
      };
      await DataService.saveDocument(document);
      Alert.alert(t('common.success'), t('cloudDrive.importSuccess', { name: file.name }));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('library.tryAgain'));
    } finally {
      setImportingId(null);
    }
  };

  const handleDisconnect = async () => {
    await CloudDriveService.disconnect(activeProvider);
    setConnected(false);
    setFiles([]);
  };

  if (!hasAccess) {
    return (
      <Screen>
        <AppHeader title={t('cloudDrive.title')} subtitle={t('cloudDrive.premiumRequired')} />
        <View style={[styles.centered, { padding: theme.spacing.xl }]}>
          <LottieAnimation preset="empty" size={120} />
          <Text variant="body" color="secondary" style={{ textAlign: 'center', marginVertical: theme.spacing.lg }}>
            {t('cloudDrive.premiumRequired')}
          </Text>
          <Button title={t('premium.upgrade')} onPress={() => void handleUpgrade()} fullWidth />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppHeader title={t('cloudDrive.title')} subtitle={t('cloudDrive.subtitle')} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.providerRow}>
          {PROVIDERS.map((provider) => (
            <Chip
              key={provider.id}
              label={provider.label}
              selected={activeProvider === provider.id}
              onPress={() => setActiveProvider(provider.id)}
              style={{ marginRight: theme.spacing.sm }}
            />
          ))}
        </ScrollView>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <View style={styles.statusRow}>
            <Ionicons
              name={connected ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={connected ? theme.colors.success : theme.colors.textMuted}
            />
            <Text variant="body" color={connected ? 'success' : 'muted'}>
              {connected ? t('cloudDrive.statusConnected') : t('cloudDrive.statusDisconnected')}
            </Text>
          </View>

          {!connected ? (
            <>
              <Button title={t('cloudDrive.connectOAuth')} onPress={() => void handleConnect()} fullWidth />
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceMuted,
                    marginTop: theme.spacing.md,
                  },
                ]}
                placeholder={t('cloudDrive.codePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={authCode}
                onChangeText={setAuthCode}
                autoCapitalize="none"
              />
              <Button
                title={t('cloudDrive.completeConnection')}
                variant="outline"
                onPress={() => void handleExchangeCode()}
                loading={loading}
                fullWidth
                style={{ marginTop: theme.spacing.sm }}
              />
            </>
          ) : (
            <>
              <Button title={t('cloudDrive.listFiles')} onPress={() => void handleListFiles()} loading={loading} fullWidth />
              <Button
                title={t('cloudDrive.disconnect')}
                variant="outline"
                onPress={() => void handleDisconnect()}
                fullWidth
                style={{ marginTop: theme.spacing.sm }}
              />
            </>
          )}
        </Card>

        {loading && files.length === 0 ? (
          <View style={styles.centered}>
            <LottieAnimation preset="loading" size={96} />
          </View>
        ) : null}

        {files.length === 0 && !loading ? (
          <EmptyState
            lottie="empty"
            title={t('cloudDrive.noFilesTitle')}
            description={t('cloudDrive.noFilesDescription')}
          />
        ) : (
          files.map((file) => (
            <Card key={file.id} style={styles.fileRow}>
              <View style={styles.fileMeta}>
                <Text variant="body" numberOfLines={1}>
                  {file.name}
                </Text>
                <Text variant="caption" color="muted">
                  {file.mimeType ?? 'file'}
                  {file.size ? ` · ${Math.round(file.size / 1024)} KB` : ''}
                </Text>
              </View>
              <IconButton
                icon={importingId === file.id ? 'hourglass-outline' : 'download-outline'}
                accessibilityLabel={t('cloudDrive.import')}
                onPress={() => void handleImport(file)}
                disabled={importingId !== null}
                loading={importingId === file.id}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  providerRow: { marginBottom: 16, flexGrow: 0 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  fileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  fileMeta: { flex: 1, marginRight: 8 },
});
