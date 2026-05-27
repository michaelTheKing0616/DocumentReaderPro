import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useGamification } from '../../hooks/useGamification';
import LessonProgressService from '../../services/lessons/LessonProgressService';
import { CurriculumLesson } from '../../services/lessons/curriculum';
import { FluencyGame } from './FluencyGame';
import { VocabularyGame } from './VocabularyGame';
import { ComprehensionGame } from './ComprehensionGame';
import { PhonemicGame } from './PhonemicGame';
import { SyllableGame } from './SyllableGame';
import { WordMatchingGame } from './WordMatchingGame';
import { HPatternGame } from '../../components/lessons/HPatternGame';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/common/Button';
import { useTheme } from '../../theme/useTheme';

export type LessonGameStackParamList = {
  LessonGame: { lesson: CurriculumLesson };
};

type Props = NativeStackScreenProps<LessonGameStackParamList, 'LessonGame'>;

export const LessonGameScreen: React.FC<Props> = ({ route, navigation }) => {
  const { lesson } = route.params;
  const { theme } = useTheme();
  const user = useSelector((state: RootState) => state.user.profile);
  const { awardPoints, checkBadges } = useGamification();

  const preferences = user?.preferences ?? {
    fontSize: 16,
    fontFamily: 'System',
    lineSpacing: 1.5,
    theme: 'light' as const,
    ttsEnabled: true,
    ttsSpeed: 150,
    eyeTrackingEnabled: false,
    arOverlaysEnabled: false,
    brightnessAutoAdjust: false,
  };

  const handleProgress = useCallback(
    (progress: number) => {
      void LessonProgressService.updateProgress(lesson.id, progress);
    },
    [lesson.id]
  );

  const handleComplete = useCallback(
    async (score: number) => {
      const points = 50;
      await LessonProgressService.markCompleted(lesson.id, score);
      awardPoints(points);
      checkBadges({ pagesRead: 0, quizzesCompleted: 1, regressions: 0, streaks: 0 });
      Alert.alert('Lesson Complete!', `Score: ${score}% · +${points} points`);
      navigation.goBack();
    },
    [lesson.id, awardPoints, checkBadges, navigation]
  );

  const renderGame = () => {
    switch (lesson.type) {
      case 'fluency':
        return (
          <FluencyGame
            preferences={preferences}
            onComplete={(score) => void handleComplete(score)}
            onProgress={handleProgress}
          />
        );
      case 'vocabulary':
        return (
          <VocabularyGame
            preferences={preferences}
            onComplete={(score) => void handleComplete(score)}
            onProgress={handleProgress}
          />
        );
      case 'comprehension':
        return (
          <ComprehensionGame
            onComplete={(score) => void handleComplete(score)}
            onProgress={handleProgress}
          />
        );
      case 'h-pattern':
        return (
          <HPatternGame
            onComplete={(score) => void handleComplete(score)}
            onProgress={handleProgress}
          />
        );
      case 'phonemic':
        return (
          <PhonemicGame
            preferences={preferences}
            onComplete={(score) => void handleComplete(score)}
            onProgress={handleProgress}
          />
        );
      case 'syllable':
        return (
          <SyllableGame
            preferences={preferences}
            onComplete={(score) => void handleComplete(score)}
            onProgress={handleProgress}
          />
        );
      case 'word-matching':
        return (
          <WordMatchingGame
            onComplete={(score) => void handleComplete(score)}
            onProgress={handleProgress}
          />
        );
      default:
        return (
          <View style={[styles.fallback, { padding: theme.spacing.xl }]}>
            <Text variant="body" color="secondary" style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
              Unknown lesson type: {lesson.type}
            </Text>
            <Button title="Go Back" onPress={() => navigation.goBack()} fullWidth />
          </View>
        );
    }
  };

  return (
    <Screen padded={false}>
      <AppHeader title={lesson.title} subtitle={lesson.type.replace('-', ' ')} />
      {renderGame()}
    </Screen>
  );
};

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center' },
});
