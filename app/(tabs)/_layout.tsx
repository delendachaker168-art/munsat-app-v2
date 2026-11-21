import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
export default function TabsLayout(){return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:'#4F9864',tabBarInactiveTintColor:'#888',tabBarStyle:{backgroundColor:'#FFF',borderTopColor:'#EEE',height:62,paddingBottom:7,paddingTop:5}}}>
<Tabs.Screen name="index" options={{title:'الرئيسية',tabBarIcon:({color,size})=><Ionicons name="home-outline" color={color} size={size}/>}}/>
<Tabs.Screen name="messages" options={{title:'الرسائل',tabBarIcon:({color,size})=><Ionicons name="mic-outline" color={color} size={size}/>}}/>
<Tabs.Screen name="friends" options={{title:'الأصدقاء',tabBarIcon:({color,size})=><Ionicons name="people-outline" color={color} size={size}/>}}/>
<Tabs.Screen name="profile" options={{title:'حسابي',tabBarIcon:({color,size})=><Ionicons name="person-outline" color={color} size={size}/>}}/>
</Tabs>;}
