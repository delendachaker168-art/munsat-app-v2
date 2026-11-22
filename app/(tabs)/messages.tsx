import { useCallback, useEffect, useRef, useState } from 'react';
import { router,useLocalSearchParams,useFocusEffect } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as MunsatAudioCapture from '../../src/lib/munsat-audio-capture';
import { supabase } from '../../src/lib/supabase';
import { cacheLocalVoiceMessage, cacheVoiceMessage, getCachedVoiceUri } from '../../src/lib/local-audio';

type Slot = { slot_number:number; friend_id:string|null; friend:{id:string;display_name:string|null;avatar_key:string|null}|null };
type Message = { id:string; sender_id:string; recipient_id:string; slot_number:number; duration_ms:number; created_at:string; storage_key:string; listened_at:string|null; downloaded_at:string|null; deleted_at:string|null; sender?:{display_name:string|null;avatar_key:string|null}; recipient?:{display_name:string|null;avatar_key:string|null} };
const green='#8BC99A';
const MODEL=(FileSystem.documentDirectory||'')+'vosk/model-ar-tn';
const IDLE_GRAMMAR=['محادثة واحد','محادثة 1','محادثة الاولى','محادثة الأولى','محادثة اثنين','محادثة اثنان','محادثة 2','محادثة الثانية','محادثة ثلاثة','محادثة ثلاثه','محادثة 3','محادثة الثالثة','محادثة أربعة','محادثة اربعة','محادثة 4','محادثة الرابعة','محادثة خمسة','محادثة 5','محادثة الخامسة','سماع واحد','سماع 1','سماع اثنين','سماع اثنان','سماع 2','سماع ثلاثة','سماع ثلاثه','سماع 3','سماع أربعة','سماع اربعة','سماع 4','سماع خمسة','سماع 5','توقف','[unk]'];
const RECORD_GRAMMAR=['أغلق','اغلق','إغلاق','إلغاء','الغاء','[unk]'];
function normalizeCommand(s:string){return s.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[.,،؛!?؟]/g,' ').replace(/\\s+/g,' ').trim();}
function commandSlot(s:string,word:'محادثة'|'سماع'){const t=normalizeCommand(s);const m=t.match(new RegExp(word+'\\s+(واحد|1|اثنين|اثنان|2|ثلاثه|ثلاثة|3|اربعه|اربعة|4|خمسه|خمسة|5)'));if(!m)return null;return ({'واحد':1,'1':1,'اثنين':2,'اثنان':2,'2':2,'ثلاثه':3,'ثلاثة':3,'3':3,'اربعه':4,'اربعة':4,'4':4,'خمسه':5,'خمسة':5,'5':5} as Record<string,number>)[m[1]]||null;}
function fmt(ms:number){const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}

