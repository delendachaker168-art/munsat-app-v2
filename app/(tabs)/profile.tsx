import { Alert, Pressable, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
export default function Profile(){async function logout(){const {error}=await supabase.auth.signOut();if(error)Alert.alert('خطأ',error.message);}
return <View style={{flex:1,backgroundColor:'#FFF',padding:24,paddingTop:70}}><Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>حسابي</Text><Pressable onPress={logout} style={{marginTop:30,padding:17,borderRadius:12,backgroundColor:'#F1F1F1'}}><Text style={{textAlign:'center',color:'#222'}}>تسجيل الخروج</Text></Pressable></View>}
