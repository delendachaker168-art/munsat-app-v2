import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../src/lib/supabase';

export default function Index() {
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) router.replace(data.session ? '/(tabs)' : '/login');
    });
    return () => { active = false; };
  }, []);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}><ActivityIndicator color="#78B98A" size="large" /></View>;
}
