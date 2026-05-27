import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** Web shim — PDF rendering uses text extraction path in ReaderCanvas. */
const PdfWebStub: React.FC<{ source?: { uri?: string }; style?: object }> = ({ source }) => (
  <View style={[styles.box, source?.uri ? undefined : styles.empty]}>
    <Text style={styles.label}>PDF preview is available in the native app.</Text>
  </View>
);

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  empty: { minHeight: 200 },
  label: { textAlign: 'center', opacity: 0.7 },
});

export default PdfWebStub;
