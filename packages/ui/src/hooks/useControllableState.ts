import { useCallback, useEffect, useRef, useState } from 'react';

type Callback<T> = (value: T) => void;
type Updater<T> = T | ((current: T | undefined) => T);

function useCallbackRef<T>(callback: Callback<T> | undefined) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    });

    return useCallback((value: T) => {
        callbackRef.current?.(value);
    }, []);
}

export function useControllableState<T>(
    value: T | undefined,
    defaultValue: T | undefined,
    onChange?: Callback<T>,
) {
    const [internalValue, setInternalValue] = useState<T | undefined>(
        defaultValue,
    );
    const controlled = value !== undefined;
    const currentValue = controlled ? value : internalValue;
    const onChangeRef = useCallbackRef(onChange);

    const setValue = useCallback(
        (next: Updater<T>) => {
            const nextValue =
                typeof next === 'function'
                    ? (next as (current: T | undefined) => T)(currentValue)
                    : next;

            if (controlled) {
                if (nextValue !== value) {
                    onChangeRef(nextValue);
                }
                return;
            }

            setInternalValue(nextValue);
        },
        [controlled, currentValue, onChangeRef, value],
    );

    return [currentValue, setValue] as const;
}
