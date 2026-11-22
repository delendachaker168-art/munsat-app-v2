import {useEffect,useRef,useState} from 'react';
import {Alert,PermissionsAndroid,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MunsatAudioCapture from '../src/lib/munsat-audio-capture';
import {subscribe,unzip} from 'react-native-zip-archive';
import {AudioModule} from 'expo-audio';
import {router} from 'expo-router';

const MODEL_URL='https://alphacephei.com/vosk/models/vosk-model-small-ar-tn-0.1-linto.zip';
const ROOT=(FileSystem.documentDirectory||'')+'vosk/';
const ZIP=ROOT+'arabic-model.zip';
const MODEL=ROOT+'model-ar-tn';
const GRAMMAR=['محادثة واحد','محادثة 1','محادثة الأولى','محادثة الاولى','محادثة اثنين','محادثة اثنان','محادثة 2','محادثة الثانية','محادثة ثلاثة','محادثة ثلاثه','محادثة 3','محادثة الثالثة','محادثة أربعة','محادثة اربعة','محادثة 4','محادثة الرابعة','محادثة خمسة','محادثة 5','محادثة الخامسة','سماع واحد','سماع 1','سماع اثنين','سماع اثنان','سماع 2','سماع ثلاثة','سماع ثلاثه','سماع 3','سماع أربعة','سماع اربعة','سماع 4','سماع خمسة','سماع 5','توقف','[unk]'];
const RECORD_GRAMMAR=['أغلق','اغلق','إغلاق','إلغاء','الغاء','[unk]'];
const GREEN='#8BC99A';
function normalize(s:string){return s.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[.,،؛!?؟]/g,' ').replace(/\s+/g,' ').trim();}
function slotFrom(s:string){const t=normalize(s);const tests:[number,RegExp][]=[[1,/(محادثه|محادثة) (واحد|1|الاولى)/],[2,/(محادثه|محادثة) (اثنين|اثنان|2|الثانيه|الثانية)/],[3,/(محادثه|محادثة) (ثلاثه|ثلاثة|3|الثالثه|الثالثة)/],[4,/(محادثه|محادثة) (اربعه|اربعة|4|الرابعه|الرابعة)/],[5,/(محادثه|محادثة) (خمسه|خمسة|5|الخامسه|الخامسة)/]];return tests.find(([,re])=>re.test(t))?.[0]||null;}
function textOf(v:any){return typeof v==='string'?v:typeof v?.text==='string'?v.text:typeof v?.result==='string'?v.result:'';}
function playSlotFrom(s:string){const t=normalize(s);const m=t.match(/سماع (واحد|1|اثنين|اثنان|2|ثلاثه|ثلاثة|3|اربعه|اربعة|4|خمسه|خمسة|5)/);if(!m)return null;return ({'واحد':1,'1':1,'اثنين':2,'اثنان':2,'2':2,'ثلاثه':3,'ثلاثة':3,'3':3,'اربعه':4,'اربعة':4,'4':4,'خمسه':5,'خمسة':5,'5':5} as Record<string,number>)[m[1]]||null;}
export default function VoiceCommand(){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[listening,setListening]=useState(false),[progress,setProgress]=useState(0),[status,setStatus]=useState('جارٍ فحص أداة التعرف الصوتي…'),[heard,setHeard]=useState('');
 const listeners=useRef<any[]>([]),mounted=useRef(true),routeHandled=useRef(false);
 useEffect(()=>{mounted.current=true;(async()=>{try{await FileSystem.makeDirectoryAsync(ROOT,{intermediates:true});const info=await FileSystem.getInfoAsync(MODEL);if(info.exists){const files=await FileSystem.readDirectoryAsync(MODEL);if(files.includes('am')&&files.includes('conf')){setReady(true);setStatus('أداة التعرف الصوتي مثبتة؛ جارٍ بدء الاستماع تلقائيًا.');await startListening();return;}}setStatus('أداة التعرف الصوتي غير مثبتة. نزّلها مرة واحدة لتعمل الأوامر دون إنترنت.');}catch(e:any){setStatus('تعذر فحص ملفات التعرف الصوتي: '+(e?.message||''));}})();return()=>{mounted.current=false;void MunsatAudioCapture.stopSession();listeners.current.forEach(x=>x?.remove?.());};},[]);
 function clearListeners(){listeners.current.forEach(x=>x?.remove?.());listeners.current=[];}
 async function downloadModel(){
  if(Platform.OS!=='android'){Alert.alert('غير متاح','التعرف الصوتي متاح حاليًا على Android فقط.');return;}
  setBusy(true);setProgress(0);setStatus('جارٍ تنزيل أداة التعرف الصوتي العربية (نحو 158 ميغابايت)…');
  try{
   const free=await FileSystem.getFreeDiskStorageAsync();if(free<350*1024*1024)throw new Error('وفّر مساحة خالية لا تقل عن 350 ميغابايت.');
   await FileSystem.deleteAsync(ZIP,{idempotent:true});
   const task=FileSystem.createDownloadResumable(MODEL_URL,ZIP,{},e=>{if(e.totalBytesExpectedToWrite>0&&mounted.current)setProgress(Math.round(e.totalBytesWritten/e.totalBytesExpectedToWrite*100));});
   const result=await task.downloadAsync();if(!result||result.status<200||result.status>=300)throw new Error('فشل تنزيل ملف النموذج.');
   setStatus('اكتمل التنزيل؛ جارٍ تثبيت ملفات اللغة…');
   const out=ROOT+'unpacked';await FileSystem.deleteAsync(out,{idempotent:true});await FileSystem.makeDirectoryAsync(out,{intermediates:true});
   const sub=subscribe(({progress:p})=>{if(mounted.current)setProgress(Math.round(p*100));});
   try{await unzip(ZIP,out);}finally{sub.remove();}
   const dirs=await FileSystem.readDirectoryAsync(out);const folder=dirs.find(x=>x.startsWith('vosk-model-'));if(!folder)throw new Error('ملفات النموذج غير مكتملة.');
   await FileSystem.deleteAsync(MODEL,{idempotent:true});await FileSystem.moveAsync({from:out+'/'+folder,to:MODEL});
   await FileSystem.deleteAsync(out,{idempotent:true});await FileSystem.deleteAsync(ZIP,{idempotent:true});
   const check=await FileSystem.readDirectoryAsync(MODEL);if(!check.includes('am')||!check.includes('conf'))throw new Error('لم يكتمل تثبيت النموذج العربي.');
   setReady(true);setStatus('تم تثبيت أداة التعرف الصوتي؛ جارٍ بدء الاستماع الآن.');await startListening();
  }catch(e:any){setStatus('فشل تنزيل أو تثبيت أداة الصوت.');Alert.alert('تعذر تثبيت أداة الصوت',e?.message||'تحقق من الإنترنت ومساحة الهاتف.');}
  finally{setBusy(false);}
 }
 async function startListening(){
  if(Platform.OS!=='android'){Alert.alert('غير متاح','التعرف المحلي متاح حاليًا على Android.');return;}
  try{
   const permission=await AudioModule.requestRecordingPermissionsAsync();if(!permission.granted)throw new Error('اسمح لمنصت باستخدام الميكروفون.');
   if(Platform.Version>=33){const n=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);if(n!==PermissionsAndroid.RESULTS.GRANTED)setStatus('يمكنك الاستماع أثناء فتح التطبيق؛ الإشعار غير مفعّل.');}
   setBusy(true);setStatus('جارٍ تشغيل التعرف الصوتي عبر الميكروفون المشترك…');
   clearListeners();routeHandled.current=false;setHeard('');
   listeners.current.push(MunsatAudioCapture.addListener('onCommand',(v:any)=>{
    if(!mounted.current||routeHandled.current)return;
    const recognized=textOf(v);if(!recognized)return;setHeard(recognized);
    const slot=slotFrom(recognized);const playSlot=playSlotFrom(recognized);
    if(slot||playSlot){
     routeHandled.current=true;
     setStatus(slot?'تم التعرف على الخانة '+slot+'، جارٍ فتح المحادثة وبدء التسجيل.':'جارٍ فتح الرسالة الصوتية المطلوبة.');
     void MunsatAudioCapture.stopSession();
     setListening(false);clearListeners();
     router.push({pathname:'/(tabs)/messages',params:{slot:String(slot||playSlot),autoRecord:slot?'1':'0',autoToken:String(Date.now()),playSlot:playSlot?String(playSlot):undefined,voiceControl:'1'}});
    }else if(normalize(recognized)==='توقف'){
     setStatus('لا توجد رسالة قيد التشغيل الآن.');
    }
   }));
   listeners.current.push(MunsatAudioCapture.addListener('onCaptureError',(e:any)=>{if(mounted.current){setListening(false);setStatus('حدث خطأ في التقاط الصوت.');Alert.alert('خطأ في الصوت',e?.message||'تعذر استخدام الميكروفون.');}}));
   await MunsatAudioCapture.startSession(MODEL,GRAMMAR,RECORD_GRAMMAR);
   setListening(true);setStatus('أستمع الآن. قل: محادثة واحد إلى خمسة، أو سماع واحد إلى خمسة.');
  }catch(e:any){setListening(false);setStatus('تعذر تشغيل التعرف الصوتي.');Alert.alert('تعذر تشغيل الصوت',e?.message||'أعد المحاولة.');}
  finally{setBusy(false);}
 }
 function stopListening(){void MunsatAudioCapture.stopSession();clearListeners();setListening(false);setStatus('توقف الاستماع.');}
 async function mainAction(){if(listening){stopListening();return;}if(!ready){await downloadModel();return;}await startListening();}
 return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:62,paddingBottom:40}}>
  <Text style={{fontSize:27,fontWeight:'800',textAlign:'right',color:'#111'}}>إرسال الرسائل بواسطة التعرف الصوتي</Text>
  <Text style={{textAlign:'right',color:'#777',lineHeight:25,marginTop:10}}>اضغط الزر لبدء التعرف على الأوامر. إذا كانت أداة الصوت غير مثبتة فسيظهر لك تنزيلها أولًا، وبعد تثبيتها يمكنك تشغيل الأوامر مباشرة.</Text>
  <View style={{backgroundColor:'#F3F4F3',padding:18,borderRadius:16,marginTop:24}}>
   <Text style={{textAlign:'right',fontWeight:'800',color:'#222'}}>حالة أداة الصوت</Text>
   <Text style={{textAlign:'right',color:'#4F9864',lineHeight:24,marginTop:10}}>{status}</Text>
   {!ready&&!busy?<Text style={{textAlign:'right',color:'#777',fontSize:12,marginTop:8}}>التنزيل الأول نحو 158 ميغابايت، وبعده يعمل التعرف دون إنترنت.</Text>:null}
   {busy?<View style={{height:8,backgroundColor:'#DDD',borderRadius:8,overflow:'hidden',marginTop:16}}><View style={{height:8,width:(progress+'%') as any,backgroundColor:GREEN}}/></View>:null}
   <Pressable disabled={busy} onPress={mainAction} style={{backgroundColor:listening?'#D96B6B':GREEN,padding:16,borderRadius:12,marginTop:18,opacity:busy ? 0.6 : 1}}>
    <Text style={{textAlign:'center',fontWeight:'800',color:'#17351E'}}>{busy?'جارٍ التجهيز…':listening?'إيقاف التعرف الصوتي':ready?'ابدأ التعرف على الأوامر':'تنزيل أداة التعرف الصوتي'}</Text>
   </Pressable>
   {ready&&!listening&&!busy?<Pressable onPress={startListening} style={{backgroundColor:'#E5F0E7',padding:13,borderRadius:10,marginTop:10}}><Text style={{textAlign:'center',fontWeight:'700',color:'#315B3B'}}>بدء الاستماع الآن</Text></Pressable>:null}
  </View>
  {listening?<View style={{backgroundColor:'#EAF5EC',padding:17,borderRadius:14,marginTop:16}}><Text style={{textAlign:'center',fontWeight:'800',color:'#356B43'}}>● الاستماع نشط</Text><Text style={{textAlign:'center',color:'#555',marginTop:9}}>{heard||'قل: محادثة واحد، اثنين، ثلاثة، أربعة، أو خمسة.'}</Text></View>:null}
  <Text style={{textAlign:'right',color:'#888',fontSize:12,lineHeight:21,marginTop:22}}>عند قول «محادثة واحد» إلى «محادثة خمسة» يفتح التطبيق خانة الصديق ويبدأ التسجيل تلقائيًا. يجب تخصيص صديق للخانة أولًا.</Text>
  <Pressable onPress={()=>router.back()} style={{padding:14,marginTop:16}}><Text style={{textAlign:'center',color:'#4F9864',fontWeight:'700'}}>رجوع</Text></Pressable>
 </ScrollView>;
}
