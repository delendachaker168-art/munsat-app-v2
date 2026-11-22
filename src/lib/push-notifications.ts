import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registerPushNotifications(userId: string): Promise<string | null> {
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('voice-messages', {
        name: 'الرسائل الصوتية',
        description: 'تنبيه عند وصول رسالة صوتية جديدة',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#9AD9A5',
        sound: 'default',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('Expo projectId is missing');

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await supabase.from('device_push_tokens').upsert({
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,expo_push_token' });

    if (error) throw error;
    return token;
  } catch (error) {
    console.warn('Munsat push registration failed:', error);
    return null;
  }
}
