import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
