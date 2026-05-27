import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { GamificationBadge } from '../components/assistive/GamificationBadge';
import DataService from '../services/storage/DataService';
import LessonProgressService from '../services/lessons/LessonProgressService';
import FamilyService, { LinkedChildStats, ReadingAssignment } from '../services/family/FamilyService';
import {
  CURRICULUM_LESSONS,
  CURRICULUM_TOTAL_HOURS,
  CURRICULUM_MODULES,
} from '../services/lessons/curriculum';
import StripeService from '../services/billing/StripeService';
import { Button } from '../components/common/Button';
import { useTranslation } from '../i18n';
import { logger } from '../services/logger/Logger';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { useTheme } from '../theme/useTheme';

export const ParentDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const user = useSelector((state: RootState) => state.user.profile);
  const gamification = useSelector((state: RootState) => state.gamification);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [avgComprehension, setAvgComprehension] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChildStats[]>([]);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ReadingAssignment[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignChildId, setAssignChildId] = useState('');
  const [assignTitle, setAssignTitle] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');

  const isParent = user?.role === 'parent' || user?.role === 'teacher';
  const hasAccess = StripeService.canAccess('parent_dashboard') || isParent;
  const session = DataService.getCurrentUser();
  const parentId = session?.isLocalOnly ? null : session?.id;

  useEffect(() => {
    void loadChildSummary();
  }, []);

  const loadChildSummary = async (): Promise<void> => {
    try {
      const progress = await LessonProgressService.getProgressForUser();
      const completed = Array.from(progress.values()).filter((p) => p.completed).length;
      setLessonsCompleted(completed);

      const metrics = await DataService.getReadingMetrics();
      if (metrics.length > 0) {
        const scores = metrics
          .map((m) => m.comprehensionScore)
          .filter((s): s is number => s != null);
        if (scores.length > 0) {
          setAvgComprehension(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
      }

      if (parentId && FamilyService.isAvailable()) {
        const children = await FamilyService.getLinkedChildren(parentId);
        setLinkedChildren(children);
        const parentAssignments = await FamilyService.getAssignmentsForParent(parentId);
        setAssignments(parentAssignments);
      }
    } catch (error) {
      logger.error('Parent dashboard load failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!parentId) {
      Alert.alert(t('parentDashboardAlerts.signInRequired'), t('parentDashboardAlerts.signInRequiredMessage'));
      return;
    }
    try {
      const link = await FamilyService.createInvite(parentId);
      setPendingInviteCode(link.inviteCode ?? null);
      Alert.alert(
        t('parentDashboardAlerts.inviteCode'),
        t('parentDashboardAlerts.inviteCodeMessage', { code: link.inviteCode ?? '' })
      );
    } catch (error) {
      Alert.alert(
        t('parentDashboardAlerts.inviteFailed'),
        error instanceof Error ? error.message : t('library.tryAgain')
      );
    }
  };

  const handleCreateAssignment = async () => {
    if (!parentId || !assignChildId.trim() || !assignTitle.trim()) {
      Alert.alert(t('parentDashboardAlerts.missingFields'), t('parentDashboardAlerts.missingFieldsMessage'));
      return;
    }
    try {
      const created = await FamilyService.createAssignment(parentId, assignChildId.trim(), {
        title: assignTitle.trim(),
        instructions: assignInstructions.trim() || undefined,
      });
      setAssignments((prev) => [created, ...prev]);
      setShowAssignModal(false);
      setAssignTitle('');
      setAssignInstructions('');
      Alert.alert(
        t('parentDashboardAlerts.assignmentCreated'),
        t('parentDashboardAlerts.assignmentCreatedMessage', { title: created.title })
      );
    } catch (error) {
      Alert.alert(
        t('parentDashboardAlerts.assignmentFailed'),
        error instanceof Error ? error.message : t('library.tryAgain')
      );
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
  };

  if (!hasAccess) {
    return (
      <Screen>
        <Text variant="title" style={{ marginBottom: theme.spacing.lg }}>
          {t('parentDashboard.title')}
        </Text>
        <Card style={{ backgroundColor: theme.colors.warningMuted, alignItems: 'center' }}>
          <Text variant="body" color="secondary" style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
            {t('premium.parentDashboardLocked')}
          </Text>
          <Button
            title={t('premium.upgrade')}
            onPress={() => {
              void StripeService.openCheckout(user?.id ?? 'local', user?.email).then((opened) => {
                if (!opened) {
                  Alert.alert(t('premium.title'), t('premium.checkoutUnavailable'));
                }
              });
            }}
          />
        </Card>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <LottieAnimation preset="loading" size={80} />
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.lg }}>
            {t('common.loading')}
          </Text>
        </View>
      </Screen>
    );
  }

  const lessonProgressPct = Math.round((lessonsCompleted / CURRICULUM_LESSONS.length) * 100);

  return (
    <Screen padded={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
      >
        <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
          {t('parentDashboard.title')}
        </Text>
        <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing['2xl'] }}>
          {t('parentDashboard.subtitle')}
        </Text>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            Family Links
          </Text>
          <Button title="Generate Invite Code" onPress={() => void handleGenerateInvite()} fullWidth />
          {pendingInviteCode && (
            <Text variant="body" color="accent" style={{ marginTop: theme.spacing.md, textAlign: 'center' }}>
              Latest code: {pendingInviteCode}
            </Text>
          )}
          {linkedChildren.length === 0 ? (
            <Text variant="body" color="muted" style={{ marginTop: theme.spacing.md }}>
              No linked readers yet. Share an invite code.
            </Text>
          ) : (
            linkedChildren.map((child) => (
              <View
                key={child.childId}
                style={[styles.childRow, { borderTopColor: theme.colors.borderSubtle }]}
              >
                <Text variant="body" style={{ fontWeight: '600', marginBottom: theme.spacing.sm }}>
                  {child.childDisplayName ?? `Reader ${child.childId.slice(0, 8)}`}
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text variant="title" color="accent">
                      {child.points}
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('dashboard.points')}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text variant="title" color="accent">
                      {child.streaks.current}
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('dashboard.streak')}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text variant="title" color="accent">
                      {Math.round(child.avgComprehension30d)}%
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('parentDashboard.comprehension')}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text variant="title" color="accent">
                      {child.sessions7d}
                    </Text>
                    <Text variant="caption" color="muted">
                      7d sessions
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
          {linkedChildren.length > 0 && (
            <Button
              title="Create Reading Assignment"
              variant="outline"
              onPress={() => {
                setAssignChildId(linkedChildren[0]?.childId ?? '');
                setShowAssignModal(true);
              }}
              fullWidth
              style={{ marginTop: theme.spacing.md }}
            />
          )}
        </Card>

        {assignments.length > 0 && (
          <Card style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
              Assignments
            </Text>
            {assignments.map((a) => (
              <View key={a.id} style={[styles.moduleRow, { borderBottomColor: theme.colors.borderSubtle }]}>
                <Text variant="body" style={{ fontWeight: '500' }}>
                  {a.title}
                </Text>
                <Text variant="caption" color="muted">
                  {a.status} · child {a.childId.slice(0, 8)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('parentDashboard.readingProgress')}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text variant="title" color="accent">
                {gamification.points}
              </Text>
              <Text variant="caption" color="muted">
                {t('dashboard.points')}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="title" color="accent">
                {gamification.streaks.current}
              </Text>
              <Text variant="caption" color="muted">
                {t('dashboard.streak')}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="title" color="accent">
                {Math.round(avgComprehension)}%
              </Text>
              <Text variant="caption" color="muted">
                {t('parentDashboard.comprehension')}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('parentDashboard.curriculum')}
          </Text>
          <Text variant="body" color="muted" style={{ marginBottom: theme.spacing.sm }}>
            {lessonsCompleted}/{CURRICULUM_LESSONS.length} lessons · {CURRICULUM_TOTAL_HOURS}h program
          </Text>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.borderSubtle, borderRadius: theme.radius.sm }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${lessonProgressPct}%`,
                  backgroundColor: theme.colors.success,
                  borderRadius: theme.radius.sm,
                },
              ]}
            />
          </View>
          <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
            {lessonProgressPct}% complete
          </Text>
        </Card>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('parentDashboard.modules')}
          </Text>
          {CURRICULUM_MODULES.map((mod) => (
            <View key={mod.id} style={[styles.moduleRow, { borderBottomColor: theme.colors.borderSubtle }]}>
              <Text variant="body" style={{ fontWeight: '500' }}>
                {mod.title}
              </Text>
              <Text variant="caption" color="muted">
                {mod.targetHours}h · {mod.lessons.length} lessons
              </Text>
            </View>
          ))}
        </Card>

        {gamification.badges.length > 0 && (
          <Card style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
              {t('dashboard.badges')}
            </Text>
            <View style={styles.badgesRow}>
              {gamification.badges.map((badge) => (
                <GamificationBadge key={badge.id} badge={badge} size="small" />
              ))}
            </View>
          </Card>
        )}

        <Modal visible={showAssignModal} transparent animationType="slide">
          <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
            <Card style={styles.modalContent}>
              <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.lg }}>
                New Assignment
              </Text>
              {linkedChildren.length > 1 && (
                <TextInput
                  style={inputStyle}
                  placeholder="Child user ID"
                  placeholderTextColor={theme.colors.textMuted}
                  value={assignChildId}
                  onChangeText={setAssignChildId}
                />
              )}
              <TextInput
                style={inputStyle}
                placeholder="Assignment title"
                placeholderTextColor={theme.colors.textMuted}
                value={assignTitle}
                onChangeText={setAssignTitle}
              />
              <TextInput
                style={[inputStyle, styles.inputMultiline]}
                placeholder="Instructions (optional)"
                placeholderTextColor={theme.colors.textMuted}
                value={assignInstructions}
                onChangeText={setAssignInstructions}
                multiline
              />
              <Button title="Create" onPress={() => void handleCreateAssignment()} fullWidth />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowAssignModal(false)}
                fullWidth
                style={{ marginTop: theme.spacing.sm }}
              />
            </Card>
          </View>
        </Modal>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  childRow: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  progressBar: { height: 8, overflow: 'hidden' },
  progressFill: { height: '100%' },
  moduleRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24 },
  modalContent: { width: '100%' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
});
