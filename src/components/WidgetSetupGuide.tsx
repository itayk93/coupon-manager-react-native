import React from 'react';
import {Platform,StyleSheet,Text,View} from 'react-native';
import {fonts,radii} from '@/lib/theme';
/** Setup does not select coupons, reveal codes, request permissions or write data. */
export function WidgetSetupGuide({theme}:{theme:{card:string;cardBorder:string;text:string;textMuted:string}}){
 const platforms=Platform.OS==='ios'?['ios']:Platform.OS==='android'?['android']:['ios','android'];
 return <View style={[styles.card,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}>
  <Text accessibilityRole="header" style={[styles.title,{color:theme.text}]}>הארנק שלך, בלי לפתוח את האפליקציה</Text>
  <Text style={[styles.body,{color:theme.textMuted}]}>יתרה וקופונים נבחרים במסך הבית, ותזכורת לקופונים שעומדים לפוג. לחיצה על קופון בווידג׳ט פותחת את הפרטים שלו.</Text>
  {platforms.map(platform=><View key={platform} style={styles.steps}>
   <Text accessibilityRole="header" style={[styles.subtitle,{color:theme.text}]}>{platform==='ios'?'הוספה באייפון':'הוספה באנדרואיד'}</Text>
   {(platform==='ios'?['לחיצה ארוכה על אזור ריק במסך הבית.','עריכה, ואז הוספת ווידג׳ט.','חפשו קופון מאסטר, בחרו גודל והוסיפו למסך הבית.']:['לחיצה ארוכה על אזור ריק במסך הבית.','בחרו ווידג׳טים וחפשו קופון מאסטר.','לחיצה ארוכה על התצוגה הרצויה וגרירה למסך הבית.']).map((step,i)=><Text key={step} style={[styles.body,{color:theme.textMuted}]}>{i+1}. {step}</Text>)}
  </View>)}
  <Text style={[styles.body,{color:theme.textMuted}]}>לא מופיע ברשימה? צריך להתקין גרסת אפליקציה שכוללת ווידג׳טים ולפתוח אותה פעם אחת. הוספת האתר למסך הבית ו־Expo Go אינן מתקינות את הווידג׳ט.</Text>
  <Text style={[styles.body,{color:theme.textMuted}]}>בחרו בהמשך את הקופונים שתרצו להציג. קודים עשויים להיות גלויים במסך הבית גם כשהאפליקציה נעולה, אז בחרו רק מה שנוח לכם להציג.</Text>
  <Text style={[styles.body,{color:theme.textMuted}]}>העדכון מתבקש גם ברקע, אבל מערכת ההפעלה קובעת מתי הוא יקרה. אחרי שינוי ביתרה אפשר לפתוח את האפליקציה כדי לרענן את העותק השמור.</Text>
 </View>;
}
const styles=StyleSheet.create({card:{borderWidth:1,borderRadius:radii.lg,padding:16,gap:12,marginBottom:8},title:{fontFamily:fonts.bodyBold,fontSize:18,lineHeight:27,textAlign:'right',writingDirection:'rtl'},subtitle:{fontFamily:fonts.bodyBold,fontSize:15,lineHeight:24,textAlign:'right',writingDirection:'rtl'},body:{fontFamily:fonts.body,fontSize:14,lineHeight:23,textAlign:'right',writingDirection:'rtl'},steps:{gap:4}});
