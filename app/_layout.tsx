import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { pruneExpiredVoiceCache } from '../src/lib/local-audio';

export default function RootLayout() {
  useEffect(() => {
    const cleanup = () => pruneExpiredVoiceCache().catch(() => {});\n    cleanup();\n    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);\n    return () => clearInterval(interval);\n  }, []);
  return <>
    <StatusBar style="dark" backgroundColor="#FFFFFF" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }} />
  </>;
}
