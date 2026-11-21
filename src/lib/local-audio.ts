import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const CACHE_KEY='munsat:voice-cache:v1';
const RETENTION_MS=90*24*60*60*1000;
type CacheIndex=Record<string,{uri:string;downloadedAt:number}>;
async function readIndex():Promise<CacheIndex>{try{return JSON.parse((await AsyncStorage.getItem(CACHE_KEY))||'{}') as CacheIndex;}catch{return {};}}

export async function getCachedVoiceUri(messageId:string):Promise<string|null>{
 const item=(await readIndex())[messageId];if(!item)return null;
 try{const info=await FileSystem.getInfoAsync(item.uri);return info.exists?item.uri:null;}catch{return null;}
}

export async function cacheVoiceMessage(messageId:string,signedUrl:string,extension='m4a'):Promise<string>{
 const index=await readIndex();const cached=index[messageId];
 if(cached){try{const info=await FileSystem.getInfoAsync(cached.uri);if(info.exists)return cached.uri;}catch{}}
 const root=FileSystem.documentDirectory;if(!root)throw new Error('مساحة التخزين المحلية غير متاحة.');
 const directory=root+'voice-messages/';await FileSystem.makeDirectoryAsync(directory,{intermediates:true}).catch(()=>{});
 const safeExtension=/^[a-z0-9]+$/i.test(extension)?extension:'m4a';
 const destination=directory+messageId+'.'+safeExtension;
 const result=await FileSystem.downloadAsync(signedUrl,destination);
 index[messageId]={uri:result.uri,downloadedAt:Date.now()};
 await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(index));
 return result.uri;
}

export async function pruneExpiredVoiceCache():Promise<void>{
 const index=await readIndex();const now=Date.now();let changed=false;
 for(const [id,item] of Object.entries(index)){
  if(now-item.downloadedAt>=RETENTION_MS){try{await FileSystem.deleteAsync(item.uri,{idempotent:true});}catch{}delete index[id];changed=true;}
  else{try{const info=await FileSystem.getInfoAsync(item.uri);if(!info.exists){delete index[id];changed=true;}}catch{delete index[id];changed=true;}}
 }
 if(changed)await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(index));
}

export async function clearLocalVoiceCache():Promise<void>{
 const index=await readIndex();
 for(const item of Object.values(index)){try{await FileSystem.deleteAsync(item.uri,{idempotent:true});}catch{}}
 await AsyncStorage.removeItem(CACHE_KEY);
}
