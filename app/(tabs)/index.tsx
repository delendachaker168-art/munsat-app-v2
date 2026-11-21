import { Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
export default function Home(){return <View style={{flex:1,backgroundColor:'#FFF',padding:24,paddingTop:70}}>
<Text style={{fontSize:30,fontWeight:'800',color:'#111',textAlign:'right'}}>مرحبًا بك في منصت</Text>
<Text style={{fontSize:16,color:'#777',textAlign:'right',marginTop:10,lineHeight:27}}>منصة للتواصل وتبادل الرسائل الصوتية بسهولة.</Text>
<Pressable onPress={()=>router.push('/(tabs)/messages')} style={{marginTop:32,backgroundColor:'#8BC99A',padding:18,borderRadius:14}}><Text style={{textAlign:'center',fontWeight:'700',fontSize:17,color:'#15351D'}}>الانتقال إلى الرسائل الصوتية</Text></Pressable>
</View>}
