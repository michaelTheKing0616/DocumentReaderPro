import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import LessonProgressService from '../services/lessons/LessonProgressService';
import {
  CURRICULUM_MODULES,
  CURRICULUM_LESSONS,
  CURRICULUM_TOTAL_HOURS,
  CurriculumLesson,
} from '../services/lessons/curriculum';
import { useTranslation } from '../i18n';
import { logger } from '../services/logger/Logger';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { Chip } from '../components/ui/Chip';
import { useTheme } from '../theme/useTheme';

interface LessonWithProgress extends CurriculumLesson {
  completed: boolean;
  progress: number;
}

export const LessonsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [expandedModule, setExpandedModule] = useState<string | null>(CURRICULUM_MODULES[0]?.id ?? null);

  const loadProgress = useCallback(async () => {
    try {
      const progressMap = await LessonProgressService.getProgressForUser();
      setLessons(
        CURRICULUM_LESSONS.map((lesson) => {
          const saved = progressMap.get(lesson.id);
          return {
            ...lesson,
            completed: saved?.completed ?? false,
            progress: saved?.progress ?? 0,
          };
        })
      );
    } catch (error) {
      logger.error('Failed to load lesson progress', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress])
  );

  const startLesson = (lesson: LessonWithProgress) => {
    navigation.navigate('LessonGame', { lesson });
  };

  const completedCount = lessons.filter((l) => l.completed).length;

  return (
    <Screen padded={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
      >
        <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
          {t('lessons.title')}
        </Text>
        <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
          {t('lessons.subtitle')}
        </Text>
        <Text variant="caption" color="accent" style={{ marginBottom: theme.spacing['2xl'] }}>
          {t('lessons.curriculumHours', { hours: CURRICULUM_TOTAL_HOURS })} · {completedCount}/
          {CURRICULUM_LESSONS.length} {t('lessons.completed').toLowerCase()}
        </Text>

        {CURRICULUM_MODULES.map((mod) => {
          const modLessons = lessons.filter((l) => l.moduleId === mod.id);
          const isExpanded = expandedModule === mod.id;
          return (
            <Card key={mod.id} style={{ marginBottom: theme.spacing.lg, padding: 0 }} elevated>
              <TouchableOpacity
                style={[
                  styles.moduleHeader,
                  { backgroundColor: theme.colors.surfaceMuted, padding: theme.spacing.lg },
                ]}
                onPress={() => setExpandedModule(isExpanded ? null : mod.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={styles.moduleHeaderContent}>
                  <Text variant="title" style={{ fontSize: 18 }}>
                    {t('lessons.module')} {mod.order}: {mod.title}
                  </Text>
                  <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
                    {mod.description}
                  </Text>
                  <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.xs }}>
                    {mod.targetHours}h · {mod.lessons.length} lessons
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              {isExpanded &&
                modLessons.map((lesson) => (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[
                      styles.lessonRow,
                      { borderTopColor: theme.colors.borderSubtle, padding: theme.spacing.lg },
                    ]}
                    onPress={() => startLesson(lesson)}
                  >
                    <View style={styles.lessonHeader}>
                      <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>
                        {lesson.title}
                      </Text>
                      <Text variant="caption" color="muted">
                        {Math.round(lesson.duration)} min
                      </Text>
                    </View>
                    <Text variant="caption" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
                      {lesson.description}
                    </Text>
                    {lesson.progress > 0 && (
                      <View
                        style={[
                          styles.progressBar,
                          { backgroundColor: theme.colors.borderSubtle, borderRadius: theme.radius.sm },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${lesson.progress}%`,
                              backgroundColor: theme.colors.primary,
                              borderRadius: theme.radius.sm,
                            },
                          ]}
                        />
                      </View>
                    )}
                    {lesson.completed && (
                      <Chip
                        label={t('lessons.completed')}
                        style={{ marginTop: theme.spacing.sm, backgroundColor: theme.colors.successMuted }}
                      />
                    )}
                  </TouchableOpacity>
                ))}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleHeaderContent: { flex: 1, marginRight: 12 },
  lessonRow: { borderTopWidth: StyleSheet.hairlineWidth },
  lessonHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressBar: { height: 4, overflow: 'hidden' },
  progressFill: { height: '100%' },
});
