import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { supabase } from '../../src/lib/supabase';

type Slot = { slot_number:number; friend_id:string|null; friend:{id:string;display_name:string|null}|null };
type Message = { id:string; sender_id:string; recipient_id:string; slot_number:number; duration_ms:number; created_at:string; storage_key:string };
const green='#8BC99A';
function fmt(ms:number){const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
export default function Messages(){
 const recorder=useAudioRecorder({...RecordingPresets.LOW_QUALITY, isMeteringEnabled:true});
 const state=useAudioRecorderState(recorder,200);
 const [slots,setSlots]=useState<Slot[]>([]); const [selected,setSelected]=useState(1); const [messages,setMessages]=useState<Message[]>([]); const [busy,setBusy]=useState(false); const timer=useRef<ReturnType<typeof setTimeout>|null>(null); const started=useRef(0);
 const load=useCallback(async()=>{const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)return;
  const {data:slotData,error}=await supabase.from('voice_slots').select('slot_number,friend_id,friend:profiles!voice_slots_friend_id_fkey(id,display_name)').eq('owner_id',user.id).order('slot_number');
  if(error){Alert.alert('تعذر تحميل الخانات',error.message);return;}
  if(!slotData?.length){await supabase.from('voice_slots').upsert([1,2,3,4,5].map(slot_number=>({owner_id:user.id,slot_number,friend_id:null})),{onConflict:'owner_id,slot_number'});}
  else setSlots(slotData as unknown as Slot[]);
  const {data:msg}=await supabase.from('voice_messages').select('*').or('sender_id.eq.'+user.id+',recipient_id.eq.'+user.id).order('created_at',{ascending:false}).limit(30);
  setMessages((msg||[]) as Message[]);
 },[]);
 useEffect(()=>{load();(async()=>{const p=await AudioModule.requestRecordingPermissionsAsync();if(!p.granted)Alert.alert('إذن الميكروفون','اسمح لمنصت باستخدام الميكروفون لتسجيل الرسائل.');await setAudioModeAsync({playsInSilentMode:true,allowsRecording:true});})();return()=>{if(timer.current)clearTimeout(timer.current);};},[load]);
 async function sendRecording(){if(busy)return;setBusy(true);try{const uri=recorder.uri;const target=slots.find(s=>s.slot_number===selected);if(!uri||!target?.friend_id){Alert.alert('اختر صديقًا','خصص هذه الخانة لصديق من صفحة الأصدقاء أولًا.');return;}
  const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)throw new Error('انتهت جلسة الدخول.');
  const response=await fetch(uri);const body=await response.arrayBuffer();const extension=uri.toLowerCase().endsWith('.3gp')?'.3gp':uri.toLowerCase().endsWith('.webm')?'.webm':'.m4a';
  const contentType=extension==='.3gp'?'audio/3gpp':extension==='.webm'?'audio/webm':'audio/mp4';
  const key=user.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+extension;
  const {error:uploadError}=await supabase.storage.from('voice-messages').upload(key,body,{contentType,upsert:false});if(uploadError)throw uploadError;
  const duration=Math.min(120000,Math.max(1000,Date.now()-started.current));
  const {error:insertError}=await supabase.from('voice_messages').insert({sender_id:user.id,recipient_id:target.friend_id,slot_number:selected,storage_key:key,quality:'economy',duration_ms:duration,idempotency_key:key});
  if(insertError){await supabase.storage.from('voice-messages').remove([key]);throw insertError;}
  Alert.alert('تم الإرسال','أُرسلت الرسالة الصوتية بنجاح.');await load();
 }catch(e:any){Alert.alert('تعذر الإرسال',e?.message||'حدث خطأ غير متوقع.');}finally{setBusy(false);}}
 async function start(){const target=slots.find(s=>s.slot_number===selected);if(!target?.friend_id){Alert.alert('الخانة فارغة','اختر صديقًا لهذه الخانة من صفحة الأصدقاء.');return;}
  try{await recorder.prepareToRecordAsync();started.current=Date.now();recorder.record();timer.current=setTimeout(async()=>{await recorder.stop();await sendRecording();},120000);}catch(e:any){Alert.alert('تعذر بدء التسجيل',e?.message||'تحقق من إذن الميكروفون.');}}
 async function stop(){if(timer.current)clearTimeout(timer.current);await recorder.stop();await sendRecording();}
 return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:62,paddingBottom:40}}>
  <Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>الرسائل الصوتية</Text><Text style={{textAlign:'right',color:'#777',marginTop:7,marginBottom:22}}>اختر إحدى خانات الأصدقاء الخمس لتسجيل رسالة.</Text>
  <View style={{flexDirection:'row-reverse',gap:8,marginBottom:22}}>{[1,2,3,4,5].map(n=>{const s=slots.find(x=>x.slot_number===n);return <Pressable key={n} disabled={state.isRecording} onPress={()=>setSelected(n)} style={{flex:1,paddingVertical:13,borderRadius:12,alignItems:'center',backgroundColor:selected===n?green:'#F1F2F1',borderWidth:selected===n?1:0,borderColor:'#6EAD7D'}}><Text style={{fontWeight:'800',color:'#17251A'}}>{n}</Text><Text numberOfLines={1} style={{fontSize:9,color:'#555',marginTop:4}}>{s?.friend?.display_name||'فارغة'}</Text></Pressable>})}</View>
  <View style={{backgroundColor:'#F4F5F4',borderRadius:20,padding:24,alignItems:'center'}}><Text style={{fontSize:16,color:'#555'}}>مدة التسجيل</Text><Text style={{fontSize:42,fontWeight:'800',color:'#111',marginVertical:14}}>{fmt(state.durationMillis||0)}</Text><Text style={{color:'#777',fontSize:12,marginBottom:20}}>الحد الأقصى دقيقتان، ثم يرسل التسجيل تلقائيًا</Text>
   <Pressable disabled={busy} onPress={state.isRecording?stop:start} style={{width:78,height:78,borderRadius:39,backgroundColor:state.isRecording?'#D96B6B':green,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:26,color:'#17351E'}}>{state.isRecording?'■':'●'}</Text></Pressable>
   <Text style={{marginTop:14,color:'#444',fontWeight:'700'}}>{busy?'جارٍ الإرسال…':state.isRecording?'اضغط لإيقاف التسجيل وإرساله':'اضغط لبدء التسجيل'}</Text>
  </View>
  <Text style={{fontSize:20,fontWeight:'800',textAlign:'right',marginTop:30,marginBottom:12,color:'#111'}}>أحدث الرسائل</Text>
  {messages.length===0?<Text style={{textAlign:'right',color:'#888',padding:14}}>لا توجد رسائل بعد.</Text>:messages.map(m=><View key={m.id} style={{padding:15,backgroundColor:'#F4F5F4',borderRadius:12,marginBottom:9}}><Text style={{textAlign:'right',fontWeight:'700',color:'#333'}}>{m.sender_id===m.recipient_id?'رسالة صوتية':'رسالة صوتية'} · {fmt(m.duration_ms)}</Text><Text style={{textAlign:'right',color:'#888',fontSize:12,marginTop:5}}>{new Date(m.created_at).toLocaleString('ar')}</Text><Pressable onPress={async()=>{const {data,error}=await supabase.storage.from('voice-messages').createSignedUrl(m.storage_key,300);if(error)Alert.alert('تعذر فتح التسجيل',error.message);else if(data?.signedUrl){const { Linking }=await import('react-native');await Linking.openURL(data.signedUrl);}}} style={{alignSelf:'flex-end',backgroundColor:green,paddingHorizontal:18,paddingVertical:9,borderRadius:9,marginTop:10}}><Text style={{color:'#17351E',fontWeight:'700'}}>استماع</Text></Pressable></View>)}
 </ScrollView>;
}
