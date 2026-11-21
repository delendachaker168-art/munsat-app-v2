import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { pruneExpiredVoiceCache } from '../src/lib/local-audio';

export default function RootLayout() {
  useEffect(() => {
    const cleanup = () => pruneExpiredVoiceCache().catch(() => {});
    cleanup();
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return <>
    <StatusBar style="dark" backgroundColor="#FFFFFF" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }} />
  </>;
}
