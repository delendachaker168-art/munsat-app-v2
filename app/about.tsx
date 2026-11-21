import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export default function AboutScreen(){return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:22,paddingTop:62,paddingBottom:42}}>
 <Text style={{fontSize:27,fontWeight:'800',textAlign:'right',color:'#111'}}>حول التطبيق</Text>
 <View style={{alignItems:'center',marginTop:26,marginBottom:24}}>
  <View style={{width:76,height:76,borderRadius:22,backgroundColor:'#142B50',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#4D91D8'}}><Text style={{fontSize:48,fontWeight:'900',color:'#FFF'}}>D</Text></View>
  <Text style={{fontSize:23,fontWeight:'900',letterSpacing:2,color:'#17243A',marginTop:12}}>DELENDA</Text>
  <Text style={{fontSize:12,fontWeight:'700',letterSpacing:3,color:'#345C91',marginTop:2}}>SMART SOLUTIONS</Text>
 </View>
 <Text style={{fontSize:19,fontWeight:'800',textAlign:'right',color:'#356B45'}}>منصت – تواصل صوتي بسيط</Text>
 <Text style={{fontSize:15,color:'#444',textAlign:'right',lineHeight:27,marginTop:9}}>منصت تطبيق يهدف إلى تسهيل التواصل الصوتي بين الأصدقاء من خلال خمس خانات مخصصة للمحادثات. يتيح إرسال واستقبال الرسائل الصوتية والرد عليها باستخدام الأوامر الصوتية، دون الحاجة إلى الكتابة أو التنقل بين المحادثات.</Text>
 <View style={{height:1,backgroundColor:'#E9ECE9',marginVertical:20}}/>
 <View style={{flexDirection:'row-reverse',alignItems:'center',gap:8}}><Ionicons name="time-outline" size={22} color="#4F9864"/><Text style={{fontSize:18,fontWeight:'800',color:'#222'}}>مدة حفظ الرسائل الصوتية</Text></View>
 <View style={{backgroundColor:'#F3F6F3',borderRadius:13,padding:15,marginTop:12}}>
  <Text style={{fontSize:15,fontWeight:'800',textAlign:'right',color:'#2D6840'}}>الحفظ السحابي</Text>
  <Text style={{fontSize:14,color:'#444',textAlign:'right',lineHeight:24,marginTop:5}}>تُحفظ الرسالة الصوتية على الخادم لمدة 72 ساعة (3 أيام) من إرسالها، ثم تُحذف تلقائياً.</Text>
  <View style={{height:1,backgroundColor:'#E1E8E1',marginVertical:12}}/>
  <Text style={{fontSize:15,fontWeight:'800',textAlign:'right',color:'#2D6840'}}>الحفظ على جهاز المستلم</Text>
  <Text style={{fontSize:14,color:'#444',textAlign:'right',lineHeight:24,marginTop:5}}>إذا تم تنزيل الرسالة على الجهاز، تُحفظ النسخة المحلية لمدة 90 يوماً من تاريخ تنزيلها، ثم تُحذف تلقائياً.</Text>
 </View>
 <Text style={{fontSize:12,color:'#888',textAlign:'center',marginTop:26}}>تطوير: Delenda Smart Solutions</Text>
 </ScrollView>;}
