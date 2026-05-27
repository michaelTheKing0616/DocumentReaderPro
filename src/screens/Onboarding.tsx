import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Switch } from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { setProfile, setChallenges } from '../redux/userSlice';
import { setOnboardingComplete } from '../redux/uxSlice';
import { Button } from '../components/common/Button';
import { UserProfile, ReadingChallenge } from '../types';
import DataService from '../services/storage/DataService';
import { generateIdSync } from '../utils/id';
import InterventionEngine from '../services/intervention/InterventionEngine';
import { logger } from '../services/logger/Logger';
import { useTranslation } from '../i18n';
import { Screen } from '../components/ui/Screen';
import { Text } from '../components/ui/Text';
import { Card } from '../components/ui/Card';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { useTheme } from '../theme/useTheme';

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [dyslexia, setDyslexia] = useState(false);
  const [adhd, setAdhd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const selectedChallenges: ReadingChallenge[] = [];
      if (dyslexia) selectedChallenges.push('dyslexia');
      if (adhd) selectedChallenges.push('adhd');
      if (selectedChallenges.length === 0) selectedChallenges.push('none');

      dispatch(setChallenges(selectedChallenges));

      const user = DataService.getCurrentUser();
      const dyslexiaDefaults = InterventionEngine.getProfileDefaults(selectedChallenges);
      const profile: UserProfile = {
        id: user?.id ?? `local-${generateIdSync()}`,
        email: user?.email,
        challenges: selectedChallenges,
        preferences: {
          fontSize: dyslexia ? 18 : 16,
          fontFamily: dyslexiaDefaults.fontFamily ?? (dyslexia ? 'OpenDyslexic' : 'System'),
          lineSpacing: dyslexiaDefaults.lineSpacing ?? (dyslexia ? 1.5 : 1.2),
          theme: 'light',
          ttsEnabled: false,
          ttsSpeed: dyslexiaDefaults.ttsSpeed ?? 150,
          eyeTrackingEnabled: false,
          arOverlaysEnabled: dyslexia,
          brightnessAutoAdjust: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await DataService.saveUserProfile(profile);
      dispatch(setProfile(profile));
      dispatch(setOnboardingComplete(true));
      navigation.navigate('Calibration' as never);
    } catch (error) {
      logger.error('Onboarding error', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.spacing.xl }]}>
        <View style={styles.hero}>
          <LottieAnimation preset="success" size={120} />
          <Text variant="display" style={{ textAlign: 'center', marginTop: theme.spacing.lg }}>
            {t('onboarding.welcome')}
          </Text>
          <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.sm }}>
            {t('onboarding.subtitle')}
          </Text>
        </View>

        <Card style={{ marginBottom: theme.spacing.xl }}>
          <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
            {t('onboarding.challengesTitle')}
          </Text>
          <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.lg }}>
            {t('onboarding.challengesDescription')}
          </Text>

          <View style={[styles.switchRow, { borderBottomColor: theme.colors.borderSubtle }]}>
            <Text variant="body">{t('onboarding.dyslexia')}</Text>
            <Switch
              value={dyslexia}
              onValueChange={setDyslexia}
              trackColor={{ false: theme.colors.border, true: theme.colors.accentMuted }}
              thumbColor={dyslexia ? theme.colors.primary : theme.colors.surface}
            />
          </View>

          <View style={styles.switchRow}>
            <Text variant="body">{t('onboarding.adhd')}</Text>
            <Switch
              value={adhd}
              onValueChange={setAdhd}
              trackColor={{ false: theme.colors.border, true: theme.colors.accentMuted }}
              thumbColor={adhd ? theme.colors.primary : theme.colors.surface}
            />
          </View>
        </Card>

        <Button
          title={t('onboarding.continue')}
          onPress={() => void handleComplete()}
          loading={loading}
          fullWidth
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 24 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
