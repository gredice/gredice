import { Html } from '@react-three/drei';
import {
    type MouseEventHandler,
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { type Camera, type Group, type Object3D, Vector3 } from 'three';
import {
    actorSpeechDurationMs,
    pickActorSpeechMessage,
} from './actorSpeechMessages';

export type ActorSpeechAnchor = Group;

export function useActorHoverSpeech(
    messages: readonly string[],
    durationMs = actorSpeechDurationMs,
) {
    const [message, setMessage] = useState<string | null>(null);
    const messageRef = useRef<string | null>(null);
    const previousMessageRef = useRef<string | null>(null);
    const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    const clearDismissTimeout = useCallback(() => {
        if (dismissTimeoutRef.current === null) {
            return;
        }

        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
    }, []);

    const dismissMessage = useCallback(() => {
        clearDismissTimeout();
        messageRef.current = null;
        setMessage(null);
    }, [clearDismissTimeout]);

    const showMessage = useCallback(() => {
        if (messageRef.current === null) {
            const nextMessage = pickActorSpeechMessage({
                messages,
                previousMessage: previousMessageRef.current,
            });
            previousMessageRef.current = nextMessage;
            messageRef.current = nextMessage;
            setMessage(nextMessage);
        }

        clearDismissTimeout();
        dismissTimeoutRef.current = setTimeout(() => {
            dismissTimeoutRef.current = null;
            messageRef.current = null;
            setMessage(null);
        }, durationMs);
    }, [clearDismissTimeout, durationMs, messages]);

    useEffect(() => clearDismissTimeout, [clearDismissTimeout]);

    return { dismissMessage, message, showMessage };
}

export function ActorSpeechBubble({
    actionLabel,
    actorRef,
    message,
    offsetY,
    onClick,
}: {
    actionLabel?: string;
    actorRef: RefObject<Object3D | null>;
    message: string;
    offsetY: number;
    onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
    const actorWorldPositionRef = useRef(new Vector3());
    const calculateActorPosition = useCallback(
        (
            _element: Object3D,
            camera: Camera,
            size: { width: number; height: number },
        ) => {
            const actor = actorRef.current;
            if (!actor) {
                return [size.width / 2, size.height / 2];
            }

            actor.getWorldPosition(actorWorldPositionRef.current);
            actorWorldPositionRef.current.y += offsetY;
            actorWorldPositionRef.current.project(camera);
            const screenPosition = [
                actorWorldPositionRef.current.x * (size.width / 2) +
                    size.width / 2,
                -actorWorldPositionRef.current.y * (size.height / 2) +
                    size.height / 2,
            ];
            return screenPosition;
        },
        [actorRef, offsetY],
    );

    return (
        <Html
            calculatePosition={calculateActorPosition}
            style={{ pointerEvents: onClick ? 'auto' : 'none' }}
            zIndexRange={[50, 31]}
        >
            {onClick ? (
                <button
                    type="button"
                    aria-label={actionLabel}
                    aria-live="polite"
                    className="relative max-w-[min(15rem,75vw)] -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] whitespace-normal rounded-xl border border-emerald-200 bg-white/95 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-emerald-900 shadow-lg backdrop-blur-sm transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:border-emerald-800/80 dark:bg-neutral-950/95 dark:text-emerald-100"
                    data-actor-speech-bubble
                    onClick={onClick}
                >
                    {message}
                    <span className="absolute top-full left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-emerald-200 bg-white/95 dark:border-emerald-800/80 dark:bg-neutral-950/95" />
                </button>
            ) : (
                <div
                    aria-live="polite"
                    className="relative max-w-[min(15rem,75vw)] -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] whitespace-nowrap rounded-xl border border-emerald-200 bg-white/95 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-emerald-900 shadow-lg backdrop-blur-sm dark:border-emerald-800/80 dark:bg-neutral-950/95 dark:text-emerald-100"
                    data-actor-speech-bubble
                    role="status"
                >
                    {message}
                    <span className="absolute top-full left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-emerald-200 bg-white/95 dark:border-emerald-800/80 dark:bg-neutral-950/95" />
                </div>
            )}
        </Html>
    );
}
