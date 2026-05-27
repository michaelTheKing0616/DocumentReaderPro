import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import TrueScanService, { ExportFormat } from '../services/truescan/TrueScanService';
import CameraCaptureService from '../services/truescan/camera/capture';
import { CapturedPage } from '../services/truescan/camera/capture';
import { Button } from '../components/common/Button';
import DataService from '../services/storage/DataService';
import { Document } from '../types';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { Chip } from '../components/ui/Chip';
import { IconButton } from '../components/ui/IconButton';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { useTheme } from '../theme/useTheme';
import { useTranslation } from '../i18n';

export const TrueScanScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');

  useEffect(() => {
    CameraCaptureService.setCameraRef(cameraRef.current);
  }, []);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current) {
      Alert.alert(t('common.error'), t('truescan.cameraNotReady'));
      return;
    }

    try {
      const page = await CameraCaptureService.capturePage({
        quality: 0.9,
        autoFocus: true,
      });

      if (page) {
        setCapturedPages([...capturedPages, page]);
        Alert.alert(t('common.success'), t('truescan.captureSuccess'));
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert(t('common.error'), t('truescan.captureError'));
    }
  };

  const handleRemovePage = async (index: number) => {
    await CameraCaptureService.removePage(index);
    setCapturedPages(CameraCaptureService.getCapturedPages());
  };

  const handleProcess = async () => {
    if (capturedPages.length === 0) {
      Alert.alert(t('truescan.noPages'), t('truescan.captureFirst'));
      return;
    }

    setIsProcessing(true);
    setProcessingStage('Preprocessing images...');

    try {
      setProcessingStage('Detecting layout...');
      const result = await TrueScanService.processDocument(capturedPages, {
        autoPreprocess: true,
        exportFormat,
      });

      setProcessingStage('Saving to library...');

      const document: Document = {
        id: `truescan-${Date.now()}`,
        title: `Scanned Document ${new Date().toLocaleDateString()}`,
        format: exportFormat === 'pdf' ? 'pdf' : exportFormat === 'docx' ? 'docx' : 'txt',
        filePath: result.exportedPath,
        uploadDate: new Date(),
        pageCount: capturedPages.length,
      };

      await DataService.saveDocument(document);

      setProcessingStage('Complete!');
      Alert.alert(
        'Success',
        `Document processed and saved!\nProcessing time: ${(result.processingTime / 1000).toFixed(1)}s`,
        [
          {
            text: 'View in Library',
            onPress: () => {
              navigation.navigate('Library' as never);
            },
          },
          {
            text: 'Scan Another',
            onPress: () => {
              CameraCaptureService.clearCapturedPages();
              setCapturedPages([]);
              setIsProcessing(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Processing error:', error);
      Alert.alert(t('common.error'), t('truescan.exportError'));
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  if (!permission?.granted) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg, textAlign: 'center' }}>
            {t('truescan.permissionRequired')}
          </Text>
          <Button title={t('truescan.grantPermission')} onPress={requestPermission} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            backgroundColor: theme.colors.overlay,
          },
        ]}
      >
        <IconButton
          icon="arrow-back"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          variant="ghost"
          color={theme.colors.textInverse}
        />
        <Text variant="label" style={{ color: theme.colors.textInverse }}>
          {t('truescan.title')}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={[styles.cameraContainer, { backgroundColor: theme.colors.text }]}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="picture">
          <View style={styles.cameraOverlay}>
            <View
              style={[
                styles.captureGuide,
                {
                  borderColor: theme.colors.textInverse,
                  borderRadius: theme.radius.md,
                },
              ]}
            />
          </View>
        </CameraView>
      </View>

      <Card
        style={[
          styles.controls,
          {
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <Text variant="label" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          Export Format
        </Text>
        <View style={styles.formatRow}>
          {(['pdf', 'docx', 'html'] as ExportFormat[]).map((format) => (
            <Chip
              key={format}
              label={format.toUpperCase()}
              selected={exportFormat === format}
              onPress={() => setExportFormat(format)}
              style={{ marginRight: theme.spacing.sm }}
            />
          ))}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.captureButton,
              {
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surface,
              },
            ]}
            onPress={() => void handleCapture()}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel="Capture page"
          >
            <View style={[styles.captureButtonInner, { backgroundColor: theme.colors.primary }]} />
          </TouchableOpacity>
        </View>

        <Text variant="caption" color="muted" style={{ textAlign: 'center', marginBottom: theme.spacing.md }}>
          {t('truescan.pagesCaptured', { count: capturedPages.length })}
        </Text>

        {capturedPages.length > 0 && (
          <ScrollView horizontal style={styles.previewContainer} showsHorizontalScrollIndicator={false}>
            {capturedPages.map((page, index) => (
              <View key={page.uri} style={[styles.previewItem, { marginRight: theme.spacing.md }]}>
                <Image
                  source={{ uri: page.uri }}
                  style={[styles.previewImage, { backgroundColor: theme.colors.borderSubtle, borderRadius: theme.radius.sm }]}
                />
                <View style={styles.removeButtonWrap}>
                  <IconButton
                    icon="close"
                    onPress={() => void handleRemovePage(index)}
                    accessibilityLabel={`Remove page ${index + 1}`}
                    variant="filled"
                    size={14}
                    style={{ minWidth: 28, minHeight: 28, backgroundColor: theme.colors.error }}
                  />
                </View>
                <Text variant="caption" color="muted" style={{ textAlign: 'center', marginTop: theme.spacing.xs }}>
                  Page {index + 1}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {capturedPages.length > 0 && (
          <Button
            title={isProcessing ? processingStage : t('truescan.processDocument')}
            onPress={handleProcess}
            loading={isProcessing}
            fullWidth
            style={{ marginTop: theme.spacing.lg }}
          />
        )}

        {isProcessing && (
          <View style={[styles.processingContainer, { marginTop: theme.spacing.lg }]}>
            <LottieAnimation preset="loading" size={64} />
            <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
              {processingStage}
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSpacer: { width: 44 },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  captureGuide: {
    width: '80%',
    height: '60%',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  controls: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  formatRow: { flexDirection: 'row', marginBottom: 16 },
  buttonRow: { alignItems: 'center', marginBottom: 16 },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  previewContainer: { marginBottom: 16 },
  previewItem: { position: 'relative' },
  previewImage: { width: 80, height: 100 },
  removeButtonWrap: { position: 'absolute', top: -8, right: -8 },
  processingContainer: { alignItems: 'center', padding: 16 },
});
