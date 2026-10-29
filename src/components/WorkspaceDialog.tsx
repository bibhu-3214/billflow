import React, { useRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ui } from '../styles/ui';
export type DialogSize = 'standard' | 'compact' | 'operations' | 'document' | 'editor' | 'invoice';
export interface WorkspaceDialogProps extends HTMLAttributes<HTMLDivElement> { open: boolean; size?: DialogSize; children?: ReactNode; onClose?: (event: Event, reason: 'escapeKeyDown' | 'backdropClick') => void }
const widths: Record<DialogSize, string> = {standard: 'max-w-[600px]', compact: 'max-w-[440px]', operations: 'max-w-[640px]', document: 'max-w-[760px]', editor: 'max-w-[920px]', invoice: 'max-w-[960px]'};
export default function WorkspaceDialog({size = 'standard', open, onClose, className, children, ...props}: WorkspaceDialogProps) {
    const opener = useRef<HTMLElement | null>(null);
    return <Dialog.Root open={open}><Dialog.Portal><Dialog.Overlay className='fixed inset-0 z-[1400] bg-slate-950/55 backdrop-blur-[3px]' /><div className='ui-dialog-layer pointer-events-none fixed inset-0 z-[1401] grid place-items-center overflow-y-auto p-3 sm:p-6'>
        <Dialog.Content {...props} aria-modal={true} aria-describedby={props['aria-describedby']} className={ui('ui-dialog-panel workspace-dialog pointer-events-auto relative max-h-[calc(100dvh-24px)] w-full min-w-0 overflow-y-auto overscroll-contain rounded-[14px] border border-line bg-surface text-ink shadow-2xl outline-none sm:max-h-[calc(100dvh-48px)]', `workspace-dialog-${size}`, widths[size], className)}
            onOpenAutoFocus={() => {opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;}}
            onCloseAutoFocus={event => {event.preventDefault(); const element = opener.current; requestAnimationFrame(() => {if (element?.isConnected) element.focus();});}}
            onEscapeKeyDown={event => {event.preventDefault(); onClose?.(event, 'escapeKeyDown');}}
            onPointerDownOutside={event => {event.preventDefault(); onClose?.(event.detail.originalEvent, 'backdropClick');}}>
            <Dialog.Title className='sr-only'>{props['aria-label'] || 'Workspace details'}</Dialog.Title>{children}
        </Dialog.Content></div></Dialog.Portal></Dialog.Root>;
}
