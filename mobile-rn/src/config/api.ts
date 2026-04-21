import { Platform } from 'react-native';

const LOCAL_IP = '192.168.1.45';

const getBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    return `http://${LOCAL_IP}:3000`;
  }
  return 'https://your-production-api.com';
};

export const API_CONFIG = {
  baseUrl: getBaseUrl(),
  timeout: 30000,
  uploadTimeout: 120000,
};

export const getFullImageUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_CONFIG.baseUrl}${path}`;
};
