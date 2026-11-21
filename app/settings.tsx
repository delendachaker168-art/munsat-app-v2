import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function Row({title,subtitle,icon,onPress}:{title:string;subtitle:string;icon:any;onPress:()=>void}){
 return <Pressable onPress={onPress} style={{backgroundColor:'#F4F5F4',borderRadius:14,padding:17,marginTop:12,flexDirection:'row-reverse',alignItems:'center',gap:13}}>
  <View style={{width:42,height:42,borderRadius:12,backgroundColor:'#E4F2E7',alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={22} color="#4F9864"/></View>
  <View style={{flex:1}}><Text style={{fontSize:16,fontWeight:'800',color:'#171717',textAlign:'right'}}>{title}</Text><Text style={{fontSize:12,color:'#777',textAlign:'right',marginTop:4}}>{subtitle}</Text></View>
  <Ionicons name="chevron-back" size={18} color="#888"/>
 </Pressable>;
}
export default function SettingsScreen(){return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:64,paddingBottom:40}}>
 <Text style={{fontSize:27,fontWeight:'800',textAlign:'right',color:'#111'}}>الإعدادات</Text>
 <Text style={{fontSize:13,color:'#777',textAlign:'right',marginTop:8}}>معلومات التطبيق وطريقة استخدامه</Text>
 <Row title="دليل الأوامر الصوتية" subtitle="تعرف على الأوامر ووظيفة كل أمر" icon="mic-outline" onPress={()=>router.push('/voice-guide')}/>
 <Row title="حول التطبيق" subtitle="نبذة عن منصت والشركة المطوّرة وسياسة حفظ الرسائل" icon="information-circle-outline" onPress={()=>router.push('/about')}/>
 </ScrollView>;}
