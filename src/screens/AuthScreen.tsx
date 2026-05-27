import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DataService from '../services/storage/DataService';
import FamilyService from '../services/family/FamilyService';
import { Button } from '../components/common/Button';
import { logger } from '../services/logger/Logger';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { useTheme } from '../theme/useTheme';
import { useTranslation } from '../i18n';

export const AuthScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('auth.missingFields'), t('auth.enterCredentials'));
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        await DataService.signUp(email.trim(), password);
        Alert.alert(t('auth.accountCreated'), t('auth.accountCreatedMessage'));
      } else {
        await DataService.signIn(email.trim(), password);
      }
      await DataService.mergeLocalDataToCloud();
      if (inviteCode.trim() && FamilyService.isAvailable()) {
        const session = DataService.getCurrentUser();
        if (session && !session.isLocalOnly) {
          await FamilyService.acceptInvite(inviteCode.trim(), session.id);
          Alert.alert(t('auth.linked'), t('auth.linkedMessage'));
        }
      }
      navigation.goBack();
    } catch (error) {
      logger.error('Auth failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      Alert.alert(t('auth.authFailed'), error instanceof Error ? error.message : t('library.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await DataService.signOut();
      Alert.alert(t('auth.signedOut'), t('auth.signedOutMessage'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('auth.signOutFailed'), error instanceof Error ? error.message : t('library.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const session = DataService.getCurrentUser();

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
  ];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Card>
          <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
            {t('auth.title')}
          </Text>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing['2xl'] }}>
            {session?.isLocalOnly
              ? t('auth.localMode')
              : t('auth.signedIn', {
                  email: session?.email ? t('auth.signedInEmail', { email: session.email }) : '',
                })}
          </Text>

          {!session?.isLocalOnly ? (
            <Button title={t('auth.signOut')} onPress={handleSignOut} disabled={loading} fullWidth />
          ) : (
            <>
              <TextInput
                style={inputStyle}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={inputStyle}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={inputStyle}
                placeholder={t('auth.invitePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="characters"
                value={inviteCode}
                onChangeText={setInviteCode}
              />
              <Button
                title={isSignUp ? t('auth.createAccount') : t('auth.signIn')}
                onPress={handleSubmit}
                disabled={loading}
                fullWidth
              />
              <Button
                title={isSignUp ? t('auth.switchToSignIn') : t('auth.switchToSignUp')}
                variant="outline"
                onPress={() => setIsSignUp(!isSignUp)}
                disabled={loading}
                fullWidth
                style={{ marginTop: theme.spacing.sm }}
              />
            </>
          )}

          {loading && (
            <View style={{ marginTop: theme.spacing.lg, alignItems: 'center' }}>
              <LottieAnimation preset="loading" size={64} />
            </View>
          )}
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center' },
  input: {
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
  },
});
