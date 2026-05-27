import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import PdfToolsService, { PdfRotation } from '../services/document/PdfToolsService';
import StripeService from '../services/billing/StripeService';
import { Button } from '../components/common/Button';
import { SignaturePad, SignaturePadHandle } from '../components/document/SignaturePad';
import { shareFile } from '../utils/shareFile';
import { logger } from '../services/logger/Logger';
import DataService from '../services/storage/DataService';
import { Screen } from '../components/ui/Screen';
import { AppHeader } from '../components/ui/AppHeader';
import { Text } from '../components/ui/Text';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { useTheme } from '../theme/useTheme';

type ToolMode = 'merge' | 'split' | 'rotate' | 'sign';

export const PdfToolsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [mode, setMode] = useState<ToolMode>('merge');
  const [selectedUris, setSelectedUris] = useState<string[]>([]);
  const [splitStart, setSplitStart] = useState('1');
  const [splitEnd, setSplitEnd] = useState('1');
  const [rotation, setRotation] = useState<PdfRotation>(90);
  const [signerName, setSignerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastOutputUri, setLastOutputUri] = useState<string | null>(null);

  const hasAccess = StripeService.canAccess('pdf_tools');

  const pickPdfs = async (multiple = false) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }
    const uris = result.assets.map((asset) => asset.uri);
    setSelectedUris(multiple ? uris : [uris[0]]);
  };

  const handleMerge = async () => {
    if (selectedUris.length < 2) {
      Alert.alert('Select PDFs', 'Choose at least two PDF files to merge.');
      return;
    }
    setLoading(true);
    try {
      const outUri = await PdfToolsService.mergePdfs({ sourceUris: selectedUris });
      setLastOutputUri(outUri);
      Alert.alert('Merge complete', 'PDF merged successfully.');
    } catch (error) {
      logger.error('PDF merge failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      Alert.alert('Merge failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSplit = async () => {
    if (selectedUris.length === 0) {
      Alert.alert('Select PDF', 'Choose a PDF file to split.');
      return;
    }
    const start = Math.max(0, parseInt(splitStart, 10) - 1);
    const end = Math.max(start, parseInt(splitEnd, 10) - 1);
    setLoading(true);
    try {
      const parts = await PdfToolsService.splitPdf({
        sourceUri: selectedUris[0],
        pageRanges: [{ start, end, label: 'split' }],
      });
      setLastOutputUri(parts[0] ?? null);
      Alert.alert('Split complete', `Created ${parts.length} file(s).`);
    } catch (error) {
      Alert.alert('Split failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async () => {
    if (selectedUris.length === 0) {
      Alert.alert('Select PDF', 'Choose a PDF file to rotate.');
      return;
    }
    setLoading(true);
    try {
      const outUri = await PdfToolsService.rotatePdf({
        sourceUri: selectedUris[0],
        degrees: rotation,
      });
      setLastOutputUri(outUri);
      Alert.alert('Rotate complete', `Pages rotated ${rotation}°.`);
    } catch (error) {
      Alert.alert('Rotate failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (selectedUris.length === 0) {
      Alert.alert('Select PDF', 'Choose a PDF to sign.');
      return;
    }
    if (!signerName.trim()) {
      Alert.alert('Signer name', 'Enter the signer name.');
      return;
    }
    const signatureBase64 = await signatureRef.current?.toBase64Png();
    if (!signatureBase64) {
      Alert.alert('Signature required', 'Draw your signature first.');
      return;
    }
    setLoading(true);
    try {
      const outUri = await PdfToolsService.applyESignatures(selectedUris[0], [
        {
          name: 'signature',
          signerName: signerName.trim(),
          signatureImageBase64: signatureBase64,
          pageIndex: 0,
          x: 72,
          y: 120,
          width: 200,
          height: 60,
        },
      ]);
      setLastOutputUri(outUri);
      Alert.alert('Signed', 'Signature applied to PDF.');
    } catch (error) {
      Alert.alert('Sign failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleShareOutput = async () => {
    if (!lastOutputUri) {
      Alert.alert('No output', 'Run a tool first to generate a file.');
      return;
    }
    await shareFile({ uri: lastOutputUri, title: 'PDF', mimeType: 'application/pdf' });
  };

  const runAction = () => {
    switch (mode) {
      case 'merge':
        void handleMerge();
        break;
      case 'split':
        void handleSplit();
        break;
      case 'rotate':
        void handleRotate();
        break;
      case 'sign':
        void handleSign();
        break;
    }
  };

  if (!hasAccess) {
    return (
      <Screen>
        <AppHeader title="PDF Tools" subtitle="Premium feature" />
        <View style={{ padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
            PDF merge, split, rotate, and e-sign require Premium.
          </Text>
          <Button
            title="Upgrade"
            onPress={() => {
              const session = DataService.getCurrentUser();
              void StripeService.openCheckout(session?.id ?? 'local', session?.email);
            }}
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppHeader title="PDF Tools" subtitle="Merge, split, rotate, sign" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}>
      <View style={styles.modeRow}>
        {(['merge', 'split', 'rotate', 'sign'] as ToolMode[]).map((m) => (
          <Chip
            key={m}
            label={m.charAt(0).toUpperCase() + m.slice(1)}
            selected={mode === m}
            onPress={() => setMode(m)}
            style={{ marginRight: theme.spacing.sm, marginBottom: theme.spacing.sm }}
          />
        ))}
      </View>

      <Card style={{ marginBottom: theme.spacing.lg }}>
        <Text variant="title" style={{ marginBottom: theme.spacing.md }}>Source files</Text>
        <Button
          title={mode === 'merge' ? 'Pick PDFs (multiple)' : 'Pick PDF'}
          variant="outline"
          onPress={() => void pickPdfs(mode === 'merge')}
          fullWidth
        />
        {selectedUris.length > 0 && (
          <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
            {selectedUris.length} file(s) selected
          </Text>
        )}

        {mode === 'split' && (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Start page"
              keyboardType="number-pad"
              value={splitStart}
              onChangeText={setSplitStart}
            />
            <TextInput
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="End page"
              keyboardType="number-pad"
              value={splitEnd}
              onChangeText={setSplitEnd}
            />
          </View>
        )}

        {mode === 'rotate' && (
          <View style={styles.row}>
            {([90, 180, 270] as PdfRotation[]).map((deg) => (
              <Chip
                key={deg}
                label={`${deg}°`}
                selected={rotation === deg}
                onPress={() => setRotation(deg)}
                style={{ marginRight: theme.spacing.sm }}
              />
            ))}
          </View>
        )}

        {mode === 'sign' && (
          <>
            <TextInput
              style={[styles.inputFull, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Signer name"
              value={signerName}
              onChangeText={setSignerName}
            />
            <SignaturePad ref={signatureRef} />
          </>
        )}

        <Button
          title={loading ? 'Working…' : 'Run'}
          onPress={runAction}
          loading={loading}
          disabled={loading}
          fullWidth
          style={{ marginTop: theme.spacing.lg }}
        />
      </Card>

      {lastOutputUri && (
        <Card>
          <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>Output</Text>
          <Text variant="caption" color="muted" numberOfLines={2}>
            {lastOutputUri}
          </Text>
          <Button title="Share / Print" variant="outline" onPress={() => void handleShareOutput()} fullWidth style={{ marginTop: theme.spacing.md }} />
        </Card>
      )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  inputFull: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginTop: 12,
    marginBottom: 8,
  },
});
