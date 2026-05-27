import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { AnalyticsData } from '../../types';

interface HeatmapProps {
  data: AnalyticsData;
}

export const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  const screenWidth = Dimensions.get('window').width;
  const gridSize = 20;
  const cellSize = (screenWidth - 40) / gridSize;

  // Create grid from heatmap data
  const grid: number[][] = Array(gridSize)
    .fill(0)
    .map(() => Array(gridSize).fill(0));

  data.heatmap.forEach((point) => {
    const x = Math.floor((point.x / screenWidth) * gridSize);
    const y = Math.floor((point.y / Dimensions.get('window').height) * gridSize);
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      grid[y][x] = Math.max(grid[y][x], point.intensity);
    }
  });

  const getColor = (intensity: number) => {
    if (intensity === 0) return '#FFFFFF';
    if (intensity < 0.25) return '#E3F2FD';
    if (intensity < 0.5) return '#90CAF9';
    if (intensity < 0.75) return '#42A5F5';
    return '#1976D2';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gaze Heatmap</Text>
      <View style={styles.heatmapContainer}>
        {grid.map((row, y) => (
          <View key={y} style={styles.row}>
            {row.map((intensity, x) => (
              <View
                key={`${x}-${y}`}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getColor(intensity),
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Low</Text>
        <View style={styles.legendGradient}>
          <View style={[styles.legendColor, { backgroundColor: '#E3F2FD' }]} />
          <View style={[styles.legendColor, { backgroundColor: '#90CAF9' }]} />
          <View style={[styles.legendColor, { backgroundColor: '#42A5F5' }]} />
          <View style={[styles.legendColor, { backgroundColor: '#1976D2' }]} />
        </View>
        <Text style={styles.legendText}>High</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  heatmapContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendText: {
    fontSize: 12,
    color: '#666666',
    marginHorizontal: 8,
  },
  legendGradient: {
    flexDirection: 'row',
  },
  legendColor: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
});

