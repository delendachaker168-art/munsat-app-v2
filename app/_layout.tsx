import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { pruneExpiredVoiceCache } from '../src/lib/local-audio';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  useEffect(() => {
    const cleanup = () => pruneExpiredVoiceCache().catch(() => {});
    cleanup();
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Announce only the arrival cue while the app is active; never autoplay audio.
  useEffect(() => {
    let active = true;
    let channel: any = null;
    const announced = new Set<string>();
    const connect = async (userId: string | null) => {
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }
      if (!userId || !active) return;
      
      channel = supabase.channel('incoming-voice-' + userId)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'voice_messages',
          filter: 'recipient_id=eq.' + userId,
        }, async (payload: any) => {
          const row = payload.new;
          if (!active || !row?.id || announced.has(row.id) || row.recipient_id !== userId) return;
          announced.add(row.id);
          if (announced.size > 40) {
            const first = announced.values().next().value;
            if (first) announced.delete(first);
          }
          const { data: slot } = await supabase.from('voice_slots')
            .select('slot_number').eq('owner_id', userId).eq('friend_id', row.sender_id).maybeSingle();
          const number = Number(slot?.slot_number || row.slot_number);
          if (AppState.currentState !== 'active' || !Number.isInteger(number) || number < 1 || number > 5) return;
          Speech.stop();
          Speech.speak('رسالة من ' + ['واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة'][number - 1], {
            language: 'ar-SA', rate: 0.9,
          });
        })
        .subscribe();
    };
    let currentUserId: string | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      currentUserId = data.user?.id || null;
      await connect(currentUserId);
    })();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id || null;
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        void connect(nextUserId);
      }
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      if (channel) {
        import('../src/lib/supabase').then(({ supabase }) => supabase.removeChannel(channel));
      }
      Speech.stop();
    };
  }, []);
  return <>
    <StatusBar style="dark" backgroundColor="#FFFFFF" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }} />
  </>;
}
