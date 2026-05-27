import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import RealtimeService, { PresenceUser } from '../services/collaboration/RealtimeService';
import StripeService from '../services/billing/StripeService';
import DataService from '../services/storage/DataService';
import { Button } from '../components/common/Button';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { Screen } from '../components/ui/Screen';
import { AppHeader } from '../components/ui/AppHeader';
import { Text } from '../components/ui/Text';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useTheme } from '../theme/useTheme';

export const CollaborationScreen: React.FC = () => {
  const { theme } = useTheme();
  const user = useSelector((state: RootState) => state.user.profile);
  const [documentId, setDocumentId] = useState('');
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState('1');
  const cleanupRef = useRef<(() => void) | null>(null);

  const hasAccess = StripeService.canAccess('realtime_collab');
  const session = DataService.getCurrentUser();

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      RealtimeService.unsubscribe();
    };
  }, []);

  const handleJoinSession = () => {
    if (!session || session.isLocalOnly) {
      Alert.alert('Sign in required', 'Realtime collaboration requires a cloud account.');
      return;
    }
    if (!RealtimeService.isAvailable()) {
      Alert.alert('Unavailable', 'Configure Supabase to enable realtime presence.');
      return;
    }

    cleanupRef.current?.();

    RealtimeService.subscribe(
      session.id,
      documentId.trim() || undefined,
      user?.name ?? user?.email ?? 'Reader'
    );

    const offPresence = RealtimeService.onPresenceChange((users) => {
      setPresentUsers(users);
      setConnected(RealtimeService.isSubscribed());
    });

    const offReading = RealtimeService.on('reading_session', (payload) => {
      setLastEvent(`Reading update from ${payload.userId ?? 'peer'}`);
    });

    const offAnnotations = RealtimeService.on('annotations', (payload) => {
      setLastEvent(`Annotation update: ${payload.event}`);
    });

    cleanupRef.current = () => {
      offPresence();
      offReading();
      offAnnotations();
    };

    setConnected(true);
  };

  const handleBroadcastPage = async () => {
    const page = Math.max(1, parseInt(currentPage, 10) || 1);
    await RealtimeService.broadcast('reading_session', 'reading_update', {
      page,
      timestamp: Date.now(),
      userId: session?.id,
    });
    setLastEvent(`Broadcast page ${page} update sent`);
  };

  const handleLeave = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    RealtimeService.unsubscribe();
    setConnected(false);
    setPresentUsers([]);
    setLastEvent(null);
  };

  if (!hasAccess) {
    return (
      <Screen>
        <AppHeader title="Collaboration" subtitle="Premium feature" />
        <View style={{ padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
            Realtime reading sessions require Premium.
          </Text>
          <Button
            title="Upgrade"
            onPress={() => void StripeService.openCheckout(session?.id ?? 'local', session?.email)}
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppHeader title="Collaboration" subtitle="Live reading presence" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}>
        <Card style={{ marginBottom: theme.spacing.lg }}>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Document ID (optional)"
            placeholderTextColor={theme.colors.textMuted}
            value={documentId}
            onChangeText={setDocumentId}
            autoCapitalize="none"
          />
          {!connected ? (
            <Button title="Join Session" onPress={handleJoinSession} fullWidth />
          ) : (
            <>
              <Text variant="label" color="success" style={{ marginBottom: theme.spacing.md }}>
                Connected · {presentUsers.length} present
              </Text>
              <TextInput
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Page to broadcast"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={currentPage}
                onChangeText={setCurrentPage}
              />
              <Button title="Broadcast Page Update" variant="outline" onPress={() => void handleBroadcastPage()} fullWidth />
              <Button title="Leave Session" onPress={handleLeave} fullWidth style={{ marginTop: theme.spacing.sm }} />
            </>
          )}
        </Card>

        {lastEvent && (
          <Card style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>Latest Event</Text>
            <Text variant="body" color="secondary">{lastEvent}</Text>
          </Card>
        )}

        <Card>
          <Text variant="title" style={{ marginBottom: theme.spacing.md }}>Present Users</Text>
          {presentUsers.length === 0 ? (
            <EmptyState title="No other readers" description="Join a session to see live presence." />
          ) : (
            presentUsers.map((u) => (
              <View key={`${u.userId}-${u.onlineAt}`} style={styles.userRow}>
                <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
                <View>
                  <Text variant="body">{u.userName}</Text>
                  <Text variant="caption" color="muted">
                    Joined {new Date(u.onlineAt).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
});
