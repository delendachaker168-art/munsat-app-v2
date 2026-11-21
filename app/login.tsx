import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
const green = '#8BC99A';
export default function Login() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false);
  async function signIn(){
    if(!isSupabaseConfigured){Alert.alert('إعداد مطلوب','أضف بيانات Supabase في ملف .env أولاً.');return;}
    if(!email.trim()||!password){Alert.alert('تنبيه','أدخل البريد وكلمة المرور.');return;}
    setBusy(true); const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password}); setBusy(false);
    if(error) Alert.alert('تعذر الدخول',error.message); else router.replace('/(tabs)');
  }
  async function signUp(){
    if(!isSupabaseConfigured){Alert.alert('إعداد مطلوب','أضف بيانات Supabase في ملف .env أولاً.');return;}
    if(!email.trim()||password.length<8){Alert.alert('تنبيه','أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.');return;}
    setBusy(true); const {error}=await supabase.auth.signUp({email:email.trim(),password}); setBusy(false);
    if(error) Alert.alert('تعذر التسجيل',error.message); else Alert.alert('تم','تحقق من بريدك الإلكتروني لتأكيد الحساب.');
  }
  return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'center',padding:26,backgroundColor:'#FFF'}}>
    <Text style={{fontSize:36,fontWeight:'800',textAlign:'center',color:'#111',marginBottom:8}}>منصت</Text>
    <Text style={{fontSize:16,textAlign:'center',color:'#777',marginBottom:34}}>تواصل صوتي بسيط وآمن</Text>
    <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" keyboardType="email-address" autoCapitalize="none" style={input}/>
    <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry style={input}/>
    <Pressable disabled={busy} onPress={signIn} style={button}><Text style={buttonText}>{busy?'يرجى الانتظار…':'تسجيل الدخول'}</Text></Pressable>
    <Pressable disabled={busy} onPress={signUp} style={{padding:16}}><Text style={{textAlign:'center',color:'#333'}}>إنشاء حساب جديد</Text></Pressable>
  </KeyboardAvoidingView>;
}
const input={backgroundColor:'#F3F4F3',padding:16,borderRadius:12,marginBottom:14,textAlign:'right' as const,fontSize:16};
const button={backgroundColor:green,padding:17,borderRadius:12,marginTop:8};
const buttonText={textAlign:'center' as const,fontWeight:'700' as const,color:'#102015',fontSize:16};
