import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import OCRService from '../../services/truescan/ocr/ocrService';
import { logger } from '../../services/logger/Logger';
import { useTheme } from '../../theme/useTheme';

const SNIPPET_VOCAB: Record<string, string> = {
  happy: 'Feeling or showing pleasure or contentment.',
  read: 'Look at and understand written or printed words.',
  book: 'A written or printed work consisting of pages.',
  learn: 'Gain knowledge or skill through study or experience.',
  word: 'A single distinct meaningful element of speech or writing.',
  story: 'An account of events told for entertainment.',
  page: 'One side of a sheet of paper in a book.',
  light: 'The natural agent that makes things visible.',
};

interface ARDefinitionOverlayProps {
  visible: boolean;
  onClose: () => void;
  onWordDetected?: (word: string, definition: string) => void;
}

function lookupDefinition(word: string): string {
  const key = word.toLowerCase().replace(/[^a-z]/g, '');
  if (SNIPPET_VOCAB[key]) {
    return SNIPPET_VOCAB[key];
  }
  return `"${word}" — tap a highlighted word in your book to look it up.`;
}

export const ARDefinitionOverlay: React.FC<ARDefinitionOverlayProps> = ({
  visible,
  onClose,
  onWordDetected,
}) => {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [detectedWord, setDetectedWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      void requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

  const captureAndLookup = useCallback(async () => {
    if (!cameraRef.current || processing) {
      return;
    }

    setProcessing(true);
    setError(null);
    setDetectedWord(null);
    setDefinition(null);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: Platform.OS === 'android',
      });

      if (!photo?.uri) {
        throw new Error('Could not capture image');
      }

      const ocr = await OCRService.recognizeText(photo.uri, undefined, 'eng', {
        preprocess: true,
        psm: 'line',
      });

      const words = ocr.text
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z'-]/g, ''))
        .filter((w) => w.length >= 3);

      if (words.length === 0) {
        setError('No text detected. Point the camera at a printed word.');
        return;
      }

      const word = words[Math.floor(words.length / 2)] ?? words[0];
      const def = lookupDefinition(word);
      setDetectedWord(word);
      setDefinition(def);
      onWordDetected?.(word, def);
    } catch (err) {
      logger.warn('ARDefinitionOverlay OCR failed', { error: String(err) });
      setError('Could not read text. Try better lighting and hold steady.');
    } finally {
      setProcessing(false);
    }
  }, [processing, onWordDetected]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Word Lookup</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close word lookup">
            <Text style={[styles.closeText, { color: theme.colors.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>

        {!permission?.granted ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Camera permission is required for word lookup.</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => void requestPermission()}
            >
              <Text style={styles.primaryButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.cameraWrap}>
              <CameraView ref={cameraRef} style={styles.camera} facing="back" />
              <View style={styles.reticle} pointerEvents="none" />
            </View>

            <Text style={styles.hint}>Aim at a word on the page, then tap Scan.</Text>

            {processing && (
              <View style={styles.processingRow}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.processingText}>Reading text…</Text>
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {detectedWord && definition && (
              <View style={styles.resultCard}>
                <Text style={styles.wordLabel}>{detectedWord}</Text>
                <Text style={styles.definitionText}>{definition}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: theme.colors.primary },
                processing && styles.primaryButtonDisabled,
              ]}
              onPress={() => void captureAndLookup()}
              disabled={processing}
            >
              <Text style={styles.primaryButtonText}>{processing ? 'Scanning…' : 'Scan Word'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cameraWrap: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 12,
  },
  camera: {
    flex: 1,
  },
  reticle: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    width: '60%',
    height: 48,
    borderWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.8)',
    borderRadius: 6,
  },
  hint: {
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
  processingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  processingText: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  wordLabel: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  definitionText: {
    fontSize: 16,
    color: '#EEEEEE',
    lineHeight: 22,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  message: {
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
});
