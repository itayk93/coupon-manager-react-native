import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {useAppTheme} from '@/contexts/ThemeContext';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAiConsent,aiConsentRecord,AI_CONSENT_KEY} from '@/lib/aiConsent';
import {fonts,radii} from '@/lib/theme';
import {notify} from '@/lib/notify';
export function AiConsentSettings(){
 const{theme}=useAppTheme(),router=useRouter(),query=useQueryClient(),consent=useAiConsent();const[busy,setBusy]=useState(false);
 const text={fontFamily:fonts.body,color:theme.text,textAlign:'right' as const,lineHeight:23,fontSize:14};
 async function save(granted:boolean){if(busy)return;setBusy(true);try{
  const{data,error:accountError}=await supabase.auth.getUser();if(accountError||!data.user)throw new Error('נדרשת התחברות כדי לשמור את הבחירה');
  // A newly signed-in account must make its own choice, never inherit this screen's old account.
  if(data.user.id!==consent.userId)throw new Error('החשבון השתנה. יש לפתוח שוב את מסך החשבון');
  const{error}=await supabase.auth.updateUser({data:{[AI_CONSENT_KEY]:aiConsentRecord(granted)}});if(error)throw error;
  if(!granted){await query.cancelQueries({predicate:q=>String(q.queryKey[0]).startsWith('coupon-merchant-')});query.removeQueries({predicate:q=>String(q.queryKey[0]).startsWith('coupon-merchant-')})}
  notify.success(granted?'הבחירה נשמרה':'ההסכמה בוטלה',granted?'שיתוף עם OpenAI מופעל לחשבון הזה':'בקשות חדשות ל-OpenAI ייחסמו. התראות רגילות והזנה ידנית ממשיכות לעבוד');
 }catch(e:any){notify.error('הבחירה לא נשמרה',e.message)}finally{setBusy(false)}}
 return <View testID="ai-consent-settings" style={{backgroundColor:theme.card,borderColor:theme.border,borderWidth:1,borderRadius:radii.lg,padding:18,gap:12,marginBottom:20}}>
 <Text style={{...text,fontFamily:fonts.bodyBold,fontSize:18}}>שיתוף עם AI</Text>
 <Text style={text}>רק אם תאשר, נשתף עם OpenAI טקסטים ותמונות שתבחר לפענוח, כתובות ותוכן דפי קופון מצורפים, שמות חברות, פרטי קופונים ומימושים. תמונות וטקסטים עלולים לכלול קוד קופון, יתרה ופרטים אישיים. חיפוש בתי עסק עשוי לשלוח שאילתת חיפוש ותיאור קופון.</Text>
 <Text style={text}>האישור כולל גם ניסוח אוטומטי של התראות ברקע: סוג האירוע, שמות חברות, סכומים, יתרות ומועדי תפוגה. בלי אישור, ההתראות יישלחו בניסוח קבוע ללא OpenAI. ההזנה הידנית ושאר האפליקציה נשארות זמינות.</Text>
 <Text style={text}>אפשר לסרב או לבטל כאן בכל עת. ביטול עוצר בקשות חדשות, אך אינו מחזיר מידע שכבר נשלח או מבטל עיבוד שכבר התחיל. עיבוד ושמירה אצל הספק כפופים לתנאי השירות שלו.</Text>
 <TouchableOpacity accessibilityRole="link" onPress={()=>router.push('/privacy')}><Text style={{...text,color:theme.primary,textDecorationLine:'underline'}}>מדיניות פרטיות</Text></TouchableOpacity>
 <Text accessibilityLiveRegion="polite" style={text}>{consent.loading?'בודק את העדפת החשבון...':consent.allowed?'שיתוף עם OpenAI מאושר לחשבון הזה':'שיתוף עם OpenAI אינו מאושר'}</Text>
 {!consent.allowed&&<TouchableOpacity testID="ai-consent-allow" accessibilityRole="button" disabled={busy||consent.loading||!consent.userId} onPress={()=>void save(true)} style={{padding:13,borderRadius:12,backgroundColor:theme.primary}}><Text style={{...text,color:'#FFFFFF',fontFamily:fonts.bodyBold}}>{busy?'שומר...':'אני מסכים לשיתוף המפורט עם OpenAI'}</Text></TouchableOpacity>}
 <TouchableOpacity testID="ai-consent-decline" accessibilityRole="button" disabled={busy||consent.loading||!consent.userId} onPress={()=>void save(false)} style={{padding:13,borderRadius:12,borderWidth:1,borderColor:theme.border}}><Text style={text}>{consent.allowed?'ביטול ההסכמה':'להמשיך בלי AI'}</Text></TouchableOpacity>
 </View>
                                                   }
