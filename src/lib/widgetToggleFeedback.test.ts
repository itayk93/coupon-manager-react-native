import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({mutate:vi.fn(),success:vi.fn(),error:vi.fn(), states:[] as unknown[], full:false, inWidget:false}));
vi.mock('react', () => ({useRef:(v:unknown)=>({current:v}),useState:(v:unknown)=>[v,(next:unknown)=>m.states.push(next)]}));
vi.mock('@/hooks/useCoupons', () => ({useCoupons:()=>({data:[]}),useUpdateCoupon:()=>({mutate:m.mutate})}));
vi.mock('@/lib/notify',()=>({notify:{success:m.success,error:m.error}}));
vi.mock('@/lib/widgetSelection',()=>({MAX_WIDGET_COUPONS:6,isInWidget:()=>m.inWidget,isWidgetEligible:()=>true,isWidgetFull:()=>m.full,nextWidgetOrder:()=>2}));
import {useWidgetToggle} from '@/hooks/useWidgetToggle';
describe('widget confirmed feedback',()=>{
 beforeEach(()=>{vi.clearAllMocks();m.states=[];m.full=false;m.inWidget=false});
 it('does not celebrate an optimistic update and ignores repeated taps',()=>{const h=useWidgetToggle({id:7} as any);h.toggle();h.toggle();expect(m.mutate).toHaveBeenCalledTimes(1);expect(m.success).not.toHaveBeenCalled();const opts=m.mutate.mock.calls[0][1];opts.onSuccess();expect(m.success).toHaveBeenCalledTimes(1);expect(m.states.some(v=>typeof v==='function')).toBe(true)});
 it('failure settlement unlocks retry without success feedback',()=>{const h=useWidgetToggle({id:7} as any);h.toggle();m.mutate.mock.calls[0][1].onSettled();expect(m.success).not.toHaveBeenCalled();h.toggle();expect(m.mutate).toHaveBeenCalledTimes(2)});
 it('full widget rejects addition, but permits removal',()=>{m.full=true;useWidgetToggle({id:7} as any).toggle();expect(m.mutate).not.toHaveBeenCalled();expect(m.error).toHaveBeenCalledOnce();m.inWidget=true;useWidgetToggle({id:7} as any).toggle();expect(m.mutate).toHaveBeenCalledOnce();expect(m.mutate.mock.calls[0][0].updates.show_in_widget).toBe(false)});
});
