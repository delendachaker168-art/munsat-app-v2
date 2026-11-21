import { useEffect,useRef,useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import Vosk from 'react-native-vosk';
import { subscribe,unzip } from 'react-native-zip-archive';
import { AudioModule } from 'expo-audio';

const MODEL_URL='https://alphacephei.com/vosk/models/vosk-model-small-ar-tn-0.1-linto.zip';
const MODEL_NAME='model-ar-tn';
const ROOT=(FileSystem.documentDirectory||'')+'vosk/';
const ZIP_PATH=ROOT+'arabic-model.zip';
const MODEL_PATH=ROOT+MODEL_NAME;
const RESUME_KEY='munsat:vosk-download:v1';
const EXPECTED_BYTES=158*1024*1024;
const GREEN='#8BC99A';
const GRAMMAR=['محادثة واحد','محادثة 1','محادثة الأولى','محادثة الاولى','محادثة اثنين','محادثة اثنان','محادثة 2','محادثة الثانية','محادثة اثنين','محادثة ثلاثة','محادثة ثلاثه','محادثة 3','محادثة الثالثة','محادثة أربعة','محادثة اربعة','محادثة 4','محادثة الرابعة','محادثة خمسة','محادثة 5','محادثة الخامسة','[unk]'];

function normalize(text:string){return text.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[.,،؛!?؟]/g,' ').replace(/\s+/g,' ').trim();}
function parseSlot(value:string):number|null{const t=normalize(value);const patterns:[number,RegExp][]=[[1,/(محادثه|محادثة) (واحد|1|الاولى)/],[2,/(محادثه|محادثة) (اثنين|اثنان|2|الثانيه)/],[3,/(محادثه|محادثة) (ثلاثه|ثلاثة|3|الثالثه)/],[4,/(محادثه|محادثة) (اربعه|أربعة|4|الرابعه)/],[5,/(محادثه|محادثة) (خمسه|خمسة|5|الخامسه)/]];for(const [n,re] of patterns)if(re.test(t))return n;return null;}
function formatBytes(n:number){if(n<1024*1024)return Math.round(n/1024)+' KB';return (n/1024/1024).toFixed(1)+' MB';}
function formatTime(seconds:number){if(!Number.isFinite(seconds)||seconds<0)return '—';const m=Math.floor(seconds/60);const s=Math.floor(seconds%60);return m?m+' د '+s+' ث':s+' ث';}

