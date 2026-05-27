import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Switch, Slider, TextInput, Linking } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../redux/store';
import { updatePreferences } from '../redux/userSlice';
import { setUXPreferences, startTour } from '../redux/uxSlice';
import { UXPersonalizer } from '../services/utils/UXPersonalizer';
import { READER_FONT_CATALOG } from '../services/document/fontCatalog';
import { UserPreferences, UXPreferences } from '../types';
import { HardwareIntegrator } from '../components/assistive/HardwareIntegrator';
import { BrightnessAdjuster } from '../components/assistive/BrightnessAdjuster';
import { Button } from '../components/common/Button';
import StripeService from '../services/billing/StripeService';
import ARService from '../services/ar/ARService';
import { useTranslation } from '../i18n';
import DataService from '../services/storage/DataService';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { Chip } from '../components/ui/Chip';
import { useTheme } from '../theme/useTheme';
import { Alert } from 'react-native';
import ExportIntegrationsService from '../services/integrations/ExportIntegrationsService';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { t, locale, setLocale } = useTranslation();
  const { theme } = useTheme();
  const user = useSelector((state: RootState) => state.user.profile);
  const ux = useSelector((state: RootState) => state.ux.preferences);
  const [isPremium, setIsPremium] = useState(false);
  const [dyslexiaFilter, setDyslexiaFilter] = useState<'blue' | 'yellow' | 'none'>('none');
  const [localPreferences, setLocalPreferences] = useState<UserPreferences>(
    user?.preferences ?? {
      fontSize: 16,
      fontFamily: 'System',
      lineSpacing: 1.5,
      theme: 'light',
      ttsEnabled: false,
      ttsSpeed: 150,
      eyeTrackingEnabled: false,
      arOverlaysEnabled: false,
      brightnessAutoAdjust: false,
    }
  );
  const [localUX, setLocalUX] = useState<UXPreferences>(ux);
  const [evernoteConnected, setEvernoteConnected] = useState(false);
  const [goodreadsConnected, setGoodreadsConnected] = useState(false);
  const [evernoteTokenInput, setEvernoteTokenInput] = useState('');
  const [goodreadsTokenInput, setGoodreadsTokenInput] = useState('');
  const [exportBusy, setExportBusy] = useState<'evernote' | 'goodreads' | null>(null);

  useEffect(() => {
    const session = DataService.getCurrentUser();
    void StripeService.refreshSubscription(session?.id ?? 'local').then((status) => {
      setIsPremium(status.isPremium);
    });
    setDyslexiaFilter(ARService.getDyslexiaFilter().color);
    void ExportIntegrationsService.loadTokensFromSecureStorage().then(async () => {
      setEvernoteConnected(await ExportIntegrationsService.isEvernoteConnected());
      setGoodreadsConnected(await ExportIntegrationsService.isGoodreadsConnected());
    });
  }, []);

  const handlePreferenceChange = (key: keyof UserPreferences, value: UserPreferences[keyof UserPreferences]) => {
    const updated = { ...localPreferences, [key]: value };
    setLocalPreferences(updated);
    dispatch(updatePreferences(updated));
  };

  const handleUXChange = (key: keyof UXPreferences, value: UXPreferences[keyof UXPreferences]) => {
    const updated = { ...localUX, [key]: value };
    setLocalUX(updated);
    dispatch(setUXPreferences(updated));
  };

  const handleUpgrade = async () => {
    const session = DataService.getCurrentUser();
    const opened = await StripeService.openCheckout(session?.id ?? 'local', session?.email);
    if (!opened) {
      Alert.alert(t('premium.title'), t('premium.checkoutUnavailable'));
    }
  };

  const handleParentDashboard = () => {
    if (!StripeService.canAccess('parent_dashboard') && user?.role !== 'parent' && user?.role !== 'teacher') {
      Alert.alert(t('premium.title'), t('premium.parentDashboardLocked'));
      return;
    }
    navigation.navigate('ParentDashboard');
  };

  const handleEvernoteOAuth = async () => {
    if (!ExportIntegrationsService.isEvernoteConfigured()) {
      Alert.alert(t('settings.exportIntegrations.title'), t('settings.exportIntegrations.evernoteNotConfigured'));
      return;
    }
    const url = ExportIntegrationsService.getEvernoteAuthUrl();
    const opened = await Linking.openURL(url).then(() => true).catch(() => false);
    if (!opened) {
      Alert.alert(t('common.error'), t('settings.exportIntegrations.oauthFailed'));
    }
  };

  const handleEvernoteConnect = async () => {
    if (!evernoteTokenInput.trim()) {
      Alert.alert(t('settings.exportIntegrations.title'), t('settings.exportIntegrations.tokenRequired'));
      return;
    }
    setExportBusy('evernote');
    try {
      await ExportIntegrationsService.setEvernoteToken(evernoteTokenInput);
      setEvernoteConnected(true);
      setEvernoteTokenInput('');
      Alert.alert(t('common.success'), t('settings.exportIntegrations.evernoteConnected'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    } finally {
      setExportBusy(null);
    }
  };

  const handleEvernoteDisconnect = async () => {
    await ExportIntegrationsService.disconnectEvernote();
    setEvernoteConnected(false);
    Alert.alert(t('common.success'), t('settings.exportIntegrations.evernoteDisconnected'));
  };

  const handleGoodreadsConnect = async () => {
    if (!goodreadsTokenInput.trim() && !ExportIntegrationsService.isGoodreadsConfigured()) {
      Alert.alert(t('settings.exportIntegrations.title'), t('settings.exportIntegrations.tokenRequired'));
      return;
    }
    setExportBusy('goodreads');
    try {
      if (goodreadsTokenInput.trim()) {
        await ExportIntegrationsService.setGoodreadsToken(goodreadsTokenInput);
      }
      setGoodreadsConnected(await ExportIntegrationsService.isGoodreadsConnected());
      setGoodreadsTokenInput('');
      Alert.alert(t('common.success'), t('settings.exportIntegrations.goodreadsConnected'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    } finally {
      setExportBusy(null);
    }
  };

  const handleGoodreadsDisconnect = async () => {
    await ExportIntegrationsService.disconnectGoodreads();
    setGoodreadsConnected(await ExportIntegrationsService.isGoodreadsConnected());
    Alert.alert(t('common.success'), t('settings.exportIntegrations.goodreadsDisconnected'));
  };

  const handleDyslexiaFilter = (color: 'blue' | 'yellow' | 'none') => {
    setDyslexiaFilter(color);
    ARService.setDyslexiaFilter(color);
    if (color !== 'none' && !localPreferences.arOverlaysEnabled) {
      handlePreferenceChange('arOverlaysEnabled', true);
    }
  };

  const handleApplyPersonalization = () => {
    if (!user) {
      return;
    }
    const suggestedTheme = UXPersonalizer.suggestTheme(user);
    const suggestedFontSize = UXPersonalizer.suggestFontSize(user);
    const uxPrefs = UXPersonalizer.getPersonalizedPreferences(user);
    handlePreferenceChange('theme', suggestedTheme);
    handlePreferenceChange('fontSize', suggestedFontSize);
    dispatch(setUXPreferences(uxPrefs));
    setLocalUX((prev) => ({ ...prev, ...uxPrefs }));
    Alert.alert(t('settingsAlerts.applied'), t('settingsAlerts.appliedMessage'));
  };

  const fontFamilies = READER_FONT_CATALOG;
  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'high-contrast', label: 'High Contrast' },
  ] as const;

  const renderSettingRow = (label: string, control: React.ReactNode) => (
    <View
      style={[
        styles.settingRow,
        { borderBottomColor: theme.colors.borderSubtle, paddingVertical: theme.spacing.md },
      ]}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      {control}
    </View>
  );

  return (
    <Screen padded={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
      >
        <Text variant="title" style={{ marginBottom: theme.spacing['2xl'] }}>
          {t('settings.title')}
        </Text>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Cloud Account
          </Text>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>
            {DataService.getCurrentUser()?.isLocalOnly
              ? 'Local-only mode — sign in to sync across devices.'
              : `Signed in${DataService.getCurrentUser()?.email ? `: ${DataService.getCurrentUser()?.email}` : ''}`}
          </Text>
          <Button
            title={DataService.getCurrentUser()?.isLocalOnly ? 'Sign In / Sign Up' : 'Manage Account'}
            variant="outline"
            fullWidth
            onPress={() => navigation.navigate('Auth')}
          />
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Tools & Integrations
          </Text>
          <Button title="PDF Tools" variant="outline" fullWidth onPress={() => navigation.navigate('PdfTools')} />
          <Button
            title="Cloud Drive"
            variant="outline"
            fullWidth
            style={{ marginTop: theme.spacing.sm }}
            onPress={() => navigation.navigate('CloudDrive')}
          />
          <Button
            title="Collaboration"
            variant="outline"
            fullWidth
            style={{ marginTop: theme.spacing.sm }}
            onPress={() => navigation.navigate('Collaboration')}
          />
          <Button
            title="Organization Settings"
            variant="outline"
            fullWidth
            style={{ marginTop: theme.spacing.sm }}
            onPress={() => navigation.navigate('EnterpriseOrgSettings')}
          />
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('settings.exportIntegrations.title')}
          </Text>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>
            {t('settings.exportIntegrations.subtitle')}
          </Text>

          <Text variant="label" style={{ marginBottom: theme.spacing.xs }}>
            Evernote
          </Text>
          <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
            {evernoteConnected
              ? t('settings.exportIntegrations.statusConnected')
              : t('settings.exportIntegrations.statusDisconnected')}
          </Text>
          {!evernoteConnected && (
            <>
              <Button
                title={t('settings.exportIntegrations.connectOAuth')}
                variant="outline"
                fullWidth
                onPress={() => void handleEvernoteOAuth()}
              />
              <TextInput
                value={evernoteTokenInput}
                onChangeText={setEvernoteTokenInput}
                placeholder={t('settings.exportIntegrations.evernoteTokenPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={[
                  styles.tokenInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceMuted,
                    marginTop: theme.spacing.sm,
                  },
                ]}
              />
              <Button
                title={t('settings.exportIntegrations.saveToken')}
                fullWidth
                style={{ marginTop: theme.spacing.sm }}
                loading={exportBusy === 'evernote'}
                onPress={() => void handleEvernoteConnect()}
              />
            </>
          )}
          {evernoteConnected && (
            <Button
              title={t('settings.exportIntegrations.disconnect')}
              variant="outline"
              fullWidth
              onPress={() => void handleEvernoteDisconnect()}
            />
          )}

          <View style={{ height: theme.spacing.lg }} />

          <Text variant="label" style={{ marginBottom: theme.spacing.xs }}>
            Goodreads
          </Text>
          <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
            {goodreadsConnected
              ? t('settings.exportIntegrations.statusConnected')
              : t('settings.exportIntegrations.statusDisconnected')}
          </Text>
          {!goodreadsConnected && (
            <>
              <TextInput
                value={goodreadsTokenInput}
                onChangeText={setGoodreadsTokenInput}
                placeholder={t('settings.exportIntegrations.goodreadsTokenPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={[
                  styles.tokenInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceMuted,
                  },
                ]}
              />
              <Button
                title={t('settings.exportIntegrations.saveToken')}
                fullWidth
                style={{ marginTop: theme.spacing.sm }}
                loading={exportBusy === 'goodreads'}
                onPress={() => void handleGoodreadsConnect()}
              />
            </>
          )}
          {goodreadsConnected && (
            <Button
              title={t('settings.exportIntegrations.disconnect')}
              variant="outline"
              fullWidth
              onPress={() => void handleGoodreadsDisconnect()}
            />
          )}
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('settings.premium')}
          </Text>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>
            {isPremium ? t('settings.premiumActive') : t('settings.upgradePremium')}
          </Text>
          {!isPremium && (
            <Button title={t('premium.upgrade')} onPress={() => void handleUpgrade()} fullWidth />
          )}
          <Button
            title={t('settings.parentDashboard')}
            variant="outline"
            fullWidth
            style={{ marginTop: theme.spacing.md }}
            onPress={handleParentDashboard}
          />
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('settings.dyslexiaFilter')}
          </Text>
          <View style={styles.chipRow}>
            {(['blue', 'yellow', 'none'] as const).map((color) => (
              <Chip
                key={color}
                label={
                  color === 'blue'
                    ? t('settings.filterBlue')
                    : color === 'yellow'
                      ? t('settings.filterYellow')
                      : t('settings.filterOff')
                }
                selected={dyslexiaFilter === color}
                onPress={() => handleDyslexiaFilter(color)}
                style={{ marginRight: theme.spacing.sm, marginBottom: theme.spacing.sm }}
              />
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Language
          </Text>
          <View style={styles.chipRow}>
            {(['en', 'es'] as const).map((loc) => (
              <Chip
                key={loc}
                label={loc.toUpperCase()}
                selected={locale === loc}
                onPress={() => setLocale(loc)}
                style={{ marginRight: theme.spacing.sm }}
              />
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Personalization
          </Text>
          <Button title="Apply AI Personalization" variant="outline" fullWidth onPress={handleApplyPersonalization} />
          <Button
            title="Replay App Tour"
            variant="outline"
            fullWidth
            style={{ marginTop: theme.spacing.sm }}
            onPress={() => dispatch(startTour())}
          />
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Reading Preferences
          </Text>
          {renderSettingRow(
            'Font Family',
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginLeft: theme.spacing.sm }}>
              {fontFamilies.map((font) => (
                <Chip
                  key={font}
                  label={font}
                  selected={localPreferences.fontFamily === font}
                  onPress={() => handlePreferenceChange('fontFamily', font)}
                  style={{ marginRight: theme.spacing.sm }}
                />
              ))}
            </ScrollView>
          )}
          {renderSettingRow(
            'Font Size',
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={8}
                maximumValue={72}
                value={localPreferences.fontSize}
                onValueChange={(value: number) => handlePreferenceChange('fontSize', value)}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.borderSubtle}
                thumbTintColor={theme.colors.accent}
              />
              <Text variant="caption" color="muted" style={{ minWidth: 50, textAlign: 'right' }}>
                {Math.round(localPreferences.fontSize)}pt
              </Text>
            </View>
          )}
          <View style={[styles.settingRow, { borderBottomWidth: 0, paddingVertical: theme.spacing.md }]}>
            <Text variant="body" style={{ marginBottom: theme.spacing.sm }}>
              Theme
            </Text>
            <View style={styles.chipRow}>
              {themes.map((themeOption) => (
                <Chip
                  key={themeOption.value}
                  label={themeOption.label}
                  selected={localPreferences.theme === themeOption.value}
                  onPress={() => handlePreferenceChange('theme', themeOption.value)}
                  style={{ marginRight: theme.spacing.sm, marginBottom: theme.spacing.sm }}
                />
              ))}
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Assistive Features
          </Text>
          {renderSettingRow(
            'Text-to-Speech',
            <Switch
              value={localPreferences.ttsEnabled}
              onValueChange={(value) => handlePreferenceChange('ttsEnabled', value)}
              trackColor={{ false: theme.colors.disabled, true: theme.colors.accentMuted }}
              thumbColor={localPreferences.ttsEnabled ? theme.colors.primary : theme.colors.surface}
            />
          )}
          {renderSettingRow(
            'Eye Tracking',
            <Switch
              value={localPreferences.eyeTrackingEnabled}
              onValueChange={(value) => handlePreferenceChange('eyeTrackingEnabled', value)}
              trackColor={{ false: theme.colors.disabled, true: theme.colors.accentMuted }}
              thumbColor={localPreferences.eyeTrackingEnabled ? theme.colors.primary : theme.colors.surface}
            />
          )}
          {renderSettingRow(
            'AR Overlays',
            <Switch
              value={localPreferences.arOverlaysEnabled}
              onValueChange={(value) => handlePreferenceChange('arOverlaysEnabled', value)}
              trackColor={{ false: theme.colors.disabled, true: theme.colors.accentMuted }}
              thumbColor={localPreferences.arOverlaysEnabled ? theme.colors.primary : theme.colors.surface}
            />
          )}
          {renderSettingRow(
            'Auto Brightness',
            <Switch
              value={localPreferences.brightnessAutoAdjust}
              onValueChange={(value) => handlePreferenceChange('brightnessAutoAdjust', value)}
              trackColor={{ false: theme.colors.disabled, true: theme.colors.accentMuted }}
              thumbColor={localPreferences.brightnessAutoAdjust ? theme.colors.primary : theme.colors.surface}
            />
          )}
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Hardware
          </Text>
          <HardwareIntegrator />
        </Card>

        {localPreferences.brightnessAutoAdjust && (
          <Card style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
              Brightness
            </Text>
            <BrightnessAdjuster enabled={localPreferences.brightnessAutoAdjust} showControls />
          </Card>
        )}

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            UX Preferences
          </Text>
          {renderSettingRow(
            'Haptic Feedback',
            <Switch
              value={localUX.hapticFeedback}
              onValueChange={(value) => handleUXChange('hapticFeedback', value)}
              trackColor={{ false: theme.colors.disabled, true: theme.colors.accentMuted }}
              thumbColor={localUX.hapticFeedback ? theme.colors.primary : theme.colors.surface}
            />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sliderContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 16 },
  slider: { flex: 1, height: 40 },
  tokenInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
