import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { Button } from '../components/common/Button';
import { CalibrationMethod, CalibrationPoint } from '../types';
import { CalibrationUtils } from '../services/eye/CalibrationUtils';
import EyeService from '../services/eye/EyeService';
import WebGazerSource from '../services/eye/WebGazerSource';
import { RootState } from '../redux/store';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { Chip } from '../components/ui/Chip';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { useTheme } from '../theme/useTheme';
import { useTranslation } from '../i18n';

const CALIBRATION_DOT_DWELL_MS = 1500;
const CALIBRATION_GRID_COUNT = 9;
const CALIBRATION_DOT_SIZE = 28;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const CalibrationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const CALIBRATION_METHODS: { value: CalibrationMethod; label: string; desc: string }[] = [
    { value: 'explicit', label: t('calibration.methodExplicit'), desc: t('calibration.methodExplicitDesc') },
    { value: 'smooth-pursuit', label: t('calibration.methodSmooth'), desc: t('calibration.methodSmoothDesc') },
    { value: 'implicit', label: t('calibration.methodImplicit'), desc: t('calibration.methodImplicitDesc') },
  ];
  const hardwareType = useSelector((state: RootState) => state.settings.hardwareType);
  const [method, setMethod] = useState<CalibrationMethod>('explicit');
  const [calibrating, setCalibrating] = useState(false);
  const [activeDotIndex, setActiveDotIndex] = useState(-1);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { calibrate, calibration } = useEyeTracking({
    enabled: false,
    hardwareType,
  });

  useEffect(() => {
    EyeService.setPreferredHardware(hardwareType);
  }, [hardwareType]);

  const ensureCameraAccess = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      const started = await EyeService.startCalibrationCapture(hardwareType);
      if (!started) {
        Alert.alert(t('calibration.cameraRequired'), t('calibration.cameraRequiredWeb'));
        return false;
      }
      await WebGazerSource.enableCameraPreview(true);
      return true;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(t('calibration.cameraRequired'), t('calibration.cameraRequiredNative'));
        return false;
      }
    }

    const started = await EyeService.startCalibrationCapture(hardwareType);
    if (!started) {
      Alert.alert(t('calibration.gazeUnavailable'), t('calibration.gazeUnavailableMessage'));
      return false;
    }
    return true;
  }, [cameraPermission?.granted, hardwareType, requestCameraPermission, t]);

  const collectGridCalibration = useCallback(async (): Promise<CalibrationPoint[]> => {
    const gridTargets = CalibrationUtils.generateGridPoints(CALIBRATION_GRID_COUNT);
    const collected: CalibrationPoint[] = [];

    for (let i = 0; i < gridTargets.length; i++) {
      setActiveDotIndex(i);
      EyeService.resetCalibrationSamples();
      await delay(CALIBRATION_DOT_DWELL_MS);

      const median = EyeService.getCalibrationSampleMedian();
      collected.push({
        x: gridTargets[i].x,
        y: gridTargets[i].y,
        gazeX: median?.gazeX,
        gazeY: median?.gazeY,
        timestamp: Date.now(),
      });
    }

    setActiveDotIndex(-1);
    return collected;
  }, []);

  const handleCalibrate = async () => {
    setCalibrating(true);
    try {
      const cameraReady = await ensureCameraAccess();
      if (!cameraReady) {
        return;
      }

      const collectedPoints = await collectGridCalibration();

      EyeService.stopCalibrationCapture();
      if (Platform.OS === 'web') {
        await WebGazerSource.enableCameraPreview(false);
      }

      const validSamples = collectedPoints.filter(
        (p) => p.gazeX !== undefined && p.gazeY !== undefined
      ).length;

      if (validSamples < 5) {
        Alert.alert(t('calibration.insufficientGaze'), t('calibration.insufficientGazeMessage'));
        return;
      }

      await calibrate(method, collectedPoints);
    } catch (error) {
      console.error('Calibration error:', error);
      Alert.alert(t('calibration.failed'), t('calibration.failedMessage'));
    } finally {
      EyeService.stopCalibrationCapture();
      if (Platform.OS === 'web') {
        await WebGazerSource.enableCameraPreview(false);
      }
      setCalibrating(false);
      setActiveDotIndex(-1);
    }
  };

  const handleContinue = () => {
    navigation.navigate('Library' as never);
  };

  const gridTargets =
    activeDotIndex >= 0 ? CalibrationUtils.generateGridPoints(CALIBRATION_GRID_COUNT) : [];
  const activeTarget = activeDotIndex >= 0 ? gridTargets[activeDotIndex] : null;

  return (
    <Screen padded={false}>
      {Platform.OS !== 'web' && cameraPermission?.granted && (
        <CameraView style={styles.cameraPreview} facing="front" />
      )}

      {Platform.OS === 'web' && calibrating && (
        <Text
          variant="caption"
          color="muted"
          style={[styles.webCameraHint, { padding: theme.spacing.lg }]}
        >
          {t('calibration.webCameraHint')}
        </Text>
      )}

      {activeTarget && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.calibrationDot,
              {
                left: activeTarget.x - CALIBRATION_DOT_SIZE / 2,
                top: activeTarget.y - CALIBRATION_DOT_SIZE / 2,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  width: CALIBRATION_DOT_SIZE,
                  height: CALIBRATION_DOT_SIZE,
                  borderRadius: CALIBRATION_DOT_SIZE / 2,
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.surface,
                },
              ]}
            />
          </View>
        </View>
      )}

      <View style={[styles.content, { padding: theme.spacing.xl }]}>
        <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
          {t('calibration.title')}
        </Text>
        <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing['3xl'] }}>
          {t('calibration.subtitle')}
        </Text>

        <Card style={{ marginBottom: theme.spacing['3xl'] }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.lg }}>
            {t('calibration.methodTitle')}
          </Text>
          {CALIBRATION_METHODS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={method === option.value}
              onPress={() => setMethod(option.value)}
              disabled={calibrating}
              style={{ marginBottom: theme.spacing.sm, alignSelf: 'stretch' }}
            />
          ))}
          <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
            {CALIBRATION_METHODS.find((m) => m.value === method)?.desc}
          </Text>
        </Card>

        {calibrating && (
          <View style={styles.calibratingRow}>
            <LottieAnimation preset="loading" size={64} />
            {activeDotIndex >= 0 && (
              <Text variant="body" color="accent" style={{ marginTop: theme.spacing.md, textAlign: 'center' }}>
                {t('calibration.pointProgress', {
                  current: activeDotIndex + 1,
                  total: CALIBRATION_GRID_COUNT,
                })}
              </Text>
            )}
          </View>
        )}

        {calibration && calibration.completed && !calibrating && (
          <Card
            style={{
              marginBottom: theme.spacing['2xl'],
              backgroundColor: theme.colors.successMuted,
              alignItems: 'center',
            }}
          >
            <LottieAnimation preset="success" size={72} loop={false} />
            <Text variant="body" color="success" style={{ marginTop: theme.spacing.md, textAlign: 'center' }}>
              {t('calibration.complete', {
                percent: Math.round(calibration.accuracy * 100),
              })}
            </Text>
          </Card>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title={calibration?.completed ? t('calibration.recalibrate') : t('calibration.start')}
            onPress={handleCalibrate}
            loading={calibrating}
            fullWidth
          />
          {calibration?.completed && (
            <Button
              title={t('calibration.continue')}
              onPress={handleContinue}
              fullWidth
              style={{ marginTop: theme.spacing.md }}
            />
          )}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  webCameraHint: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 2,
  },
  calibrationDot: {
    position: 'absolute',
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderWidth: 3,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
  calibratingRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    marginTop: 'auto',
  },
});
