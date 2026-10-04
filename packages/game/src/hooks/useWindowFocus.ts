'use client';

import { useEffect, useState } from 'react';

export function useWindowFocus() {
    const [isFocused, setIsFocused] = useState(
        typeof document === 'undefined'
            ? false
            : !document.hidden || document.hasFocus(),
    );

    function handleFocusChange() {
        if (typeof document === 'undefined') {
            return;
        }
        setIsFocused(!document.hidden || document.hasFocus());
    }

    function handleVisibilityChange() {
        if (typeof document === 'undefined') {
            return;
        }

        setIsFocused(!document.hidden || document.hasFocus());
    }

    useEffect(() => {
        window.addEventListener('focus', handleFocusChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocusChange);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };
    });

    return isFocused;
}
