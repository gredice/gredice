'use client';

import { useDocumentEvent } from "@signalco/hooks/useDocumentEvent";
import { useWindowEvent } from "@signalco/hooks/useWindowEvent";
import { useState } from "react";

export function useWindowFocus() {
    const [isFocused, setIsFocused] = useState(typeof document === 'undefined'
        ? false
        : !document.hidden || document.hasFocus());

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

    useWindowEvent("focus", handleFocusChange);
    useDocumentEvent("visibilitychange", handleVisibilityChange);

    return isFocused;
}