export default function VoiceCommand(){
 const [modelReady,setModelReady]=useState(false);const [downloading,setDownloading]=useState(false);const [extracting,setExtracting]=useState(false);const [loadingModel,setLoadingModel]=useState(false);const [listening,setListening]=useState(false);
 const [progress,setProgress]=useState(0);const [speed,setSpeed]=useState(0);const [eta,setEta]=useState(0);const [partial,setPartial]=useState('');const [recognized,setRecognized]=useState('');const [pendingSlot,setPendingSlot]=useState<number|null>(null);const [status,setStatus]=useState('النموذج العربي غير مثبت بعد.');
 const downloadRef=useRef<any>(null);const pauseRequestedRef=useRef(false);const voskRef=useRef<any>(null);const modelLoadedRef=useRef(false);const listenersRef=useRef<any[]>([]);const handledRef=useRef(false);const progressRef=useRef({bytes:0,time:Date.now()});

 useEffect(()=>{(async()=>{try{await FileSystem.makeDirectoryAsync(ROOT,{intermediates:true});const info=await FileSystem.getInfoAsync(MODEL_PATH);if(info.exists){const entries=await FileSystem.readDirectoryAsync(MODEL_PATH);if(entries.includes('am')&&entries.includes('conf')){setModelReady(true);setStatus('النموذج العربي جاهز على الجهاز.');}else{await FileSystem.deleteAsync(MODEL_PATH,{idempotent:true}).catch(()=>{});}}}catch{}})();return()=>{try{voskRef.current?.stop();voskRef.current?.unload();modelLoadedRef.current=false;}catch{}listenersRef.current.forEach(x=>x?.remove?.());};},[]);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active'&&downloadRef.current){pauseDownload(true).catch(()=>{});}});return()=>sub.remove();},[]);

 async function pauseDownload(silent=false){
  const task=downloadRef.current;if(!task)return;
  try{pauseRequestedRef.current=true;await task.pauseAsync();const saved=task.savable?.();if(saved)await AsyncStorage.setItem(RESUME_KEY,JSON.stringify(saved));}catch{}
  downloadRef.current=null;setDownloading(false);if(!silent)setStatus('توقف التنزيل مؤقتًا؛ يمكنك استكماله لاحقًا.');
 }
 async function downloadModel(){
  if(Platform.OS!=='android'){Alert.alert('غير متاح','التعرف الصوتي المحلي مضبوط حاليًا لأجهزة Android.');return;}
  setDownloading(true);setStatus('جارٍ تنزيل النموذج العربي…');progressRef.current={bytes:0,time:Date.now()};
  try{
   await FileSystem.makeDirectoryAsync(ROOT,{intermediates:true});
   const savedRaw=await AsyncStorage.getItem(RESUME_KEY);const saved=savedRaw?JSON.parse(savedRaw):null;
   const task=FileSystem.createDownloadResumable(MODEL_URL,ZIP_PATH,{},(event)=>{
    const total=event.totalBytesExpectedToWrite>0?event.totalBytesExpectedToWrite:EXPECTED_BYTES;
    const now=Date.now();const delta=event.totalBytesWritten-progressRef.current.bytes;const elapsed=Math.max(.25,(now-progressRef.current.time)/1000);
    if(delta>=0){setSpeed(delta/elapsed);setEta((total-event.totalBytesWritten)/Math.max(1,delta/elapsed));}
    progressRef.current={bytes:event.totalBytesWritten,time:now};setProgress(Math.min(100,event.totalBytesWritten/total*100));
    const current=downloadRef.current?.savable?.();if(current)AsyncStorage.setItem(RESUME_KEY,JSON.stringify(current)).catch(()=>{});
   },saved?.resumeData);
   downloadRef.current=task;
   const result=await task.downloadAsync();
   downloadRef.current=null;setDownloading(false);
   if(!result||result.status<200||result.status>=300)throw new Error('لم يكتمل تنزيل ملف النموذج.');
   await AsyncStorage.removeItem(RESUME_KEY);setProgress(100);setStatus('اكتمل التنزيل؛ جارٍ فحص الملف وفك الضغط…');setExtracting(true);
   const zipInfo=await FileSystem.getInfoAsync(ZIP_PATH);if(!zipInfo.exists||(zipInfo.size||0)<1024*1024)throw new Error('ملف النموذج غير مكتمل.');
   const output=ROOT+'unpacked';await FileSystem.deleteAsync(output,{idempotent:true}).catch(()=>{});await FileSystem.makeDirectoryAsync(output,{intermediates:true});
   const subscription=subscribe(({progress:fileProgress})=>setProgress(100+Math.min(100,fileProgress*100)));
   try{await unzip(ZIP_PATH,output);}finally{subscription.remove();}
   const entries=await FileSystem.readDirectoryAsync(output);const extracted=entries.find(x=>x.startsWith('vosk-model-'));
   if(!extracted)throw new Error('لم نعثر على مجلد النموذج بعد فك الضغط.');
   await FileSystem.deleteAsync(MODEL_PATH,{idempotent:true}).catch(()=>{});
   await FileSystem.moveAsync({from:output+'/'+extracted,to:MODEL_PATH});
   await FileSystem.deleteAsync(output,{idempotent:true}).catch(()=>{});await FileSystem.deleteAsync(ZIP_PATH,{idempotent:true}).catch(()=>{});
   const check=await FileSystem.getInfoAsync(MODEL_PATH);if(!check.exists)throw new Error('فشل التحقق من تثبيت النموذج.');
   setModelReady(true);setStatus('النموذج مثبت وجاهز للتعرف دون إنترنت.');
  }catch(e:any){setDownloading(false);if(pauseRequestedRef.current){pauseRequestedRef.current=false;return;}setStatus('تعذر إكمال التنزيل أو التثبيت. يمكنك المحاولة أو الاستكمال.');Alert.alert('تعذر تثبيت النموذج',e?.message||'تحقق من اتصال الإنترنت والمساحة المتاحة.');}
  finally{setExtracting(false);}
 }

 function removeListeners(){listenersRef.current.forEach(x=>x?.remove?.());listenersRef.current=[];}
 async function startListening(){
  if(!modelReady){Alert.alert('النموذج غير مثبت','نزّل النموذج العربي أولًا.');return;}
  if(Platform.OS!=='android'){Alert.alert('غير متاح','التعرف المحلي متاح حاليًا على Android.');return;}
  const permission=await AudioModule.requestRecordingPermissionsAsync();if(!permission.granted){Alert.alert('إذن الميكروفون','اسمح لمنصت باستخدام الميكروفون.');return;}
  setLoadingModel(true);setStatus('جارٍ تحميل النموذج في الذاكرة…');
  try{
   if(!voskRef.current)voskRef.current=new Vosk();
   if(!modelLoadedRef.current){const nativeModelPath=MODEL_PATH.startsWith('file://')?MODEL_PATH.replace('file://',''):MODEL_PATH;await voskRef.current.loadModel(nativeModelPath);modelLoadedRef.current=true;}
   removeListeners();handledRef.current=false;setRecognized('');setPartial('');setPendingSlot(null);
   listenersRef.current.push(voskRef.current.onPartialResult((text:string)=>setPartial(text)));
   listenersRef.current.push(voskRef.current.onResult((text:string)=>{
    if(handledRef.current)return;handledRef.current=true;setRecognized(text);setPartial('');voskRef.current?.stop();setListening(false);
    const slot=parseSlot(text);if(slot)setPendingSlot(slot);else setStatus('لم أفهم الأمر بوضوح. قل: محادثة واحد إلى محادثة خمسة.');
   }));
   listenersRef.current.push(voskRef.current.onError((error:any)=>{setStatus('تعذر تشغيل التعرف الصوتي.');setListening(false);Alert.alert('خطأ في التعرف',String(error));}));
   await voskRef.current.start({grammar:GRAMMAR});setListening(true);setStatus('أستمع الآن. قل: محادثة واحد إلى خمسة.'); 
  }catch(e:any){setListening(false);setStatus('تعذر تحميل النموذج.');Alert.alert('تعذر تشغيل النموذج',e?.message||'أعد المحاولة.');}
  finally{setLoadingModel(false);}
 }
 function stopListening(){try{voskRef.current?.stop();}catch{}setListening(false);setStatus('توقف الاستماع.');}
 async function confirmCommand(){
  if(!pendingSlot)return;const slot=pendingSlot;stopListening();removeListeners();try{voskRef.current?.unload();modelLoadedRef.current=false;}catch{}setPendingSlot(null);
  router.push({pathname:'/(tabs)/messages',params:{slot:String(slot),autoRecord:'1'}});
 }
 const downloadLabel=downloading?'إيقاف مؤقت':modelReady?'النموذج مثبت':'تنزيل النموذج العربي';
 return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:62,paddingBottom:40}}>
  <Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>الأوامر الصوتية</Text>
  <Text style={{textAlign:'right',color:'#777',lineHeight:25,marginTop:8}}>تحكم في خاناتك بصوتك. تتم معالجة الكلام محليًا على الجهاز دون إرساله إلى خادم.</Text>
  <View style={{backgroundColor:'#F3F4F3',borderRadius:16,padding:18,marginTop:22}}>
   <Text style={{textAlign:'right',fontWeight:'800',fontSize:17,color:'#222'}}>النموذج العربي المحلي</Text>
   <Text style={{textAlign:'right',color:'#666',lineHeight:23,marginTop:8}}>حجم التنزيل نحو 158 ميجابايت، وقد يحتاج فك الضغط إلى مساحة إضافية. بعد تثبيته يعمل التعرف دون إنترنت.</Text>
   <Text style={{textAlign:'right',color:'#4F9864',fontWeight:'700',marginTop:12}}>{status}</Text>
   {downloading||extracting?<><View style={{height:9,backgroundColor:'#DDD',borderRadius:8,overflow:'hidden',marginTop:14}}><View style={{height:9,width:Math.min(100,progress)+'%',backgroundColor:GREEN}}/></View><Text style={{textAlign:'right',color:'#555',marginTop:8}}>{downloading?Math.min(100,progress).toFixed(1)+'% · '+formatBytes(progress/100*EXPECTED_BYTES):'جارٍ فك الضغط…'}</Text>{downloading?<Text style={{textAlign:'right',color:'#777',fontSize:12,marginTop:5}}>السرعة: {formatBytes(speed)}/ث · المتبقي: {formatTime(eta)}</Text>:null}</>:null}
   {downloading?<Pressable onPress={()=>pauseDownload()} style={secondaryButton}><Text style={buttonText}>إيقاف مؤقت</Text></Pressable>:!modelReady?<Pressable disabled={extracting} onPress={downloadModel} style={primaryButton}><Text style={buttonText}>{extracting?'جارٍ التثبيت…':downloadLabel}</Text></Pressable>:<View style={{backgroundColor:'#E5F3E8',padding:13,borderRadius:10,marginTop:15}}><Text style={{textAlign:'center',color:'#356B43',fontWeight:'700'}}>✓ النموذج جاهز على جهازك</Text></View>}
   {modelReady?<Pressable disabled={loadingModel||downloading||extracting} onPress={listening?stopListening:startListening} style={[primaryButton,{backgroundColor:listening?'#D96B6B':GREEN}]}><Text style={buttonText}>{loadingModel?'جارٍ التحميل…':listening?'إيقاف الاستماع':'ابدأ الاستماع للأوامر'}</Text></Pressable>:null}
  </View>
  {listening?<View style={{backgroundColor:'#EAF5EC',padding:16,borderRadius:14,marginTop:16}}><Text style={{textAlign:'center',fontWeight:'800',color:'#356B43'}}>● الاستماع نشط</Text><Text style={{textAlign:'center',color:'#555',marginTop:8}}>{partial||'قل: محادثة واحد، اثنين، ثلاثة، أربعة، أو خمسة.'}</Text></View>:null}
  {recognized?<View style={{backgroundColor:'#F3F4F3',padding:16,borderRadius:14,marginTop:16}}><Text style={{textAlign:'right',fontWeight:'700',color:'#333'}}>ما تم التعرف عليه: {recognized}</Text></View>:null}
  {pendingSlot?<View style={{backgroundColor:'#EAF5EC',padding:18,borderRadius:14,marginTop:16}}><Text style={{textAlign:'right',fontWeight:'800',fontSize:18,color:'#222'}}>هل تريد بدء محادثة الخانة {pendingSlot}؟</Text><Text style={{textAlign:'right',color:'#666',marginTop:7}}>لن يبدأ التسجيل إلا بعد تأكيدك.</Text><Pressable onPress={confirmCommand} style={primaryButton}><Text style={buttonText}>تأكيد وبدء التسجيل</Text></Pressable><Pressable onPress={()=>{setPendingSlot(null);setRecognized('');}} style={secondaryButton}><Text style={buttonText}>إلغاء</Text></Pressable></View>:null}
  <Text style={{textAlign:'right',color:'#999',fontSize:12,marginTop:24,lineHeight:20}}>النموذج العربي المستخدم إصدار تونسي من Vosk. قد تختلف دقة فهم اللهجة الجزائرية، لذلك يعرض التطبيق الأمر للتأكيد قبل بدء التسجيل.</Text>
 </ScrollView>;
}
const primaryButton={backgroundColor:GREEN,padding:15,borderRadius:11,marginTop:15};const secondaryButton={backgroundColor:'#E6E8E6',padding:13,borderRadius:11,marginTop:10};const buttonText={textAlign:'center' as const,fontWeight:'800' as const,color:'#17351E'};
