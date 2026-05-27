import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from '../../types';

interface GamificationBadgeProps {
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
}

export const GamificationBadge: React.FC<GamificationBadgeProps> = ({
  badge,
  size = 'medium',
}) => {
  const sizeStyles = {
    small: { width: 40, height: 40, fontSize: 20 },
    medium: { width: 60, height: 60, fontSize: 30 },
    large: { width: 80, height: 80, fontSize: 40 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={[styles.container, { width: currentSize.width, height: currentSize.height }]}>
      <Text style={[styles.icon, { fontSize: currentSize.fontSize }]}>
        {badge.icon}
      </Text>
      {size !== 'small' && (
        <Text style={styles.name} numberOfLines={1}>
          {badge.name}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    margin: 4,
  },
  icon: {
    textAlign: 'center',
  },
  name: {
    fontSize: 10,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
});

