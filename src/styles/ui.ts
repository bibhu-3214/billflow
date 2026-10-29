import { twMerge } from 'tailwind-merge';
import { recipes } from './recipes';
export function ui(...values: (string | false | null | undefined)[]): string {
    const classes = values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
    return twMerge(classes, ...classes.split(/\s+/).map(name => recipes[name] || ''));
}

export const stagger = ['[animation-delay:0ms]', '[animation-delay:70ms]', '[animation-delay:140ms]', '[animation-delay:210ms]', '[animation-delay:280ms]', '[animation-delay:350ms]'] as const;
