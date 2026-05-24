'use client';

import { useCallback, useEffect, useState } from 'react';

const searchParamsUpdatedEventName = 'gredice:search-params-updated';

let nativeReplaceState: History['replaceState'] | null = null;

function getWindowSearchParam(name: string, defaultValue: string) {
    if (typeof window === 'undefined') {
        return defaultValue;
    }

    return (
        new URLSearchParams(window.location.search).get(name) ?? defaultValue
    );
}

function getNativeReplaceState() {
    if (nativeReplaceState) {
        return nativeReplaceState;
    }

    // Next patches window.history and remounts App Router segments on search
    // changes. A same-origin iframe gives us the native method for in-page filters.
    const iframe = document.createElement('iframe');
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.display = 'none';
    document.documentElement.append(iframe);

    nativeReplaceState =
        iframe.contentWindow?.history.replaceState ??
        History.prototype.replaceState;
    iframe.remove();

    return nativeReplaceState;
}

function replaceWindowSearchParam(name: string, value: string) {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    if (value) {
        url.searchParams.set(name, value);
    } else {
        url.searchParams.delete(name);
    }

    getNativeReplaceState().call(
        window.history,
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
    );
    window.dispatchEvent(new Event(searchParamsUpdatedEventName));
}

export function useClientSearchParam(
    name: string,
    defaultValue = '',
): [string, (value: string) => void] {
    const [value, setValue] = useState(() =>
        getWindowSearchParam(name, defaultValue),
    );

    useEffect(() => {
        const updateValueFromLocation = () => {
            setValue(getWindowSearchParam(name, ''));
        };

        updateValueFromLocation();
        window.addEventListener('popstate', updateValueFromLocation);
        window.addEventListener(
            searchParamsUpdatedEventName,
            updateValueFromLocation,
        );

        return () => {
            window.removeEventListener('popstate', updateValueFromLocation);
            window.removeEventListener(
                searchParamsUpdatedEventName,
                updateValueFromLocation,
            );
        };
    }, [name]);

    const updateValue = useCallback(
        (nextValue: string) => {
            setValue(nextValue);
            replaceWindowSearchParam(name, nextValue);
        },
        [name],
    );

    return [value, updateValue];
}