function VoiceMessageCard({message,currentUserId,onListened,stopSignal}:{message:Message;currentUserId:string;onListened:(id:string,at:string)=>void;stopSignal:number}){
 const player=useAudioPlayer(null);const status=useAudioPlayerStatus(player);const [loading,setLoading]=useState(false);const [loadedMessageId,setLoadedMessageId]=useState<string|null>(null);const [hasLocalCopy,setHasLocalCopy]=useState(false);
 useEffect(()=>{let active=true;getCachedVoiceUri(message.id).then(uri=>{if(active)setHasLocalCopy(Boolean(uri));});return()=>{active=false;};},[message.id]);
 useEffect(()=>{if(stopSignal>0)player.pause();},[stopSignal,player]);
 async function play(){
  if(status.playing){player.pause();return;}
  setLoading(true);
  try{
   if(loadedMessageId!==message.id){
    let uri:string;
    const cached=await getCachedVoiceUri(message.id);
    if(cached){uri=cached;setHasLocalCopy(true);}
    else if(message.deleted_at){
     throw new Error('انتهت مدة التخزين السحابي ولم توجد نسخة محلية محفوظة على هذا الجهاز.');
    }else{
     const {data,error}=await supabase.storage.from('voice-messages').createSignedUrl(message.storage_key,3600);
     if(error||!data?.signedUrl)throw error||new Error('تعذر إنشاء رابط الاستماع.');
     if(message.recipient_id===currentUserId){
      uri=await cacheVoiceMessage(message.id,data.signedUrl,message.storage_key.split('.').pop()||'m4a');
      setHasLocalCopy(true);
      await supabase.from('voice_messages').update({downloaded_at:new Date().toISOString()}).eq('id',message.id);
     }else uri=data.signedUrl;
    }
    player.replace(uri);setLoadedMessageId(message.id);player.play();
    if(message.recipient_id===currentUserId){const at=new Date().toISOString();await supabase.from('voice_messages').update({listened_at:at}).eq('id',message.id);onListened(message.id,at);}
   }else{
    if(status.duration>0&&status.currentTime>=status.duration)player.seekTo(0);
    player.play();
   }
  }catch(e:any){Alert.alert('تعذر تشغيل الرسالة',e?.message||'حاول مرة أخرى.');}
  finally{setLoading(false);}
 }
 return <View style={{padding:15,backgroundColor:'#F4F5F4',borderRadius:12,marginBottom:9}}>
  <View style={{flexDirection:'row-reverse',alignItems:'center',gap:9}}>{message.sender_id!==currentUserId&&message.sender?.avatar_key?<Image source={{uri:supabase.storage.from('avatars').getPublicUrl(message.sender.avatar_key).data.publicUrl}} style={{width:34,height:34,borderRadius:17}}/>:null}<View style={{flex:1}}><Text style={{textAlign:'right',fontWeight:'700',color:'#333'}}>{message.sender_id===currentUserId?'إلى '+(message.recipient?.display_name||'صديق'):'من '+(message.sender?.display_name||'صديق')} · {fmt(message.duration_ms)}</Text>{message.deleted_at?<Text style={{textAlign:'right',fontSize:11,color:'#888',marginTop:3}}>{hasLocalCopy?'نسخة محلية محفوظة على الجهاز':'انتهت مدة التخزين السحابي'}</Text>:message.recipient_id===currentUserId?<Text style={{textAlign:'right',fontSize:11,color:'#888',marginTop:3}}>{message.listened_at?'تم الاستماع':'لم تُسمع بعد'}</Text>:null}</View></View>
  <Text style={{textAlign:'right',color:'#888',fontSize:12,marginTop:5}}>{new Date(message.created_at).toLocaleString('ar')}</Text>
  <Pressable onPress={play} disabled={loading||(Boolean(message.deleted_at)&&!hasLocalCopy)} style={{alignSelf:'flex-end',backgroundColor:green,paddingHorizontal:18,paddingVertical:9,borderRadius:9,marginTop:10}}>
   <Text style={{color:'#17351E',fontWeight:'700'}}>{loading?'جارٍ التحميل…':status.playing?'إيقاف مؤقت':message.deleted_at?'استماع للنسخة المحلية':'استماع'}</Text>
  </Pressable>
 </View>;
}

