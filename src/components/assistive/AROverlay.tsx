import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AROverlay as AROverlayType } from '../../types';

interface AROverlayProps {
  overlay: AROverlayType;
  onClose?: (id: string) => void;
}

export const AROverlay: React.FC<AROverlayProps> = ({ overlay, onClose }) => {
  if (!overlay.visible) return null;

  const renderContent = () => {
    switch (overlay.type) {
      case 'definition':
        return (
          <View style={styles.definitionContainer}>
            <Text style={styles.definitionText}>{overlay.content as string}</Text>
            {onClose && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => onClose(overlay.id)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      case 'filter': {
        const content = overlay.content;
        const color =
          typeof content === 'string'
            ? content
            : typeof content === 'object' && content !== null && 'color' in content
              ? String((content as { color: string }).color)
              : 'blue';
        const rgba =
          typeof content === 'object' && content !== null && 'rgba' in content
            ? String((content as { rgba: string }).rgba)
            : color === 'blue'
              ? 'rgba(33, 150, 243, 0.35)'
              : 'rgba(255, 235, 59, 0.35)';
        const lineHeight =
          typeof content === 'object' && content !== null && 'lineHeight' in content
            ? Number((content as { lineHeight: number }).lineHeight)
            : 32;
        return (
          <View
            style={[
              styles.filterContainer,
              {
                backgroundColor: rgba,
                width: typeof content === 'object' && (content as { mode?: string }).mode === 'overlay' ? '100%' : '100%',
                height: typeof content === 'object' && (content as { mode?: string }).mode === 'line-strip' ? lineHeight : 30,
              },
            ]}
          />
        );
      }
      case 'animation':
        return (
          <View style={styles.animationContainer}>
            <Text style={styles.animationText}>✨</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          left: overlay.position.x,
          top: overlay.position.y,
        },
      ]}
    >
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  definitionContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: 200,
  },
  definitionText: {
    fontSize: 14,
    color: '#000000',
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#000000',
  },
  filterContainer: {
    width: 100,
    height: 30,
    borderRadius: 4,
  },
  animationContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationText: {
    fontSize: 24,
  },
});

