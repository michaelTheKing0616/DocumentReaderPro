import React from 'react';
import { View, StyleSheet, Slider } from 'react-native';
import { useBrightnessModulation } from '../../hooks/useBrightnessModulation';
import { Text } from '../ui/Text';
import { useTheme } from '../../theme/useTheme';

interface BrightnessAdjusterProps {
  enabled: boolean;
  showControls?: boolean;
}

export const BrightnessAdjuster: React.FC<BrightnessAdjusterProps> = ({
  enabled,
  showControls = false,
}) => {
  const { theme } = useTheme();
  const { currentBrightness, setBaseBrightness, setAutoAdjust } = useBrightnessModulation(enabled);

  React.useEffect(() => {
    setAutoAdjust(enabled);
  }, [enabled, setAutoAdjust]);

  if (!showControls) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text variant="label">Brightness</Text>
      <Slider
        style={styles.slider}
        minimumValue={0.1}
        maximumValue={1}
        value={currentBrightness}
        onValueChange={setBaseBrightness}
        minimumTrackTintColor={theme.colors.primary}
        maximumTrackTintColor={theme.colors.borderSubtle}
      />
      <Text variant="caption" color="muted">{Math.round(currentBrightness * 100)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  value: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
  },
});

