export type AlertTone = 'success' | 'error';
export interface AlertResult { isConfirmed: boolean }
export interface WorkspaceAlert { title: string; message: string; tone: AlertTone; resolve(confirmed: boolean): void }
const queue: WorkspaceAlert[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export const currentAlert = () => queue[0] || null;
export const subscribeAlerts = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function dismissAlert(confirmed: boolean) { const alert = queue.shift(); alert?.resolve(confirmed); notify(); }
function fire(title: string, message: string, tone: AlertTone): Promise<AlertResult> {
    return new Promise(resolve => { queue.push({title, message, tone, resolve: isConfirmed => resolve({isConfirmed})}); notify(); });
}
export default { fire };
