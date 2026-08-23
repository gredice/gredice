'use client';

import { type PointerEvent, useEffect, useState } from 'react';
import { useGameState } from '../useGameState';

const joystickRadius = 42;

export function GardenAvatarJoystick() {
    const setMoveInput = useGameState(
        (state) => state.setGardenAvatarMoveInput,
    );
    const [knob, setKnob] = useState({ x: 0, y: 0 });

    useEffect(
        () => () => {
            setMoveInput({ forward: 0, right: 0 });
        },
        [setMoveInput],
    );

    const updatePosition = (event: PointerEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - (bounds.left + bounds.width / 2);
        const y = event.clientY - (bounds.top + bounds.height / 2);
        const distance = Math.hypot(x, y);
        const scale = distance > joystickRadius ? joystickRadius / distance : 1;
        const constrainedX = x * scale;
        const constrainedY = y * scale;
        setKnob({ x: constrainedX, y: constrainedY });
        setMoveInput({
            forward: -constrainedY / joystickRadius,
            right: constrainedX / joystickRadius,
        });
    };

    const stopMoving = (event: PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setKnob({ x: 0, y: 0 });
        setMoveInput({ forward: 0, right: 0 });
    };

    return (
        <div
            aria-label="Upravljač za hodanje"
            className="pointer-events-auto relative size-28 touch-none rounded-full border border-border/60 bg-background/55 shadow-lg backdrop-blur-md"
            onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                updatePosition(event);
            }}
            onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    updatePosition(event);
                }
            }}
            onPointerUp={stopMoving}
            onPointerCancel={stopMoving}
            role="application"
        >
            <div className="absolute inset-4 rounded-full border border-border/40" />
            <div
                className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/70 bg-background/90 shadow-md"
                style={{
                    marginLeft: knob.x,
                    marginTop: knob.y,
                }}
            />
        </div>
    );
}
