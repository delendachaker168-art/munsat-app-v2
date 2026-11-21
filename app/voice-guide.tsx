import { ScrollView, Text, View } from 'react-native';
const groups=[{title:'أولاً: معرفة مصدر الرسالة',rows:[['رسالة من واحد','إشعار بوصول رسالة من الخانة الأولى'],['رسالة من اثنين','إشعار بوصول رسالة من الخانة الثانية'],['رسالة من ثلاثة','إشعار بوصول رسالة من الخانة الثالثة'],['رسالة من أربعة','إشعار بوصول رسالة من الخانة الرابعة'],['رسالة من خمسة','إشعار بوصول رسالة من الخانة الخامسة']]},{title:'ثانياً: بدء المحادثة والرد',rows:[['محادثة واحد','فتح الخانة الأولى وطلب تأكيد بدء التسجيل'],['محادثة اثنين','فتح الخانة الثانية وطلب تأكيد بدء التسجيل'],['محادثة ثلاثة','فتح الخانة الثالثة وطلب تأكيد بدء التسجيل'],['محادثة أربعة','فتح الخانة الرابعة وطلب تأكيد بدء التسجيل'],['محادثة خمسة','فتح الخانة الخامسة وطلب تأكيد بدء التسجيل']]},{title:'ثالثاً: التحكم في التسجيل',rows:[['أغلق','إيقاف التسجيل وإرسال الرسالة الصوتية']]}];
export default function VoiceGuide(){return <ScrollView style={{flex:1,backgroundColor:'#FFF'}} contentContainerStyle={{padding:20,paddingTop:62,paddingBottom:40}}>
 <Text style={{fontSize:26,fontWeight:'800',textAlign:'right',color:'#111'}}>دليل الأوامر الصوتية</Text>
 <Text style={{fontSize:13,color:'#777',textAlign:'right',marginTop:8,marginBottom:14}}>استخدم العبارات التالية للتحكم في المحادثات صوتياً.</Text>
 {groups.map((group,index)=><View key={group.title} style={{marginTop:14}}>
  <Text style={{fontSize:17,fontWeight:'800',textAlign:'right',color:'#356B45',marginBottom:9}}>{group.title}</Text>
  <View style={{borderWidth:1,borderColor:'#E7EAE7',borderRadius:12,overflow:'hidden'}}>
   <View style={{flexDirection:'row-reverse',backgroundColor:'#EAF4EC',padding:11}}><Text style={{flex:1,textAlign:'right',fontWeight:'800',color:'#244B30'}}>الأمر الصوتي</Text><Text style={{flex:1,textAlign:'right',fontWeight:'800',color:'#244B30'}}>الوظيفة</Text></View>
   {group.rows.map((row,i)=><View key={row[0]} style={{flexDirection:'row-reverse',padding:11,backgroundColor:i%2===0?'#FFF':'#F8F9F8',borderTopWidth:1,borderTopColor:'#EEF0EE'}}><Text style={{flex:1,textAlign:'right',fontWeight:'700',color:'#222'}}>{row[0]}</Text><Text style={{flex:1,textAlign:'right',color:'#555',lineHeight:21}}>{row[1]}</Text></View>)}
  </View>
 </View>)}
 <View style={{backgroundColor:'#F3F4F3',padding:14,borderRadius:12,marginTop:18}}><Text style={{textAlign:'right',color:'#555',lineHeight:23}}>ملاحظة: يفتح أمر «محادثة» الخانة المحددة، ثم يطلب منك تأكيد بدء التسجيل. أمر «أغلق» مخصص لإيقاف التسجيل وإرسال الرسالة الصوتية، ويحتاج إلى استكمال تفعيله في نظام التعرف الصوتي.</Text></View>
 </ScrollView>;}
