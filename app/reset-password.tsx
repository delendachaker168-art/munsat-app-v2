import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../src/lib/supabase';

const green = '#8BC99A';

export default function ResetPassword() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const exchanged = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    let active = true;
    async function prepare() {
      if (typeof code === 'string' && code && !exchanged.current) {
        exchanged.current = true;
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          Alert.alert('رابط غير صالح', 'انتهت صلاحية رابط الاستعادة أو استُخدم من قبل. اطلب رابطًا جديدًا.');
          return;
        }
        setReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (active) setReady(Boolean(data.session));
    }
    prepare().catch(() => {
      if (active) Alert.alert('تعذر التحقق', 'تعذر التحقق من رابط الاستعادة. اطلب رابطًا جديدًا.');
    });
    return () => { active = false; };
  }, [code]);

  async function savePassword() {
    if (password.length < 8) {
      Alert.alert('كلمة مرور قصيرة', 'استخدم 8 أحرف على الأقل.');
      return;
    }
    if (password !== confirmation) {
      Alert.alert('كلمتا المرور غير متطابقتين', 'أعد كتابة كلمة المرور للتأكيد.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      Alert.alert('تعذر تحديث كلمة المرور', error.message);
      return;
    }
    await supabase.auth.signOut();
    Alert.alert('تم التحديث', 'أصبحت كلمة المرور الجديدة جاهزة. سجّل الدخول بها الآن.');
    router.replace('/login');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 26, backgroundColor: '#FFF' }}>
      <Text style={{ fontSize: 27, fontWeight: '800', color: '#111', textAlign: 'right', marginBottom: 10 }}>استعادة كلمة المرور</Text>
      <Text style={{ color: '#777', textAlign: 'right', lineHeight: 24, marginBottom: 22 }}>
        {ready ? 'أدخل كلمة المرور الجديدة لحسابك.' : 'افتح رابط الاستعادة الذي أرسلناه إلى بريدك الإلكتروني على هذا الجهاز.'}
      </Text>
      {ready ? <>
        <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور الجديدة" secureTextEntry style={input}/>
        <TextInput value={confirmation} onChangeText={setConfirmation} placeholder="تأكيد كلمة المرور" secureTextEntry style={input}/>
        <Pressable disabled={busy} onPress={savePassword} style={button}>
          <Text style={{ textAlign: 'center', fontWeight: '700', color: '#102015' }}>{busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</Text>
        </Pressable>
      </> : <Pressable onPress={() => router.replace('/login')} style={{ padding: 15 }}>
        <Text style={{ textAlign: 'center', color: '#4F9864' }}>العودة إلى تسجيل الدخول</Text>
      </Pressable>}
    </View>
  );
}

const input = { backgroundColor: '#F3F4F3', padding: 16, borderRadius: 12, marginBottom: 14, textAlign: 'right' as const, fontSize: 16 };
const button = { backgroundColor: green, padding: 17, borderRadius: 12, marginTop: 8 };
