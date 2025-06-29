'use client'; // Note: Must be a client component so that locale is applied correctly

import dynamic from 'next/dynamic';

export const LocaleDateTime = dynamic(
    () => import('./LocaleDateTime').then(mod => mod._localeDatetime),
    { ssr: false });

export function _localeDatetime({ children, date, time }: { children: Date | null | undefined, date?: boolean, time?: boolean }) {
    if (date === false && time === false) {
        throw new Error('At least one of date or time must be true, or leave them undefined to show both');
    }

    console.log(typeof children, children)

    if (children) {
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false,
        };
        if (time === false) {
            options.hour = undefined;
            options.minute = undefined;
            options.second = undefined;
        }
        if (date === false) {
            options.year = undefined;
            options.month = undefined;
            options.day = undefined;
        }
        return <span title={children?.toISOString()}>{new Intl.DateTimeFormat('hr-HR', options).format(new Date(children))}</span>;
    }
}