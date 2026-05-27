import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Switch, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/common/Button';
import { Screen } from '../components/ui/Screen';
import { Text } from '../components/ui/Text';
import { Card } from '../components/ui/Card';
import { useTheme } from '../theme/useTheme';

const ORG_SETTINGS_KEY = '@readassist/enterprise_org';

interface OrgSettings {
  orgName: string;
  seatCount: string;
  ssoEnabled: boolean;
  auditLogEnabled: boolean;
}

/**
 * Enterprise organization settings — SSO, seat management, and org policies.
 * Persists locally until admin backend is connected.
 */
export const EnterpriseOrgSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const [orgName, setOrgName] = useState('');
  const [seatCount, setSeatCount] = useState('25');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [auditLogEnabled, setAuditLogEnabled] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem(ORG_SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as OrgSettings;
        setOrgName(saved.orgName);
        setSeatCount(saved.seatCount);
        setSsoEnabled(saved.ssoEnabled);
        setAuditLogEnabled(saved.auditLogEnabled);
      } catch {
        // ignore corrupt storage
      }
    });
  }, []);

  const handleSave = async () => {
    const payload: OrgSettings = { orgName, seatCount, ssoEnabled, auditLogEnabled };
    await AsyncStorage.setItem(ORG_SETTINGS_KEY, JSON.stringify(payload));
    Alert.alert('Saved', 'Organization profile saved on this device.');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="body" style={{ color: theme.colors.primary, marginBottom: 8 }} onPress={() => navigation.goBack()}>
          ← Back
        </Text>
        <Text variant="display">Organization Settings</Text>
        <Text variant="caption" style={{ marginBottom: 16, color: theme.colors.textSecondary }}>
          Configure SSO, seats, and compliance policies for your organization.
        </Text>

        <Card style={styles.card}>
          <Text variant="label">Organization name</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Acme School District"
            placeholderTextColor={theme.colors.textSecondary}
            value={orgName}
            onChangeText={setOrgName}
          />

          <Text variant="label">Licensed seats</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            keyboardType="number-pad"
            value={seatCount}
            onChangeText={setSeatCount}
          />

          <View style={styles.row}>
            <Text variant="label">SSO (SAML/OIDC)</Text>
            <Switch value={ssoEnabled} onValueChange={setSsoEnabled} />
          </View>

          <View style={styles.row}>
            <Text variant="label">Audit logging</Text>
            <Switch value={auditLogEnabled} onValueChange={setAuditLogEnabled} />
          </View>

          <Button title="Save Organization Profile" onPress={() => void handleSave()} fullWidth />
        </Card>

        <Card style={styles.card}>
          <Text variant="title">Enterprise features</Text>
          <Text variant="caption" style={styles.meta}>• Domain-verified user provisioning</Text>
          <Text variant="caption" style={styles.meta}>• SCIM directory sync</Text>
          <Text variant="caption" style={styles.meta}>• Parent/teacher role templates by org unit</Text>
          <Text variant="caption" style={styles.meta}>• FERPA-compliant data retention policies</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  meta: { marginBottom: 4 },
});
