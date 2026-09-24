import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Inbox: undefined;
  MessageDetail: { messageId: string };
  CreateMessage: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
