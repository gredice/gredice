'use client';

import { useEffect, useState } from 'react';

export interface LocalDateTimeProps {
    children: Date | string | null | undefined;
    date?: boolean;
    time?: boolean;
    format?: Intl.DateTimeFormatOptions;
    locale?: string;
    className?: string;
    title?: string;
}

/**
 * A client-side date/time formatter component that ensures dates are formatted
 * in the user's local timezone, preventing hydration mismatches.
 * 
 * This component avoids the server/client timezone mismatch by only rendering
 * the formatted date/time on the client side.
 */
export function LocalDateTime({
    children,
    date = true,
    time = true,
    format,
    locale = 'hr-HR',
    className,
    title
}: LocalDateTimeProps) {
    const [mounted, setMounted] = useState(false);

    // Ensure we only render on the client to avoid hydration mismatches
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // Return a placeholder with the same approximate size to avoid layout shifts
        return <span className={className}>...</span>;
    }

    if (date === false && time === false) {
        throw new Error('At least one of date or time must be true, or leave them undefined to show both');
    }

    if (!children) {
        return null;
    }

    const dateValue = typeof children === 'string' ? new Date(children) : children;

    if (isNaN(dateValue.getTime())) {
        console.warn('LocalDateTime: Invalid date provided:', children);
        return <span className={className}>Invalid Date</span>;
    }

    const options: Intl.DateTimeFormatOptions = format || {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    };

    // Remove time parts if time is disabled
    if (time === false) {
        delete options.hour;
        delete options.minute;
        delete options.second;
        delete options.timeZoneName;
    }

    // Remove date parts if date is disabled  
    if (date === false) {
        delete options.year;
        delete options.month;
        delete options.day;
        delete options.weekday;
    }

    const formattedValue = new Intl.DateTimeFormat(locale, options).format(dateValue);
    const titleValue = title || dateValue.toISOString();

    return (
        <span className={className} title={titleValue}>
            {formattedValue}
        </span>
    );
}

/**
 * Formats a time range (start - end) in the user's local timezone
 */
export interface TimeRangeProps {
    startAt: Date | string;
    endAt: Date | string;
    locale?: string;
    className?: string;
    timeOnly?: boolean;
    separator?: string;
}

export function TimeRange({
    startAt,
    endAt,
    locale = 'hr-HR',
    className,
    timeOnly = false,
    separator = ' - '
}: TimeRangeProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <span className={className}>...</span>;
    }

    const startDate = typeof startAt === 'string' ? new Date(startAt) : startAt;
    const endDate = typeof endAt === 'string' ? new Date(endAt) : endAt;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn('TimeRange: Invalid dates provided:', { startAt, endAt });
        return <span className={className}>Invalid Date Range</span>;
    }

    const timeFormat: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };

    const dateFormat: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    };

    if (timeOnly) {
        const startTime = new Intl.DateTimeFormat(locale, timeFormat).format(startDate);
        const endTime = new Intl.DateTimeFormat(locale, timeFormat).format(endDate);
        return (
            <span className={className} title={`${startDate.toISOString()} - ${endDate.toISOString()}`}>
                {startTime}{separator}{endTime}
            </span>
        );
    }

    // Check if dates are on the same day
    const sameDay = startDate.toDateString() === endDate.toDateString();

    if (sameDay) {
        const dateStr = new Intl.DateTimeFormat(locale, dateFormat).format(startDate);
        const startTime = new Intl.DateTimeFormat(locale, timeFormat).format(startDate);
        const endTime = new Intl.DateTimeFormat(locale, timeFormat).format(endDate);
        
        return (
            <span className={className} title={`${startDate.toISOString()} - ${endDate.toISOString()}`}>
                {dateStr} {startTime}{separator}{endTime}
            </span>
        );
    }

    // Different days
    const startStr = new Intl.DateTimeFormat(locale, { ...dateFormat, ...timeFormat }).format(startDate);
    const endStr = new Intl.DateTimeFormat(locale, { ...dateFormat, ...timeFormat }).format(endDate);

    return (
        <span className={className} title={`${startDate.toISOString()} - ${endDate.toISOString()}`}>
            {startStr}{separator}{endStr}
        </span>
    );
}
