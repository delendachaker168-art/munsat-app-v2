import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

type ForegroundService = {
  start(): boolean;
  stop(): boolean;
};

const NativeService: ForegroundService = Platform.OS === 'android'
  ? requireNativeModule<ForegroundService>('MunsatForegroundService')
  : { start: () => false, stop: () => false };

export default NativeService;
