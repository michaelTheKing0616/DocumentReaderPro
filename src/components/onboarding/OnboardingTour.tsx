import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { setTourStep, completeTour } from '../../redux/uxSlice';
import { useTheme } from '../../theme/useTheme';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { Button } from '../common/Button';

const SPOTLIGHT_SIZE = 64;
const SPOTLIGHT_BOTTOM_OFFSET = 120;
const SPOTLIGHT_GLOW_PADDING = 8;

const TOUR_STEPS = [
  {
    id: 'library',
    title: 'Your Library',
    body: 'Import documents, organize folders, and search full text offline.',
    icon: 'library-outline' as const,
    spotlightX: 0.125,
  },
  {
    id: 'reader',
    title: 'Reader',
    body: 'Use focus mode, guided reading, TTS, and annotations while you read.',
    icon: 'book-outline' as const,
    spotlightX: 0.375,
  },
  {
    id: 'dashboard',
    title: 'Analytics',
    body: 'Track speed, engagement, and comprehension. Export CSV weekly reports.',
    icon: 'stats-chart-outline' as const,
    spotlightX: 0.625,
  },
  {
    id: 'settings',
    title: 'Personalize',
    body: 'Set dyslexia/ADHD profiles, fonts, and assistive features.',
    icon: 'settings-outline' as const,
    spotlightX: 0.875,
  },
];

interface OnboardingTourProps {
  visible: boolean;
}

function SpotlightOverlay({
  spotlightLeft,
  spotlightTop,
  spotlightSize,
}: {
  spotlightLeft: number;
  spotlightTop: number;
  spotlightSize: number;
}) {
  const { theme } = useTheme();
  const dimColor = theme.colors.overlay;
  const holeRight = spotlightLeft + spotlightSize;
  const holeBottom = spotlightTop + spotlightSize;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.dimPanel, { top: 0, left: 0, right: 0, height: spotlightTop, backgroundColor: dimColor }]} />
      <View
        style={[
          styles.dimPanel,
          { top: holeBottom, left: 0, right: 0, bottom: 0, backgroundColor: dimColor },
        ]}
      />
      <View
        style={[
          styles.dimPanel,
          {
            top: spotlightTop,
            left: 0,
            width: spotlightLeft,
            height: spotlightSize,
            backgroundColor: dimColor,
          },
        ]}
      />
      <View
        style={[
          styles.dimPanel,
          {
            top: spotlightTop,
            left: holeRight,
            right: 0,
            height: spotlightSize,
            backgroundColor: dimColor,
          },
        ]}
      />
    </View>
  );
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ visible }) => {
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const stepIndex = useSelector((state: RootState) => state.ux.currentTourStep ?? 0);
  const [localStep, setLocalStep] = useState(stepIndex);

  if (!visible) {
    return null;
  }

  const step = TOUR_STEPS[localStep] ?? TOUR_STEPS[0];
  const isLast = localStep >= TOUR_STEPS.length - 1;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const spotlightLeft = step.spotlightX * screenWidth - SPOTLIGHT_SIZE / 2;
  const spotlightTop = screenHeight - SPOTLIGHT_BOTTOM_OFFSET - SPOTLIGHT_SIZE;

  const handleNext = () => {
    if (isLast) {
      dispatch(completeTour());
      return;
    }
    const next = localStep + 1;
    setLocalStep(next);
    dispatch(setTourStep(next));
  };

  const handleSkip = () => {
    dispatch(completeTour());
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <SpotlightOverlay
          spotlightLeft={spotlightLeft}
          spotlightTop={spotlightTop}
          spotlightSize={SPOTLIGHT_SIZE}
        />

        <View
          style={[
            styles.spotlightRing,
            {
              top: spotlightTop - SPOTLIGHT_GLOW_PADDING,
              left: spotlightLeft - SPOTLIGHT_GLOW_PADDING,
              width: SPOTLIGHT_SIZE + SPOTLIGHT_GLOW_PADDING * 2,
              height: SPOTLIGHT_SIZE + SPOTLIGHT_GLOW_PADDING * 2,
              borderRadius: (SPOTLIGHT_SIZE + SPOTLIGHT_GLOW_PADDING * 2) / 2,
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.surfaceElevated,
            },
            theme.shadows.lg,
          ]}
        >
          <Ionicons name={step.icon} size={28} color={theme.colors.primary} />
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.spotlightGlow,
            {
              top: spotlightTop - SPOTLIGHT_GLOW_PADDING - 4,
              left: spotlightLeft - SPOTLIGHT_GLOW_PADDING - 4,
              width: SPOTLIGHT_SIZE + SPOTLIGHT_GLOW_PADDING * 2 + 8,
              height: SPOTLIGHT_SIZE + SPOTLIGHT_GLOW_PADDING * 2 + 8,
              borderRadius: (SPOTLIGHT_SIZE + SPOTLIGHT_GLOW_PADDING * 2 + 8) / 2,
              borderColor: theme.colors.focus,
            },
          ]}
        />

        <Card
          style={[
            styles.card,
            {
              maxWidth: screenWidth - theme.spacing['2xl'] * 2,
              marginHorizontal: theme.spacing.lg,
              marginBottom: theme.spacing['3xl'],
            },
          ]}
          elevated
        >
          <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
            Step {localStep + 1} of {TOUR_STEPS.length}
          </Text>
          <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
            {step.title}
          </Text>
          <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing['2xl'], lineHeight: 22 }}>
            {step.body}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleSkip} accessibilityRole="button" accessibilityLabel="Skip tour">
              <Text variant="body" color="muted">
                Skip tour
              </Text>
            </TouchableOpacity>
            <Button title={isLast ? 'Done' : 'Next'} onPress={handleNext} />
          </View>
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dimPanel: {
    position: 'absolute',
  },
  spotlightRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    zIndex: 2,
  },
  spotlightGlow: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.55,
    zIndex: 1,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    zIndex: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default OnboardingTour;
