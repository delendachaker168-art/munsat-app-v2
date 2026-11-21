import { Text, View } from 'react-native';
export default function Messages(){return <View style={{flex:1,backgroundColor:'#FFF',padding:24,paddingTop:70}}>
<Text style={{fontSize:28,fontWeight:'800',textAlign:'right',color:'#111'}}>الرسائل الصوتية</Text>
<View style={{marginTop:24,backgroundColor:'#F3F4F3',padding:18,borderRadius:14}}><Text style={{textAlign:'right',fontSize:15,color:'#555',lineHeight:26}}>سيُضاف هنا تسجيل الرسائل وإرسالها واستقبالها. الحد الأقصى لكل تسجيل دقيقتان، ثم يُرسل تلقائيًا.</Text></View>
</View>}
