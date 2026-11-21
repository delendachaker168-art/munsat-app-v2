import { useEffect,useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../src/lib/supabase';
export default function Profile(){
 const [email,setEmail]=useState('');const [displayName,setDisplayName]=useState('');const [bio,setBio]=useState('');const [avatarKey,setAvatarKey]=useState<string|null>(null);const [avatarUrl,setAvatarUrl]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [photoBusy,setPhotoBusy]=useState(false);
 useEffect(()=>{(async()=>{const {data}=await supabase.auth.getUser();if(data.user){setEmail(data.user.email||'');const {data:p}=await supabase.from('profiles').select('display_name,bio,avatar_key').eq('id',data.user.id).maybeSingle();setDisplayName(p?.display_name||'');setBio(p?.bio||'');if(p?.avatar_key){setAvatarKey(p.avatar_key);setAvatarUrl(supabase.storage.from('avatars').getPublicUrl(p.avatar_key).data.publicUrl);}}})();},[]);
 async function save(){const {data}=await supabase.auth.getUser();if(!data.user)return;setBusy(true);const {error}=await supabase.from('profiles').upsert({id:data.user.id,display_name:displayName.trim(),bio:bio.trim(),updated_at:new Date().toISOString()});setBusy(false);if(error)Alert.alert('تعذر الحفظ',error.message);else Alert.alert('تم','حُدث الملف الشخصي.');}
 async function changePhoto(){
  const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)return;
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){Alert.alert('إذن الصور','اسمح لمنصت بالوصول إلى الصور لاختيار صورة الملف الشخصي.');return;}
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
  if(result.canceled||!result.assets?.[0])return;const asset=result.assets[0];const mime=asset.mimeType||'image/jpeg';
  if(!['image/jpeg','image/png','image/webp'].includes(mime)){Alert.alert('صيغة غير مدعومة','اختر صورة بصيغة JPG أو PNG أو WEBP.');return;}
  setPhotoBusy(true);
  try{
   const ext=mime==='image/jpeg'?'jpg':mime.split('/')[1];const key=user.id+'/avatar-'+Date.now()+'.'+ext;
   const bytes=await (await fetch(asset.uri)).arrayBuffer();
   const {error:uploadError}=await supabase.storage.from('avatars').upload(key,bytes,{contentType:mime,upsert:false});if(uploadError)throw uploadError;
   const {error:updateError}=await supabase.from('profiles').update({avatar_key:key,updated_at:new Date().toISOString()}).eq('id',user.id);
   if(updateError){await supabase.storage.from('avatars').remove([key]);throw updateError;}
   const old=avatarKey;setAvatarKey(key);setAvatarUrl(supabase.storage.from('avatars').getPublicUrl(key).data.publicUrl);
   if(old)await supabase.storage.from('avatars').remove([old]);
  }catch(e:any){Alert.alert('تعذر رفع الصورة',e?.message||'حاول مرة أخرى.');}
  finally{setPhotoBusy(false);}
 }
 async function deletePhoto(){if(!avatarKey)return;const {data}=await supabase.auth.getUser();if(!data.user)return;setPhotoBusy(true);const old=avatarKey;const {error}=await supabase.from('profiles').update({avatar_key:null,updated_at:new Date().toISOString()}).eq('id',data.user.id);if(error)Alert.alert('تعذر حذف الصورة',error.message);else{setAvatarKey(null);setAvatarUrl(null);await supabase.storage.from('avatars').remove([old]);}setPhotoBusy(false);}
 async function logout(){const {error}=await supabase.auth.signOut();if(error)Alert.alert('خطأ',error.message);else router.replace('/login');}
 async function deleteAccount(){Alert.alert('حذف الحساب نهائيًا','سيؤدي ذلك إلى حذف حسابك وصورتك وأصدقائك ورسائلك الصوتية وإشعاراتك. لا يمكن التراجع عن هذه العملية.',[{text:'إلغاء',style:'cancel'},{text:'حذف نهائي',style:'destructive',onPress:async()=>{setBusy(true);const {error}=await supabase.functions.invoke('delete-account',{method:'POST'});setBusy(false);if(error){Alert.alert('تعذر حذف الحساب',error.message);return;}await supabase.auth.signOut().catch(()=>{});router.replace('/login');}}]);}
 const input={backgroundColor:'#F3F4F3',padding:15,borderRadius:12,marginTop:12,textAlign:'right' as const,fontSize:15};
 return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:24,paddingTop:68,paddingBottom:40}}>
  <Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>حسابي</Text>
  <View style={{alignItems:'center',marginTop:24,marginBottom:16}}>
   {avatarUrl?<Image source={{uri:avatarUrl}} style={{width:104,height:104,borderRadius:52,backgroundColor:'#EEE'}}/>:<View style={{width:104,height:104,borderRadius:52,backgroundColor:'#E9F3EB',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:40,fontWeight:'800',color:'#4F9864'}}>{displayName.trim().charAt(0)||'م'}</Text></View>}
   <View style={{flexDirection:'row',gap:10,marginTop:12}}><Pressable disabled={photoBusy} onPress={changePhoto} style={{backgroundColor:'#8BC99A',paddingHorizontal:16,paddingVertical:10,borderRadius:10}}><Text style={{fontWeight:'700',color:'#17351E'}}>{photoBusy?'يرجى الانتظار…':'تغيير الصورة'}</Text></Pressable>{avatarKey?<Pressable disabled={photoBusy} onPress={deletePhoto} style={{backgroundColor:'#EEE',paddingHorizontal:16,paddingVertical:10,borderRadius:10}}><Text style={{color:'#555'}}>حذف الصورة</Text></Pressable>:null}</View>
  </View>
  <Text style={{textAlign:'right',color:'#777',marginTop:8}}>البريد الإلكتروني</Text><Text style={{textAlign:'right',color:'#333',marginTop:5}}>{email}</Text>
  <TextInput value={displayName} onChangeText={setDisplayName} placeholder="الاسم الظاهر للآخرين" style={input}/>
  <TextInput value={bio} onChangeText={setBio} placeholder="نبذة قصيرة (اختياري)" multiline style={[input,{minHeight:90,textAlignVertical:'top'}]}/>
  <Pressable onPress={save} disabled={busy} style={{backgroundColor:'#8BC99A',padding:16,borderRadius:12,marginTop:16}}><Text style={{textAlign:'center',fontWeight:'800'}}>{busy?'جارٍ الحفظ…':'حفظ التعديلات'}</Text></Pressable>
  <Pressable onPress={logout} style={{backgroundColor:'#F1F1F1',padding:16,borderRadius:12,marginTop:12}}><Text style={{textAlign:'center',color:'#333'}}>تسجيل الخروج</Text></Pressable>
  <Pressable disabled={busy} onPress={deleteAccount} style={{backgroundColor:'#F8E7E7',padding:15,borderRadius:12,marginTop:26}}><Text style={{textAlign:'center',color:'#9B2929',fontWeight:'700'}}>حذف الحساب نهائيًا</Text></Pressable>
 </ScrollView>;
}
