import{describe,it,expect,vi}from'vitest';
import{hasAiConsent,aiConsentRecord}from'../src/lib/aiConsentRecord';
import{hasAiConsent as serverConsent,backgroundAiAllowed}from'../supabase/functions/_shared/aiConsent';
import{phrase}from'../supabase/functions/_shared/notificationVoice';
import{copyFor}from'../supabase/functions/_shared/notificationTypes';
import fs from'node:fs';
const user=(record:any)=>({user_metadata:{coupon_ai_consent:record}});
describe('informed OpenAI sharing permission',()=>{
 it('both sides reject absent, declined, malformed and old consent',()=>{for(const record of[undefined,{},aiConsentRecord(false),{...aiConsentRecord(true),version:'old'},{...aiConsentRecord(true),provider:'other'},{...aiConsentRecord(true),granted:1},{...aiConsentRecord(true),updatedAt:'invalid'}]){expect(hasAiConsent(user(record))).toBe(false);expect(serverConsent(user(record))).toBe(false)}});
 it('both sides accept the current account record',()=>{expect(hasAiConsent(user(aiConsentRecord(true)))).toBe(true);expect(serverConsent(user(aiConsentRecord(true)))).toBe(true)});
 it('background paths deny when identity or canonical consent cannot be read',async()=>{expect(await backgroundAiAllowed(null,1)).toBe(false);expect(await backgroundAiAllowed({from:()=>{throw Error()}},1)).toBe(false);const getUserById=vi.fn().mockResolvedValue({data:{user:user(aiConsentRecord(false))},error:null});const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{auth_user_id:'account-a',is_deleted:false},error:null})})})}),auth:{admin:{getUserById}}};expect(await backgroundAiAllowed(db,1)).toBe(false);getUserById.mockResolvedValueOnce({data:{user:user(aiConsentRecord(true))},error:null});expect(await backgroundAiAllowed(db,1)).toBe(true);expect(getUserById).toHaveBeenCalledWith('account-a')});
 it('keeps ordinary notifications with zero provider network calls without permission',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubGlobal('Deno',{env:{get:()=> 'test-key-not-real'}});const facts={count:1,total:50,days:3,company:'Test'};expect(await phrase('expiry',facts)).toEqual(copyFor('expiry',facts));expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals()});
 it('every foreground server gate precedes parsing and provider calls',()=>{for(const name of['parse-coupon','parse-usage-screenshot','search-coupon-merchants']){const src=fs.readFileSync(`supabase/functions/${name}/index.ts`,'utf8');const gate=src.indexOf('.ai_consent');expect(gate).toBeGreaterThan(0);expect(gate).toBeLessThan(src.indexOf('await req.json()'));expect(src.indexOf('await requireUser(req)',src.indexOf('Deno.serve'))).toBeLessThan(gate)}});
});