export default function Messages(){
 const params=useLocalSearchParams<{slot?:string;friendId?:string;friendName?:string;autoRecord?:string;autoToken?:string;voiceControl?:string;playSlot?:string}>();
 const friendId=typeof params.friendId==='string'?params.friendId:null;
 const friendName=typeof params.friendName==='string'?params.friendName:'الصديق';
 const recorder=useAudioRecorder({...RecordingPresets.LOW_QUALITY, isMeteringEnabled:true});
 const state=useAudioRecorderState(recorder,200);
 const previewPlayer=useAudioPlayer(null);const previewStatus=useAudioPlayerStatus(previewPlayer);const commandPlayer=useAudioPlayer(null);
 const [slots,setSlots]=useState<Slot[]>([]);const [selected,setSelected]=useState(1);const [messages,setMessages]=useState<Message[]>([]);const [messageFilter,setMessageFilter]=useState<'all'|'sent'|'received'>('all');const [messageOffset,setMessageOffset]=useState(20);const [hasMoreMessages,setHasMoreMessages]=useState(false);const [loadingMore,setLoadingMore]=useState(false);const [busy,setBusy]=useState(false);const [pendingRecording,setPendingRecording]=useState(false);const [pendingDuration,setPendingDuration]=useState(0);const [pendingUri,setPendingUri]=useState<string|null>(null);const [nativeRecording,setNativeRecording]=useState(false);const [nativeDuration,setNativeDuration]=useState(0);const [voiceSessionReady,setVoiceSessionReady]=useState(false);const [stopPlaybackSignal,setStopPlaybackSignal]=useState(0);const [micReady,setMicReady]=useState(false);const [currentUserId,setCurrentUserId]=useState('');
 const selectedRef=useRef(selected);selectedRef.current=selected;const slotsRef=useRef(slots);slotsRef.current=slots;const pendingUriRef=useRef<string|null>(pendingUri);pendingUriRef.current=pendingUri;const sendingRef=useRef(false);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const started=useRef(0);const nativeRecordingRef=useRef(false);const nativeStartedAt=useRef(0);const handledPlaySlot=useRef<string|null>(null);const voiceSubscriptions=useRef<any[]>([]);const pendingDurationRef=useRef(0);const handledAutoToken=useRef<string|null>(null);const idempotencyRef=useRef<string|null>(null);const recordingLock=useRef(false);
 function announce(text:string){return new Promise<void>(resolve=>{Speech.stop();Speech.speak(text,{language:'ar-SA',rate:0.92,onDone:resolve,onStopped:resolve,onError:()=>resolve()});});}
 const load=useCallback(async()=>{
  const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)return;setCurrentUserId(user.id);
  const {data:slotData,error}=await supabase.from('voice_slots').select('slot_number,friend_id,friend:profiles!voice_slots_friend_id_fkey(id,display_name,avatar_key)').eq('owner_id',user.id).order('slot_number');
  if(error){Alert.alert('تعذر تحميل الخانات',error.message);return;}
  if(!slotData?.length){await supabase.from('voice_slots').upsert([1,2,3,4,5].map(slot_number=>({owner_id:user.id,slot_number,friend_id:null})),{onConflict:'owner_id,slot_number'});setSlots([1,2,3,4,5].map(slot_number=>({slot_number,friend_id:null,friend:null})));}
  else setSlots(slotData as unknown as Slot[]);
  const {data:msg}=await supabase.from('voice_messages').select('*,sender:profiles!voice_messages_sender_id_fkey(display_name,avatar_key),recipient:profiles!voice_messages_recipient_id_fkey(display_name,avatar_key)').or(friendId?'and(sender_id.eq.'+user.id+',recipient_id.eq.'+friendId+'),and(sender_id.eq.'+friendId+',recipient_id.eq.'+user.id+')':'sender_id.eq.'+user.id+',recipient_id.eq.'+user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(0,19);
  setMessages((msg||[]) as Message[]);setMessageOffset(20);setHasMoreMessages((msg||[]).length===20);
 },[friendId]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 useEffect(()=>{(async()=>{try{const permission=await AudioModule.requestRecordingPermissionsAsync();if(permission.granted){await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});setMicReady(true);}}catch{setMicReady(false);}})();},[]);

 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);Speech.stop();try{void recorder.stop().catch(()=>{});}catch{}},[recorder]);

 async function loadMoreMessages(){
  if(loadingMore||!hasMoreMessages)return;
  setLoadingMore(true);
  try{
   const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)return;
   const from=messageOffset;
   const {data,error}=await supabase.from('voice_messages').select('*,sender:profiles!voice_messages_sender_id_fkey(display_name,avatar_key),recipient:profiles!voice_messages_recipient_id_fkey(display_name,avatar_key)').or(friendId?'and(sender_id.eq.'+user.id+',recipient_id.eq.'+friendId+'),and(sender_id.eq.'+friendId+',recipient_id.eq.'+user.id+')':'sender_id.eq.'+user.id+',recipient_id.eq.'+user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+19);
   if(error)throw error;
   const page=(data||[]) as Message[];
   setMessages(current=>{const seen=new Set(current.map(item=>item.id));return [...current,...page.filter(item=>!seen.has(item.id))];});
   setMessageOffset(from+page.length);setHasMoreMessages(page.length===20);
  }catch(e:any){Alert.alert('تعذر تحميل الرسائل السابقة',e?.message||'حاول مرة أخرى.');}
  finally{setLoadingMore(false);}
 }
 async function sendRecording(recordingUri?:string,durationOverride?:number){
  if(sendingRef.current)return;sendingRef.current=true;setBusy(true);const uri=recordingUri||pendingUri||recorder.uri;const selectedSlot=selectedRef.current;
  try{
   const target=slotsRef.current.find(s=>s.slot_number===selectedSlot);
   const recipientId=friendId||target?.friend_id;
   if(!uri||!recipientId){Alert.alert('اختر صديقًا','خصص هذه الخانة لصديق من صفحة الأصدقاء أولًا.');setPendingRecording(Boolean(uri));return;}
   const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)throw new Error('انتهت جلسة الدخول.');
   const response=await fetch(uri);const body=await response.arrayBuffer();
   const extension=uri.toLowerCase().endsWith('.3gp')?'.3gp':uri.toLowerCase().endsWith('.webm')?'.webm':'.m4a';
   const contentType=extension==='.3gp'?'audio/3gpp':extension==='.webm'?'audio/webm':'audio/mp4';
   const idempotencyKey=idempotencyRef.current||user.id+'/voice-'+Date.now()+'-'+Math.random().toString(36).slice(2);idempotencyRef.current=idempotencyKey;
   const key=idempotencyKey+extension;
   const {error:uploadError}=await supabase.storage.from('voice-messages').upload(key,body,{contentType,upsert:true});if(uploadError)throw uploadError;
   const duration=Math.min(120000,Math.max(1000,durationOverride||pendingDurationRef.current||Date.now()-started.current));
   const {data:inserted,error:insertError}=await supabase.from('voice_messages').insert({sender_id:user.id,recipient_id:recipientId,slot_number:selectedSlot,storage_key:key,quality:'economy',duration_ms:duration,idempotency_key:idempotencyKey}).select('id').single();
   let messageId=inserted?.id as string|undefined;
   if(insertError){const {data:existing,error:lookupError}=await supabase.from('voice_messages').select('id').eq('idempotency_key',idempotencyKey).maybeSingle();if(lookupError||!existing)throw insertError;messageId=existing.id;}
   if(!messageId)throw new Error('تم رفع الملف لكن تعذر حفظ سجل الرسالة.');
   await cacheLocalVoiceMessage(messageId,uri);
   idempotencyRef.current=null;
   await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});
   setPendingRecording(false);setPendingDuration(0);setPendingUri(null);pendingUriRef.current=null;pendingDurationRef.current=0;previewPlayer.pause();await announce('تم إرسال الرسالة');Alert.alert('تم الإرسال','أُرسلت الرسالة الصوتية بنجاح.');await load();
  }catch(e:any){setPendingRecording(Boolean(uri));if(uri)previewPlayer.replace(uri);Alert.alert('تعذر الإرسال','احتفظنا بالتسجيل لتتمكن من إعادة المحاولة. '+(e?.message||''));}
  finally{sendingRef.current=false;setBusy(false);}
 }
 async function start(slot=selected){
  if(recordingLock.current||state.isRecording||nativeRecordingRef.current)return;
  if(pendingUriRef.current){await announce('أرسل التسجيل السابق أو ألغِه أولًا');return;}
  setSelected(slot);const target=slotsRef.current.find(s=>s.slot_number===slot);
  if(!friendId&&!target?.friend_id){Alert.alert('الخانة فارغة','اختر صديقًا لهذه الخانة من صفحة الأصدقاء.');return;}
  recordingLock.current=true;
  try{
   const permission=await AudioModule.requestRecordingPermissionsAsync();
   if(!permission.granted){Alert.alert('إذن الميكروفون','اسمح لمنصت باستخدام الميكروفون.');return;}
   if(params.voiceControl==='1'){
    await announce('بدأ التسجيل');
    await MunsatAudioCapture.startRecording();
    return;
   }
   await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});
   await announce('بدأ التسجيل');
   await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
   setMicReady(true);setPendingRecording(false);setPendingDuration(0);pendingDurationRef.current=0;idempotencyRef.current=null;
   await recorder.prepareToRecordAsync();
   started.current=Date.now();
   recorder.record();
   timer.current=setTimeout(async()=>{
    try{
     await recorder.stop();
     pendingDurationRef.current=120000;setPendingDuration(120000);
     await announce('انتهى التسجيل، جارٍ إرسال الرسالة');
     await sendRecording();
    }catch(e:any){Alert.alert('تعذر إنهاء التسجيل',e?.message||'حاول مرة أخرى.');}
   },120000);
  }catch(e:any){Alert.alert('تعذر بدء التسجيل',e?.message||'تحقق من إذن الميكروفون.');}
  finally{recordingLock.current=false;}
 }
 async function stop(){
  if(params.voiceControl==='1'&&nativeRecordingRef.current){await MunsatAudioCapture.stopRecording('manual');return;}
  if(timer.current)clearTimeout(timer.current);
  try{
   await recorder.stop();
   const uri=recorder.uri;
   if(uri){
    const duration=Math.min(120000,Math.max(1000,Date.now()-started.current));
    pendingDurationRef.current=duration;setPendingDuration(duration);
    previewPlayer.replace(uri);setPendingRecording(true);
    await announce('انتهى التسجيل');
   }else Alert.alert('لم يتم التسجيل','لم نحصل على ملف صوتي. حاول مرة أخرى.');
  }catch(e:any){Alert.alert('تعذر إيقاف التسجيل',e?.message||'حاول مرة أخرى.');}
 }
 async function playLatestVoice(slot:number){
  const target=slotsRef.current.find(s=>s.slot_number===slot);const senderId=target?.friend_id;
  if(!senderId){await announce('هذه الخانة غير مخصصة لصديق');return;}
  const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)return;
  const {data:latest,error}=await supabase.from('voice_messages').select('*').eq('sender_id',senderId).eq('recipient_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error||!latest){await announce('لا توجد رسالة واردة في هذه الخانة');return;}
  let uri=await getCachedVoiceUri(latest.id);
  if(!uri){
   if(latest.deleted_at){await announce('انتهت مدة حفظ الرسالة');return;}
   const {data:link,error:linkError}=await supabase.storage.from('voice-messages').createSignedUrl(latest.storage_key,3600);
   if(linkError||!link?.signedUrl)throw linkError||new Error('تعذر تحميل الرسالة');
   uri=await cacheVoiceMessage(latest.id,link.signedUrl,latest.storage_key.split('.').pop()||'m4a');
   await supabase.from('voice_messages').update({downloaded_at:new Date().toISOString()}).eq('id',latest.id);
  }
  await announce('تشغيل رسالة الخانة '+slot);
  commandPlayer.replace(uri);commandPlayer.play();
 }
 async function handleVoiceCommand(raw:string){
  const text=normalizeCommand(raw);if(!text)return;
  if(nativeRecordingRef.current){
   if(/^(اغلق|اغلاق|انهاء)$/.test(text)){await MunsatAudioCapture.stopRecording('command');return;}
   if(/^(الغاء|الغاء التسجيل)$/.test(text)){await MunsatAudioCapture.cancelRecording();return;}
   return;
  }
  const chatSlot=commandSlot(raw,'محادثة');if(chatSlot){await start(chatSlot);return;}
  const playSlot=commandSlot(raw,'سماع');if(playSlot){try{await playLatestVoice(playSlot);}catch(e:any){Alert.alert('تعذر تشغيل الرسالة',e?.message||'');}return;}
  if(/^(توقف|وقف)$/.test(text)){commandPlayer.pause();previewPlayer.pause();setStopPlaybackSignal(v=>v+1);}
 }
 useFocusEffect(useCallback(()=>{
  if(params.voiceControl!=='1'||!micReady||slots.length===0)return;
  let active=true;
  voiceSubscriptions.current.forEach(x=>x?.remove?.());voiceSubscriptions.current=[];
  voiceSubscriptions.current.push(MunsatAudioCapture.addListener('onCommand',(event:any)=>{if(active&&event?.text)void handleVoiceCommand(event.text);}));
  voiceSubscriptions.current.push(MunsatAudioCapture.addListener('onRecordingStarted',()=>{
   if(!active)return;nativeRecordingRef.current=true;setNativeRecording(true);setNativeDuration(0);nativeStartedAt.current=Date.now();setPendingRecording(false);setPendingUri(null);pendingUriRef.current=null;
  }));
  voiceSubscriptions.current.push(MunsatAudioCapture.addListener('onRecordingStopped',(event:any)=>{
   if(!active)return;nativeRecordingRef.current=false;setNativeRecording(false);
   const uri=event?.uri as string|undefined;const duration=Number(event?.durationMs)||Math.max(1000,Date.now()-nativeStartedAt.current);
   if(!uri)return;pendingUriRef.current=uri;setPendingUri(uri);setPendingDuration(duration);pendingDurationRef.current=duration;setPendingRecording(true);previewPlayer.replace(uri);
   if(event?.reason==='command'||event?.reason==='limit'){
    void announce(event.reason==='limit'?'بلغ التسجيل دقيقتين، جارٍ الإرسال':'تم إغلاق التسجيل، جارٍ الإرسال').then(()=>sendRecording(uri,duration));
   }
  }));
  voiceSubscriptions.current.push(MunsatAudioCapture.addListener('onRecordingCancelled',()=>{
   if(!active)return;nativeRecordingRef.current=false;setNativeRecording(false);setPendingRecording(false);setPendingDuration(0);setPendingUri(null);pendingUriRef.current=null;pendingDurationRef.current=0;void announce('تم إلغاء التسجيل');
  }));
  voiceSubscriptions.current.push(MunsatAudioCapture.addListener('onCaptureError',(event:any)=>{
   if(active){nativeRecordingRef.current=false;setNativeRecording(false);Alert.alert('خطأ في الصوت',event?.message||'تعذر استخدام الميكروفون.');}
  }));
  void (async()=>{
   try{
    await MunsatAudioCapture.startSession(MODEL,IDLE_GRAMMAR,RECORD_GRAMMAR);
    if(!active)return;setVoiceSessionReady(true);
    const playSlot=typeof params.playSlot==='string'?params.playSlot:null;
    if(playSlot&&handledPlaySlot.current!==playSlot){handledPlaySlot.current=playSlot;const n=Number(playSlot);if(n>=1&&n<=5)await playLatestVoice(n);}
   }catch(e:any){if(active){setVoiceSessionReady(false);Alert.alert('تعذر تشغيل الأوامر الصوتية',e?.message||'أعد المحاولة.');}}
  })();
  return ()=>{
   active=false;setVoiceSessionReady(false);voiceSubscriptions.current.forEach(x=>x?.remove?.());voiceSubscriptions.current=[];
   void MunsatAudioCapture.stopSession();
  };
 },[params.voiceControl,params.playSlot,micReady,slots.length]));
 useEffect(()=>{if(!nativeRecording)return;const tick=setInterval(()=>setNativeDuration(Math.max(0,Date.now()-nativeStartedAt.current)),250);return()=>clearInterval(tick);},[nativeRecording]);
 useEffect(()=>{const n=Number(params.slot);if(Number.isInteger(n)&&n>=1&&n<=5)setSelected(n);},[params.slot]);
 useEffect(()=>{const n=Number(params.slot);const token=params.autoToken;if(params.autoRecord==='1'&&token&&micReady&&slots.length>0&&(params.voiceControl!=='1'||voiceSessionReady)&&handledAutoToken.current!==token){handledAutoToken.current=token;if(Number.isInteger(n)&&n>=1&&n<=5){const timerId=setTimeout(()=>start(n),450);return()=>clearTimeout(timerId);}}},[params.autoRecord,params.autoToken,params.slot,micReady,slots,voiceSessionReady,params.voiceControl]);
 async function cancelRecording(){
  if(params.voiceControl==='1'&&nativeRecordingRef.current){await MunsatAudioCapture.cancelRecording();return;}
  if(timer.current)clearTimeout(timer.current);previewPlayer.pause();const uri=pendingUri||recorder.uri;
  if(uri)await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});pendingUriRef.current=null;
  if(idempotencyRef.current&&uri){const ext=uri.toLowerCase().endsWith('.3gp')?'.3gp':uri.toLowerCase().endsWith('.webm')?'.webm':'.m4a';await supabase.storage.from('voice-messages').remove([idempotencyRef.current+ext]).catch(()=>{});}
  idempotencyRef.current=null;setPendingRecording(false);setPendingDuration(0);setPendingUri(null);pendingDurationRef.current=0;
 }
 const visibleMessages=messages.filter(m=>!friendId||(m.sender_id===friendId||m.recipient_id===friendId)).filter(m=>messageFilter==='all'||(messageFilter==='sent'?m.sender_id===currentUserId:m.recipient_id===currentUserId));
 const activeFriend=slots.find(s=>s.slot_number===selected)?.friend;
 const recordingActive=params.voiceControl==='1'?nativeRecording:state.isRecording;
 const shownDuration=pendingRecording?pendingDuration:(params.voiceControl==='1'?nativeDuration:(state.durationMillis||0));
 return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:62,paddingBottom:40}}>
  <View style={{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>{friendId?'المحادثة':'الرسائل الصوتية'}</Text>{friendId?<Pressable onPress={()=>router.replace('/(tabs)/messages')}><Text style={{color:'#4F9864',fontWeight:'700'}}>كل الرسائل</Text></Pressable>:null}</View>
  <Text style={{textAlign:'right',color:'#777',marginTop:7,marginBottom:22}}>{friendId?'مراسلة '+friendName:'اختر صديقًا من الخانات الخمس، أو افتح مراسلته من صفحة الأصدقاء.'}</Text>
  {!friendId?  <View style={{flexDirection:'row-reverse',gap:8,marginBottom:22}}>{[1,2,3,4,5].map(n=>{const s=slots.find(x=>x.slot_number===n);return <Pressable key={n} disabled={recordingActive||pendingRecording} onPress={()=>setSelected(n)} style={{flex:1,paddingVertical:13,borderRadius:12,alignItems:'center',backgroundColor:selected===n?green:'#F1F2F1',borderWidth:selected===n?1:0,borderColor:'#6EAD7D'}}><Text style={{fontWeight:'800',color:'#17251A'}}>{n}</Text>{s?.friend?.avatar_key?<Image source={{uri:supabase.storage.from('avatars').getPublicUrl(s.friend.avatar_key).data.publicUrl}} style={{width:23,height:23,borderRadius:12,marginTop:3}}/>:null}<Text numberOfLines={1} style={{fontSize:9,color:'#555',marginTop:4}}>{s?.friend?.display_name||'فارغة'}</Text></Pressable>})}</View>:null}

  <View style={{backgroundColor:'#F4F5F4',borderRadius:20,padding:24,alignItems:'center'}}><Text style={{fontSize:16,color:'#555'}}>{pendingRecording?'مراجعة التسجيل':recordingActive?'قل «أغلق» للإرسال أو اضغط الزر لإيقاف التسجيل':'مدة التسجيل'}</Text><Text style={{fontSize:42,fontWeight:'800',color:'#111',marginVertical:14}}>{fmt(shownDuration)}</Text>
   <Text style={{color:'#777',fontSize:12,marginBottom:20}}>{pendingRecording?'استمع إلى التسجيل قبل إرساله أو ألغِه':params.voiceControl==='1'?'يمكنك قول «أغلق» لإرسال الرسالة أو «إلغاء» لحذفها. الحد دقيقتان.':'الحد الأقصى دقيقتان، ثم يرسل التسجيل تلقائيًا'}</Text>
   {pendingRecording?<View style={{width:'100%',gap:10}}>
    <Pressable onPress={()=>{if(previewStatus.playing)previewPlayer.pause();else{if(previewStatus.duration>0&&previewStatus.currentTime>=previewStatus.duration)previewPlayer.seekTo(0);previewPlayer.play();}}} style={{backgroundColor:'#E7E9E7',padding:14,borderRadius:11}}><Text style={{textAlign:'center',fontWeight:'700',color:'#222'}}>{previewStatus.playing?'إيقاف الاستماع':'استماع إلى التسجيل'}</Text></Pressable>
    <Pressable disabled={busy} onPress={()=>sendRecording()} style={{backgroundColor:green,padding:15,borderRadius:11}}><Text style={{textAlign:'center',fontWeight:'800',color:'#17351E'}}>{busy?'جارٍ الإرسال…':'إرسال الرسالة'}</Text></Pressable>
    <Pressable disabled={busy} onPress={cancelRecording} style={{backgroundColor:'#EEE',padding:13,borderRadius:11}}><Text style={{textAlign:'center',fontWeight:'700',color:'#555'}}>إلغاء وحذف التسجيل</Text></Pressable>
   </View>:<><Pressable disabled={busy} onPress={recordingActive?stop:()=>start()} style={{width:78,height:78,borderRadius:39,backgroundColor:recordingActive?'#D96B6B':green,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:26,color:'#17351E'}}>{recordingActive?'■':'●'}</Text></Pressable><Text style={{marginTop:14,color:'#444',fontWeight:'700'}}>{busy?'جارٍ الإرسال…':recordingActive?'إغلاق التسجيل ومراجعته':'اضغط لبدء التسجيل'}</Text></>}
  </View>
  <View style={{flexDirection:'row-reverse',gap:7,marginTop:28,marginBottom:12}}>{([['all','الكل'],['received','الواردة'],['sent','الصادرة']] as const).map(([key,label])=><Pressable key={key} onPress={()=>setMessageFilter(key)} style={{flex:1,padding:11,borderRadius:10,backgroundColor:messageFilter===key?green:'#F1F2F1'}}><Text style={{textAlign:'center',fontWeight:'700',color:'#26352A'}}>{label}</Text></Pressable>)}</View>
  <Text style={{fontSize:20,fontWeight:'800',textAlign:'right',marginBottom:12,color:'#111'}}>{friendId?'سجل المحادثة':'سجل الرسائل الصوتية'}</Text>
  {visibleMessages.length===0?<Text style={{textAlign:'right',color:'#888',padding:14}}>{messageFilter==='sent'?'لم ترسل رسائل بعد.':messageFilter==='received'?'لا توجد رسائل واردة.':'لا توجد رسائل في هذه المحادثة بعد.'}</Text>:visibleMessages.map(m=><VoiceMessageCard key={m.id} message={m} currentUserId={currentUserId} stopSignal={stopPlaybackSignal} onListened={(id,at)=>setMessages(v=>v.map(x=>x.id===id?{...x,listened_at:at}:x))}/>)}{hasMoreMessages?<Pressable disabled={loadingMore} onPress={loadMoreMessages} style={{backgroundColor:'#F1F2F1',padding:14,borderRadius:11,marginTop:5,marginBottom:10}}><Text style={{textAlign:'center',fontWeight:'700',color:'#444'}}>{loadingMore?'جارٍ تحميل الرسائل…':'تحميل رسائل أقدم'}</Text></Pressable>:null}
 </ScrollView>;
}
