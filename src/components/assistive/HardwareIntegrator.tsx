import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useDispatch } from 'react-redux';
import { useHardwareIntegration } from '../../hooks/useHardwareIntegration';
import { HardwareType } from '../../types';
import { setHardwareType } from '../../redux/settingsSlice';
import { Button } from '../common/Button';
import { Text } from '../ui/Text';
import { useTheme } from '../../theme/useTheme';

export const HardwareIntegrator: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const {
    hardwareType,
    config,
    isConnecting,
    isConnected,
    connect,
    disconnect,
    discoverDevices,
  } = useHardwareIntegration();
  const [discoveredDevices, setDiscoveredDevices] = useState<string[]>([]);

  const hardwareTypes: { type: HardwareType; label: string }[] = [
    { type: 'pupil-labs', label: 'Pupil Labs' },
    { type: 'tobii', label: 'Tobii' },
    { type: 'eyelink', label: 'EyeLink' },
    { type: 'smi', label: 'SMI' },
    { type: 'gazepoint', label: 'Gazepoint' },
    { type: 'gazesense', label: 'GazeSense' },
    { type: 'webgazer', label: 'WebGazer (Webcam)' },
  ];

  const handleDiscover = async () => {
    const devices = await discoverDevices();
    setDiscoveredDevices(devices);
  };

  const handleConnect = async (type: HardwareType) => {
    let connected = false;
    if (type === 'pupil-labs' && discoveredDevices.length > 0) {
      connected = await connect(type, discoveredDevices[0]);
    } else {
      connected = await connect(type);
    }
    if (connected) {
      dispatch(setHardwareType(type));
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="title" style={styles.title}>Hardware Integration</Text>
      
      {hardwareType !== 'none' && (
        <View style={styles.statusContainer}>
          <Text variant="body">
            Current: {hardwareTypes.find((h) => h.type === hardwareType)?.label}
          </Text>
          <Text variant="body" style={{ color: isConnected ? theme.colors.success : theme.colors.error }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
          {isConnected && (
            <Button
              title="Disconnect"
              onPress={() => {
                void disconnect();
                dispatch(setHardwareType('none'));
              }}
              variant="outline"
            />
          )}
        </View>
      )}

      {hardwareType === 'pupil-labs' && (
        <View style={styles.discoverContainer}>
          <Button title="Discover Devices" onPress={handleDiscover} />
          {discoveredDevices.length > 0 && (
            <FlatList
              data={discoveredDevices}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceItem}
                  onPress={() => void connect('pupil-labs', item)}
                >
                  <Text variant="body">{item}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      <View style={styles.hardwareList}>
        {hardwareTypes.map((hardware) => (
          <TouchableOpacity
            key={hardware.type}
            style={[
              styles.hardwareItem,
              {
                borderColor: theme.colors.border,
              },
              hardwareType === hardware.type && {
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
            onPress={() => void handleConnect(hardware.type)}
            disabled={isConnecting}
          >
            <Text variant="body">{hardware.label}</Text>
            {isConnecting && hardwareType === hardware.type && (
              <Text variant="caption" color="muted">Connecting...</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    marginBottom: 16,
  },
  statusContainer: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 16,
    gap: 4,
  },
  discoverContainer: {
    marginBottom: 16,
  },
  deviceItem: {
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    marginTop: 8,
  },
  hardwareList: {
    marginTop: 8,
  },
  hardwareItem: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
});

