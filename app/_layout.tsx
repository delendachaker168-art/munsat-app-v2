import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { pruneExpiredVoiceCache } from '../src/lib/local-audio';

export default function RootLayout() {
  useEffect(() => { pruneExpiredVoiceCache().catch(() => {}); }, []);
  return <>
    <StatusBar style="dark" backgroundColor="#FFFFFF" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }} />
  </>;
}
