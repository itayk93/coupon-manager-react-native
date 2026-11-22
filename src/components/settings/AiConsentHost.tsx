import React, {useEffect, useRef, useState} from 'react';
import {Modal as NativeModal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Keyboard} from 'react-native';
import {AiConsentSettings} from '@/components/settings/AiConsentSettings';
import {listenForAiConsent, type AiConsentRequest} from '@/lib/aiConsentDialog';
import {supabase} from '@/integrations/supabase/client';
import {useAppTheme} from '@/contexts/ThemeContext';
import {fonts} from '@/lib/theme';

/** Existing native sheets render this inline, rather than presenting a second native modal. */
export function AiConsentHost({inline = false}: {inline?: boolean}) {
  const {theme} = useAppTheme();
  const [request, setRequest] = useState<AiConsentRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const current = useRef<AiConsentRequest | null>(null);
  const accepted = useRef(false);
  const abandoned = useRef(false);
  const close = (allow = false) => {
    if (abandoned.current && allow) return;
    if (!allow) abandoned.current = true;
    accepted.current = allow;
    setVisible(false);
  };
  useEffect(() => {
    const stop = listenForAiConsent(next => {
      Keyboard.dismiss();
      current.current = next;
      accepted.current = false;
      abandoned.current = false;
      next.dismiss = () => close(false);
      setRequest(next);
      setVisible(true);
    }, inline ? 1 : 0);
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      if (current.current && session?.user.id !== current.current.ownerId) close(false);
    });
    return () => { stop(); data.subscription.unsubscribe(); };
  }, [inline]);
  useEffect(() => {
    if (visible || !request) return;
    // Let the native presentation disappear before a completed parser can open
    // another sheet. A host disappearing during this wait cancels the request.
    const timer = setTimeout(() => {
      request.finish(accepted.current && !abandoned.current);
      current.current = null;
      setRequest(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [visible, request]);
  if (!request || !visible) return null;
  const content = <View style={styles.overlay} accessibilityViewIsModal>
    <View style={[styles.card, {backgroundColor:theme.card, borderColor:theme.border}]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="סגירה ללא אישור" onPress={() => close(false)} style={styles.close}>
          <Text style={{fontFamily:fonts.body,color:theme.textMuted}}>סגירה</Text>
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.title,{color:theme.text}]}>לפני השימוש ב-AI</Text>
      </View>
      <ScrollView bounces={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AiConsentSettings prompt expectedOwnerId={request.ownerId} onSaved={allow => { if (current.current === request) close(allow); }}/>
      </ScrollView>
    </View>
  </View>;
  return inline ? content : <NativeModal visible transparent animationType="none" onRequestClose={() => close(false)}>{content}</NativeModal>;
}
const styles = StyleSheet.create({
  overlay:{position:'absolute',top:0,bottom:0,left:0,right:0,zIndex:1000,backgroundColor:'rgba(15,23,42,0.45)',justifyContent:'center',alignItems:'center',paddingHorizontal:16,paddingVertical:32},
  card:{width:'100%',maxWidth:460,maxHeight:'100%',borderRadius:24,borderWidth:1,overflow:'hidden'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14},
  title:{fontFamily:fonts.bodyBold,fontSize:20,textAlign:'right',flex:1},
  close:{paddingVertical:8,paddingRight:16},
  body:{paddingHorizontal:4,paddingBottom:12},
});
