import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '../../src/lib/supabase';
import { cacheVoiceMessage, getCachedVoiceUri, pruneExpiredVoiceCache } from '../../src/lib/local-audio';

type Slot = { slot_number:number; friend_id:string|null; friend:{id:string;display_name:string|null}|null };
type Message = { id:string; sender_id:string; recipient_id:string; slot_number:number; duration_ms:number; created_at:string; storage_key:string };
const green='#8BC99A';
function fmt(ms:number){const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}

function VoiceMessageCard({message,currentUserId}:{message:Message;currentUserId:string}){
 const player=useAudioPlayer(null);const status=useAudioPlayerStatus(player);const [loading,setLoading]=useState(false);
 async function play(){
  if(status.playing){player.pause();return;}
  setLoading(true);
  try{
   if(message.recipient_id===currentUserId){
    let localUri=await getCachedVoiceUri(message.id);
    if(!localUri){
     const {data,error}=await supabase.storage.from('voice-messages').createSignedUrl(message.storage_key,600);
     if(error||!data?.signedUrl)throw error||new Error('تعذر إنشاء رابط الاستماع.');
     localUri=await cacheVoiceMessage(message.id,data.signedUrl,message.storage_key.split('.').pop()||'m4a');
     await supabase.from('voice_messages').update({downloaded_at:new Date().toISOString()}).eq('id',message.id);
    }
    player.replace(localUri);
    await supabase.from('voice_messages').update({listened_at:new Date().toISOString()}).eq('id',message.id);
   }else{
    const {data,error}=await supabase.storage.from('voice-messages').createSignedUrl(message.storage_key,600);
    if(error||!data?.signedUrl)throw error||new Error('تعذر إنشاء رابط الاستماع.');
    player.replace(data.signedUrl);
   }
   if(status.duration>0&&status.currentTime>=status.duration)player.seekTo(0);
   player.play();
  }catch(e:any){Alert.alert('تعذر تشغيل الرسالة',e?.message||'حاول مرة أخرى.');}
  finally{setLoading(false);}
 }
 return <View style={{padding:15,backgroundColor:'#F4F5F4',borderRadius:12,marginBottom:9}}>
  <Text style={{textAlign:'right',fontWeight:'700',color:'#333'}}>{message.sender_id===currentUserId?'رسالة مرسلة':'رسالة واردة'} · {fmt(message.duration_ms)}</Text>
  <Text style={{textAlign:'right',color:'#888',fontSize:12,marginTop:5}}>{new Date(message.created_at).toLocaleString('ar')}</Text>
  <Pressable onPress={play} disabled={loading} style={{alignSelf:'flex-end',backgroundColor:green,paddingHorizontal:18,paddingVertical:9,borderRadius:9,marginTop:10}}>
   <Text style={{color:'#17351E',fontWeight:'700'}}>{loading?'جارٍ التحميل…':status.playing?'إيقاف مؤقت':'استماع'}</Text>
  </Pressable>
 </View>;
}

