import { useCallback,useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
type Profile={id:string;display_name:string|null;bio:string|null;avatar_key:string|null};
type Friendship={id:string;requester_id:string;addressee_id:string;status:string;requester?:Profile;addressee?:Profile};
const green='#8BC99A';
function Avatar({profile,size=44}:{profile:Profile;size?:number}){const uri=profile.avatar_key?supabase.storage.from('avatars').getPublicUrl(profile.avatar_key).data.publicUrl:null;return uri?<Image source={{uri}} style={{width:size,height:size,borderRadius:size/2,backgroundColor:'#EEE'}}/>:<View style={{width:size,height:size,borderRadius:size/2,backgroundColor:'#E6F2E8',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:size*.42,fontWeight:'800',color:'#4F9864'}}>{profile.display_name?.trim().charAt(0)||'م'}</Text></View>;}
export default function Friends(){
 const [query,setQuery]=useState('');const [results,setResults]=useState<Profile[]>([]);const [requests,setRequests]=useState<Friendship[]>([]);const [friendships,setFriendships]=useState<Friendship[]>([]);const [slots,setSlots]=useState<Record<number,string|null>>({});const [me,setMe]=useState('');
 const friends=friendships.map(x=>(x.requester_id===me?x.addressee:x.requester)!).filter((p):p is Profile=>Boolean(p));
 const load=useCallback(async()=>{
  const {data}=await supabase.auth.getUser();if(!data.user)return;setMe(data.user.id);
  const {data:req,error}=await supabase.from('friendships').select('id,requester_id,addressee_id,status,requester:profiles!friendships_requester_id_fkey(id,display_name,bio,avatar_key),addressee:profiles!friendships_addressee_id_fkey(id,display_name,bio,avatar_key)').or('requester_id.eq.'+data.user.id+',addressee_id.eq.'+data.user.id).order('created_at',{ascending:false});
  if(error){Alert.alert('تعذر تحميل الأصدقاء',error.message);return;}
  const rows=(req||[]) as unknown as Friendship[];setRequests(rows.filter(x=>x.status==='pending'&&x.addressee_id===data.user!.id));setFriendships(rows.filter(x=>x.status==='accepted'));
  const {data:sl}=await supabase.from('voice_slots').select('slot_number,friend_id').eq('owner_id',data.user.id);const map:Record<number,string|null>={};(sl||[]).forEach(x=>map[x.slot_number]=x.friend_id);setSlots(map);
 },[]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 async function search(){if(!query.trim())return;const {data,error}=await supabase.from('profiles').select('id,display_name,bio,avatar_key').ilike('display_name','%'+query.trim()+'%').neq('id',me).limit(10);if(error)Alert.alert('تعذر البحث',error.message);else setResults((data||[]) as Profile[]);}
 async function add(p:Profile){
  const pair='and(requester_id.eq.'+me+',addressee_id.eq.'+p.id+'),and(requester_id.eq.'+p.id+',addressee_id.eq.'+me+')';
  const {data:existing}=await supabase.from('friendships').select('id,status').or(pair).maybeSingle();
  if(existing){Alert.alert('تنبيه',existing.status==='accepted'?'هذا المستخدم ضمن أصدقائك بالفعل.':existing.status==='pending'?'يوجد طلب صداقة سابق بينكما.':'لا يمكن إرسال طلب جديد لهذا المستخدم حاليًا.');return;}
  const {error}=await supabase.from('friendships').insert({requester_id:me,addressee_id:p.id});if(error)Alert.alert('تعذر إرسال الطلب',error.message);else{Alert.alert('تم','أُرسل طلب الصداقة.');setResults([]);}
 }
 async function respond(id:string,status:'accepted'|'rejected'){const {error}=await supabase.rpc('respond_to_friend_request',{friendship_id:id,next_status:status});if(error)Alert.alert('تعذر تحديث الطلب',error.message);else load();}
 async function removeFriend(id:string){Alert.alert('إزالة الصديق','هل تريد إزالة هذا الصديق؟', [{text:'إلغاء',style:'cancel'},{text:'إزالة',style:'destructive',onPress:async()=>{const {error}=await supabase.rpc('remove_friend',{friendship_id:id});if(error)Alert.alert('تعذر الإزالة',error.message);else load();}}]);}
 async function blockFriend(id:string){Alert.alert('حظر الصديق','لن يتمكن هذا المستخدم من تبادل الرسائل معك.', [{text:'إلغاء',style:'cancel'},{text:'حظر',style:'destructive',onPress:async()=>{const {error}=await supabase.rpc('block_friend',{friendship_id:id});if(error)Alert.alert('تعذر الحظر',error.message);else load();}}]);}
 async function assign(slot:number,friendId:string|null){
  if(friendId){const duplicate=Object.entries(slots).find(([n,id])=>id===friendId&&Number(n)!==slot);if(duplicate){Alert.alert('تخصيص مكرر','هذا الصديق موجود بالفعل في الخانة '+duplicate[0]+'.');return;}}
  const {error}=await supabase.from('voice_slots').upsert({owner_id:me,slot_number:slot,friend_id:friendId},{onConflict:'owner_id,slot_number'});if(error)Alert.alert('تعذر التخصيص',error.message);else setSlots(v=>({...v,[slot]:friendId}));
 }
 const occupied=Object.values(slots).filter(Boolean).length;
 return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:62,paddingBottom:40}}>
  <Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>الأصدقاء</Text><Text style={{textAlign:'right',color:'#777',marginTop:7,marginBottom:20}}>ابحث عن الأصدقاء، ثم خصص لكل واحد خانة صوتية.</Text>
  <View style={{flexDirection:'row-reverse',gap:8}}><TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالاسم الظاهر" style={{flex:1,backgroundColor:'#F2F3F2',borderRadius:11,padding:13,textAlign:'right'}}/><Pressable onPress={search} style={{backgroundColor:green,paddingHorizontal:18,justifyContent:'center',borderRadius:11}}><Text style={{fontWeight:'700'}}>بحث</Text></Pressable></View>
  {results.map(p=><View key={p.id} style={card}><Avatar profile={p}/><View style={{flex:1}}><Text style={name}>{p.display_name||'مستخدم منصت'}</Text><Text style={sub}>{p.bio||' '}</Text></View><Pressable onPress={()=>add(p)} style={smallButton}><Text style={{fontWeight:'700'}}>إضافة</Text></Pressable></View>)}
  <Text style={heading}>طلبات الصداقة الواردة</Text>{requests.length===0?<Text style={sub}>لا توجد طلبات جديدة.</Text>:requests.map(r=><View key={r.id} style={card}><Avatar profile={r.requester||{id:'',display_name:'م',bio:null,avatar_key:null}}/><Text style={[name,{flex:1}]}>{r.requester?.display_name||'مستخدم'}</Text><View style={{flexDirection:'row',gap:7}}><Pressable onPress={()=>respond(r.id,'accepted')} style={smallButton}><Text>قبول</Text></Pressable><Pressable onPress={()=>respond(r.id,'rejected')} style={[smallButton,{backgroundColor:'#EEE'}]}><Text>رفض</Text></Pressable></View></View>)}
  <Text style={heading}>الأصدقاء المقبولون ({friends.length})</Text>{friendships.length===0?<Text style={sub}>لم تضف أصدقاء بعد.</Text>:friendships.map(r=>{const p=(r.requester_id===me?r.addressee:r.requester)||{id:'',display_name:'مستخدم',bio:null,avatar_key:null};return <View key={r.id} style={card}><Avatar profile={p}/><Text style={[name,{flex:1}]}>{p.display_name||'صديق'}</Text><Pressable onPress={()=>removeFriend(r.id)} style={[smallButton,{backgroundColor:'#EEE'}]}><Text>إزالة</Text></Pressable><Pressable onPress={()=>blockFriend(r.id)} style={[smallButton,{backgroundColor:'#F2DADA'}]}><Text>حظر</Text></Pressable></View>;})}
  <Text style={heading}>خانات الرسائل الخمس · {occupied}/5</Text>{occupied===5?<Text style={sub}>الخانات الخمس ممتلئة. أزل صديقًا من خانة قبل تخصيص صديق آخر.</Text>:null}
  {[1,2,3,4,5].map(n=><View key={n} style={card}><Text style={name}>الخانة {n}</Text><View style={{flexDirection:'row-reverse',flexWrap:'wrap',gap:6,justifyContent:'flex-end',flex:1}}><Pressable onPress={()=>assign(n,null)} style={[smallButton,{backgroundColor:'#EEE'}]}><Text>فارغة</Text></Pressable>{friendships.map(r=>{const p=(r.requester_id===me?r.addressee:r.requester)!;return <Pressable key={p.id} onPress={()=>assign(n,p.id)} style={[smallButton,{backgroundColor:slots[n]===p.id?green:'#F0F1F0'}]}><Text>{p.display_name||'صديق'}</Text></Pressable>;})}</View></View>)}
 </ScrollView>;
}
const card={backgroundColor:'#F4F5F4',padding:12,borderRadius:12,marginTop:10,flexDirection:'row-reverse' as const,alignItems:'center' as const,justifyContent:'space-between' as const,gap:9};const name={fontSize:15,fontWeight:'700' as const,color:'#222',textAlign:'right' as const};const sub={fontSize:12,color:'#888',textAlign:'right' as const,marginTop:4};const heading={fontSize:20,fontWeight:'800' as const,textAlign:'right' as const,color:'#111',marginTop:28,marginBottom:8};const smallButton={backgroundColor:green,paddingHorizontal:11,paddingVertical:9,borderRadius:9};
