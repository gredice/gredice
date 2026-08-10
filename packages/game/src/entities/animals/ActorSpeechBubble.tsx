import { Html } from '@react-three/drei';
import { useCallback, useRef, useState } from 'react';
import { pickActorSpeechMessage } from './actorSpeechMessages';

export function useActorHoverSpeech(messages: readonly string[]) {
    const [message, setMessage] = useState<string | null>(null);
    const previousMessageRef = useRef<string | null>(null);

    const showMessage = useCallback(() => {
        const nextMessage = pickActorSpeechMessage({
            messages,
            previousMessage: previousMessageRef.current,
        });
        previousMessageRef.current = nextMessage;
        setMessage(nextMessage);
    }, [messages]);

    const hideMessage = useCallback(() => setMessage(null), []);

    return { hideMessage, message, showMessage };
}

export function ActorSpeechBubble({
    message,
    position,
}: {
    message: string;
    position: [number, number, number];
}) {
    return (
        <Html
            center
            position={position}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[50, 31]}
        >
            <div
                aria-live="polite"
                className="relative max-w-[min(15rem,75vw)] whitespace-nowrap rounded-xl border border-emerald-200 bg-white/95 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-emerald-900 shadow-lg backdrop-blur-sm dark:border-emerald-800/80 dark:bg-neutral-950/95 dark:text-emerald-100"
                data-actor-speech-bubble
                role="status"
            >
                {message}
                <span className="absolute top-full left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-emerald-200 bg-white/95 dark:border-emerald-800/80 dark:bg-neutral-950/95" />
            </div>
        </Html>
    );
}