export default function Messages(){
 const recorder=useAudioRecorder({...RecordingPresets.LOW_QUALITY, isMeteringEnabled:true});
 const state=useAudioRecorderState(recorder,200);
 const previewPlayer=useAudioPlayer(null);const previewStatus=useAudioPlayerStatus(previewPlayer);
 const [slots,setSlots]=useState<Slot[]>([]);const [selected,setSelected]=useState(1);const [messages,setMessages]=useState<Message[]>([]);const [busy,setBusy]=useState(false);const [pendingRecording,setPendingRecording]=useState(false);const [pendingDuration,setPendingDuration]=useState(0);const [currentUserId,setCurrentUserId]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const started=useRef(0);const idempotencyRef=useRef<string|null>(null);
 const load=useCallback(async()=>{
  const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)return;setCurrentUserId(user.id);
  const {data:slotData,error}=await supabase.from('voice_slots').select('slot_number,friend_id,friend:profiles!voice_slots_friend_id_fkey(id,display_name)').eq('owner_id',user.id).order('slot_number');
  if(error){Alert.alert('تعذر تحميل الخانات',error.message);return;}
  if(!slotData?.length){await supabase.from('voice_slots').upsert([1,2,3,4,5].map(slot_number=>({owner_id:user.id,slot_number,friend_id:null})),{onConflict:'owner_id,slot_number'});setSlots([1,2,3,4,5].map(slot_number=>({slot_number,friend_id:null,friend:null})));}
  else setSlots(slotData as unknown as Slot[]);
  const {data:msg}=await supabase.from('voice_messages').select('*').or('sender_id.eq.'+user.id+',recipient_id.eq.'+user.id).order('created_at',{ascending:false}).limit(20);
  setMessages((msg||[]) as Message[]);
 },[]);
 useEffect(()=>{
  load();pruneExpiredVoiceCache().catch(()=>{});
  (async()=>{const p=await AudioModule.requestRecordingPermissionsAsync();if(!p.granted)Alert.alert('إذن الميكروفون','اسمح لمنصت باستخدام الميكروفون لتسجيل الرسائل.');await setAudioModeAsync({playsInSilentMode:true,allowsRecording:true});})();
  return()=>{if(timer.current)clearTimeout(timer.current);};
 },[load]);
 async function sendRecording(){
  if(busy)return;setBusy(true);const uri=recorder.uri;
  try{
   const target=slots.find(s=>s.slot_number===selected);
   if(!uri||!target?.friend_id){Alert.alert('اختر صديقًا','خصص هذه الخانة لصديق من صفحة الأصدقاء أولًا.');setPendingRecording(Boolean(uri));return;}
   const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)throw new Error('انتهت جلسة الدخول.');
   const response=await fetch(uri);const body=await response.arrayBuffer();
   const extension=uri.toLowerCase().endsWith('.3gp')?'.3gp':uri.toLowerCase().endsWith('.webm')?'.webm':'.m4a';
   const contentType=extension==='.3gp'?'audio/3gpp':extension==='.webm'?'audio/webm':'audio/mp4';
   const key=user.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+extension;
   const {error:uploadError}=await supabase.storage.from('voice-messages').upload(key,body,{contentType,upsert:false});if(uploadError)throw uploadError;
   const duration=Math.min(120000,Math.max(1000,pendingDuration||Date.now()-started.current));
   const {error:insertError}=await supabase.from('voice_messages').insert({sender_id:user.id,recipient_id:target.friend_id,slot_number:selected,storage_key:key,quality:'economy',duration_ms:duration,idempotency_key:key});
   if(insertError){await supabase.storage.from('voice-messages').remove([key]);throw insertError;}
   await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});
   setPendingRecording(false);setPendingDuration(0);previewPlayer.pause();Alert.alert('تم الإرسال','أُرسلت الرسالة الصوتية بنجاح.');await load();
  }catch(e:any){setPendingRecording(Boolean(uri));if(uri)previewPlayer.replace(uri);Alert.alert('تعذر الإرسال','احتفظنا بالتسجيل لتتمكن من إعادة المحاولة. '+(e?.message||''));}
  finally{setBusy(false);}
 }
 async function start(){
  const target=slots.find(s=>s.slot_number===selected);if(!target?.friend_id){Alert.alert('الخانة فارغة','اختر صديقًا لهذه الخانة من صفحة الأصدقاء.');return;}
  try{setPendingRecording(false);setPendingDuration(0);idempotencyRef.current=null;await recorder.prepareToRecordAsync();started.current=Date.now();recorder.record({forDuration:120});timer.current=setTimeout(async()=>{await recorder.stop();setPendingDuration(120000);await sendRecording();},120000);}
  catch(e:any){Alert.alert('تعذر بدء التسجيل',e?.message||'تحقق من إذن الميكروفون.');}
 }
 async function stop(){
  if(timer.current)clearTimeout(timer.current);await recorder.stop();const uri=recorder.uri;
  if(uri){setPendingDuration(Math.min(120000,Date.now()-started.current));previewPlayer.replace(uri);setPendingRecording(true);}else Alert.alert('لم يتم التسجيل','لم نحصل على ملف صوتي. حاول مرة أخرى.');
 }
 async function cancelRecording(){
  if(timer.current)clearTimeout(timer.current);previewPlayer.pause();const uri=recorder.uri;
  if(uri)await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});
  setPendingRecording(false);
 }
 return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:62,paddingBottom:40}}>
  <Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>الرسائل الصوتية</Text><Text style={{textAlign:'right',color:'#777',marginTop:7,marginBottom:22}}>اختر إحدى خانات الأصدقاء الخمس لتسجيل رسالة.</Text>
  <View style={{flexDirection:'row-reverse',gap:8,marginBottom:22}}>{[1,2,3,4,5].map(n=>{const s=slots.find(x=>x.slot_number===n);return <Pressable key={n} disabled={state.isRecording||pendingRecording} onPress={()=>setSelected(n)} style={{flex:1,paddingVertical:13,borderRadius:12,alignItems:'center',backgroundColor:selected===n?green:'#F1F2F1',borderWidth:selected===n?1:0,borderColor:'#6EAD7D'}}><Text style={{fontWeight:'800',color:'#17251A'}}>{n}</Text><Text numberOfLines={1} style={{fontSize:9,color:'#555',marginTop:4}}>{s?.friend?.display_name||'فارغة'}</Text></Pressable>})}</View>
  <View style={{backgroundColor:'#F4F5F4',borderRadius:20,padding:24,alignItems:'center'}}><Text style={{fontSize:16,color:'#555'}}>{pendingRecording?'مراجعة التسجيل':'مدة التسجيل'}</Text><Text style={{fontSize:42,fontWeight:'800',color:'#111',marginVertical:14}}>{fmt(pendingRecording?pendingDuration:(state.durationMillis||0))}</Text>
   <Text style={{color:'#777',fontSize:12,marginBottom:20}}>{pendingRecording?'استمع إلى التسجيل قبل إرساله أو ألغِه':'الحد الأقصى دقيقتان، ثم يرسل التسجيل تلقائيًا'}</Text>
   {pendingRecording?<View style={{width:'100%',gap:10}}>
    <Pressable onPress={()=>{if(previewStatus.playing)previewPlayer.pause();else{if(previewStatus.duration>0&&previewStatus.currentTime>=previewStatus.duration)previewPlayer.seekTo(0);previewPlayer.play();}}} style={{backgroundColor:'#E7E9E7',padding:14,borderRadius:11}}><Text style={{textAlign:'center',fontWeight:'700',color:'#222'}}>{previewStatus.playing?'إيقاف الاستماع':'استماع إلى التسجيل'}</Text></Pressable>
    <Pressable disabled={busy} onPress={sendRecording} style={{backgroundColor:green,padding:15,borderRadius:11}}><Text style={{textAlign:'center',fontWeight:'800',color:'#17351E'}}>{busy?'جارٍ الإرسال…':'إرسال الرسالة'}</Text></Pressable>
    <Pressable disabled={busy} onPress={cancelRecording} style={{backgroundColor:'#EEE',padding:13,borderRadius:11}}><Text style={{textAlign:'center',fontWeight:'700',color:'#555'}}>إلغاء وحذف التسجيل</Text></Pressable>
   </View>:<><Pressable disabled={busy} onPress={state.isRecording?stop:start} style={{width:78,height:78,borderRadius:39,backgroundColor:state.isRecording?'#D96B6B':green,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:26,color:'#17351E'}}>{state.isRecording?'■':'●'}</Text></Pressable><Text style={{marginTop:14,color:'#444',fontWeight:'700'}}>{busy?'جارٍ الإرسال…':state.isRecording?'إغلاق التسجيل ومراجعته':'اضغط لبدء التسجيل'}</Text></>}
  </View>
  <Text style={{fontSize:20,fontWeight:'800',textAlign:'right',marginTop:30,marginBottom:12,color:'#111'}}>أحدث الرسائل</Text>
  {messages.length===0?<Text style={{textAlign:'right',color:'#888',padding:14}}>لا توجد رسائل بعد.</Text>:messages.map(m=><VoiceMessageCard key={m.id} message={m} currentUserId={currentUserId}/>)}
 </ScrollView>;
}
