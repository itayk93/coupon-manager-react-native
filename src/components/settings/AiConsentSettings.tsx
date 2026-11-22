import React,{useRef,useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {useAppTheme} from '@/contexts/ThemeContext';
import {useQueryClient} from '@tanstack/react-query';
import {useAiConsent} from '@/lib/aiConsent';
import {saveAiConsent} from '@/lib/aiConsentPersistence';
import {fonts,radii} from '@/lib/theme';
import {notify} from '@/lib/notify';
export function AiConsentSettings({prompt=false, expectedOwnerId, onSaved}: {prompt?:boolean; expectedOwnerId?:string; onSaved?:(granted:boolean)=>void} = {}){
 const{theme}=useAppTheme(),router=useRouter(),query=useQueryClient(),consent=useAiConsent();const[busy,setBusy]=useState(false);const[saveError,setSaveError]=useState('');const saving=useRef(false);
 const text={fontFamily:fonts.body,color:theme.text,textAlign:'right' as const,lineHeight:23,fontSize:14};
 async function save(granted:boolean){if(saving.current)return;saving.current=true;setBusy(true);setSaveError('');try{
  const ownerId = expectedOwnerId || consent.userId;
  if(!ownerId || ownerId!==consent.userId) throw new Error('החשבון השתנה. יש לפתוח שוב את מסך החשבון');
  await saveAiConsent(granted, ownerId);
  if(!granted){await query.cancelQueries({predicate:q=>String(q.queryKey[0]).startsWith('coupon-merchant-')});query.removeQueries({predicate:q=>String(q.queryKey[0]).startsWith('coupon-merchant-')})}
  if(prompt) onSaved?.(granted);
  else notify.success(granted?'הבחירה נשמרה':'ההסכמה בוטלה',granted?'שיתוף עם OpenAI מופעל לחשבון הזה':'בקשות חדשות ל-OpenAI ייחסמו. התראות רגילות והזנה ידנית ממשיכות לעבוד');
 }catch(e:any){setSaveError(e.message||'הבחירה לא נשמרה. אפשר לנסות שוב');if(!prompt)notify.error('הבחירה לא נשמרה',e.message)}finally{saving.current=false;setBusy(false)}}
 return <View testID="ai-consent-settings" style={{backgroundColor:theme.card,borderColor:theme.border,borderWidth:prompt?0:1,borderRadius:radii.lg,padding:18,gap:12,marginBottom:prompt?0:20}}>
 <Text style={{...text,fontFamily:fonts.bodyBold,fontSize:18}}>{prompt?'לבחירתך: שיתוף עם OpenAI':'שיתוף עם AI'}</Text>
 {prompt&&<Text style={text}>הטקסט והתמונה נשארים בטופס. רק אחרי אישור מפורש ושמירת הבחירה נמשיך לפענוח. אפשר לסגור או להמשיך ידנית בלי לשלוח ל-AI.</Text>}
 <Text style={text}>רק אם תאשר, נשתף עם OpenAI טקסטים ותמונות שתבחר לפענוח, כתובות ותוכן דפי קופון מצורפים, שמות חברות, פרטי קופונים ומימושים. תמונות וטקסטים עלולים לכלול קוד קופון, יתרה ופרטים אישיים. חיפוש בתי עסק עשוי לשלוח שאילתת חיפוש ותיאור קופון.</Text>
 <Text style={text}>האישור כולל גם ניסוח אוטומטי של התראות ברקע: סוג האירוע, שמות חברות, סכומים, יתרות ומועדי תפוגה. בלי אישור, ההתראות יישלחו בניסוח קבוע ללא OpenAI. ההזנה הידנית ושאר האפליקציה נשארות זמינות.</Text>
 <Text style={text}>אפשר לסרב או לבטל כאן בכל עת. ביטול עוצר בקשות חדשות, אך אינו מחזיר מידע שכבר נשלח או מבטל עיבוד שכבר התחיל. עיבוד ושמירה אצל הספק כפופים לתנאי השירות שלו.</Text>
 <TouchableOpacity accessibilityRole="link" onPress={()=>{if(prompt)onSaved?.(false);router.push('/privacy')}}><Text style={{...text,color:theme.primary,textDecorationLine:'underline'}}>מדיניות פרטיות</Text></TouchableOpacity>
 <Text accessibilityLiveRegion="polite" style={text}>{consent.loading?'בודק את העדפת החשבון...':consent.allowed?'שיתוף עם OpenAI מאושר לחשבון הזה':'שיתוף עם OpenAI אינו מאושר'}</Text>
 {saveError&&<Text accessibilityRole="alert" style={{...text,color:theme.danger}}>{saveError}</Text>}
 {(prompt||!consent.allowed)&&<TouchableOpacity testID="ai-consent-allow" accessibilityRole="button" disabled={busy||consent.loading||!consent.userId} onPress={()=>void save(true)} style={{padding:13,borderRadius:12,backgroundColor:theme.primary}}><Text style={{...text,color:'#FFFFFF',fontFamily:fonts.bodyBold}}>{busy?'שומר...':'אני מסכים לשיתוף המפורט עם OpenAI'}</Text></TouchableOpacity>}
 <TouchableOpacity testID="ai-consent-decline" accessibilityRole="button" disabled={busy||consent.loading||!consent.userId} onPress={()=>void save(false)} style={{padding:13,borderRadius:12,borderWidth:1,borderColor:theme.border}}><Text style={text}>{prompt?'ללא AI, אשאיר את הטופס כמו שהוא':consent.allowed?'ביטול ההסכמה':'להמשיך בלי AI'}</Text></TouchableOpacity>
 </View>
                                                   }
