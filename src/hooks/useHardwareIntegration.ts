import { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { HardwareType, HardwareConfig, GazePoint } from '../types';
import { RootState } from '../redux/store';
import { setHardwareType as setHardwareTypeAction } from '../redux/settingsSlice';
import PupilService from '../services/hardware/PupilService';
import TobiiService from '../services/hardware/TobiiService';
import EyeLinkService from '../services/hardware/EyeLinkService';
import SMIService from '../services/hardware/SMIService';
import GazepointService from '../services/hardware/GazepointService';
import GazeSenseService from '../services/hardware/GazeSenseService';
import BeamService from '../services/hardware/BeamService';
import HardwareGazeAdapter from '../services/hardware/HardwareGazeAdapter';
import EyeService from '../services/eye/EyeService';

export const useHardwareIntegration = () => {
  const dispatch = useDispatch();
  const hardwareType = useSelector((state: RootState) => state.settings.hardwareType);
  const [config, setConfig] = useState<HardwareConfig | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [gazeCallback, setGazeCallback] = useState<((point: GazePoint) => void) | null>(null);

  const getService = useCallback((type: HardwareType) => {
    switch (type) {
      case 'pupil-labs':
        return PupilService;
      case 'tobii':
        return TobiiService;
      case 'eyelink':
        return EyeLinkService;
      case 'smi':
        return SMIService;
      case 'gazepoint':
        return GazepointService;
      case 'gazesense':
        return GazeSenseService;
      case 'webgazer':
        return BeamService;
      default:
        return null;
    }
  }, []);

  const connect = useCallback(
    async (type: HardwareType, address?: string, port?: number) => {
      setIsConnecting(true);
      try {
        if (type === 'webgazer' || type === 'none') {
          HardwareGazeAdapter.setPreferredHardware(type === 'none' ? 'webgazer' : type);
          EyeService.setPreferredHardware(type === 'none' ? 'webgazer' : type);
          dispatch(setHardwareTypeAction(type === 'none' ? 'webgazer' : type));
          setConfig({
            type: 'webgazer',
            connected: true,
          });
          return true;
        }

        const service = getService(type);
        if (!service) {
          throw new Error('Unsupported hardware type');
        }

        let connected = false;
        if (type === 'pupil-labs' && address) {
          connected = await service.connect(address, port);
        } else if (type === 'gazepoint' && port) {
          connected = await service.connect(port);
        } else if (type === 'gazesense' && address) {
          connected = await service.connect(address);
        } else {
          connected = await service.connect();
        }

        if (connected) {
          HardwareGazeAdapter.setPreferredHardware(type);
          EyeService.setPreferredHardware(type);
          dispatch(setHardwareTypeAction(type));
          setConfig(service.getConfig());

          if (gazeCallback) {
            service.setGazeCallback(gazeCallback);
          }
        }

        return connected;
      } catch (error) {
        console.error('Hardware connection error:', error);
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [dispatch, getService, gazeCallback]
  );

  const disconnect = useCallback(async () => {
    const service = getService(hardwareType);
    if (service) {
      await service.disconnect();
    }
    HardwareGazeAdapter.setPreferredHardware('none');
    EyeService.setPreferredHardware('none');
    dispatch(setHardwareTypeAction('none'));
    setConfig(null);
  }, [dispatch, hardwareType, getService]);

  const setGazeHandler = useCallback(
    (callback: (point: GazePoint) => void) => {
      setGazeCallback(() => callback);
      const service = getService(hardwareType);
      if (service && service.isDeviceConnected()) {
        service.setGazeCallback(callback);
      }
    },
    [hardwareType, getService]
  );

  const discoverDevices = useCallback(async () => {
    if (hardwareType === 'pupil-labs') {
      return PupilService.discoverDevices();
    }
    return [];
  }, [hardwareType]);

  const isConnected = useCallback(() => {
    if (hardwareType === 'webgazer') {
      return true;
    }
    const service = getService(hardwareType);
    return service ? service.isDeviceConnected() : false;
  }, [hardwareType, getService]);

  return {
    hardwareType,
    config,
    isConnecting,
    isConnected: isConnected(),
    connect,
    disconnect,
    setGazeHandler,
    discoverDevices,
  };
};
