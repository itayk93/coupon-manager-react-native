export class AiConsentCancelled extends Error {
  constructor() { super('אפשר להמשיך בהזנה ידנית ללא AI'); this.name = 'AiConsentCancelled'; }
}
export type AiConsentRequest = { ownerId: string; finish: (accepted: boolean) => void; dismiss?: () => void };
type Host = {listener: (request: AiConsentRequest) => void; priority: number};
const hosts: Host[] = [];
let pending: {request: AiConsentRequest; host: Host} | null = null;
/** A user action may open one dialog. No coupon payload is stored here. */
export function askAiConsent(ownerId: string): Promise<boolean> {
  const host = hosts.reduce<Host | null>((best, next) => !best || next.priority >= best.priority ? next : best, null);
  if (!host || pending) return Promise.resolve(false);
  return new Promise(resolve => {
    const request: AiConsentRequest = { ownerId, finish(accepted) {
      if (pending?.request !== request) return;
      pending = null;
      resolve(accepted === true);
    }};
    pending = {request, host};
    host.listener(request);
  });
}
export function listenForAiConsent(listener: Host['listener'], priority = 0) {
  const host = {listener, priority};
  hosts.push(host);
  return () => {
    const index = hosts.indexOf(host);
    if (index >= 0) hosts.splice(index,1);
    if (pending?.host === host) pending.request.finish(false);
  };
}
export function dismissAiConsent(): boolean {
  if (!pending) return false;
  if (pending.request.dismiss) pending.request.dismiss();
  else pending.request.finish(false);
  return true;
}
const refreshListeners = new Set<() => void>();
export function onAiConsentSaved(listener: () => void) {
  refreshListeners.add(listener);
  return () => { refreshListeners.delete(listener); };
}
export function aiConsentSaved() { for (const listener of refreshListeners) listener(); }
