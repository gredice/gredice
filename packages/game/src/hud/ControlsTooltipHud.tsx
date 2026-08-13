'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Check, GamepadDirectional } from '@gredice/ui/icons';
import { useEffect, useState } from 'react';
import { ButtonGreen } from '../shared-ui/ButtonGreen';
import type { DeviceType } from './controls-tooltip';
import { ControlsVisualization } from './controls-tooltip';

const STORAGE_KEY = 'game-controls-tooltip-v1';
const TOOLTIP_VERSION = 3;
const REMINDER_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

type TooltipState = { dismissedAt: number; seenVersion: number };
type TooltipStorageKey = DeviceType | `view:${DeviceType}`;

function tooltipStorageKey(
    mode: 'edit' | 'view',
    deviceType: DeviceType,
): TooltipStorageKey {
    return mode === 'edit' ? deviceType : `view:${deviceType}`;
}

function getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

function readStorage(): Partial<Record<TooltipStorageKey, TooltipState>> {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === 'object' && parsed
            ? (parsed as Partial<Record<TooltipStorageKey, TooltipState>>)
            : {};
    } catch {
        return {};
    }
}

function writeStorage(next: Partial<Record<TooltipStorageKey, TooltipState>>) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function shouldShowTooltip(record: TooltipState | undefined) {
    return (
        !record ||
        record.seenVersion !== TOOLTIP_VERSION ||
        Date.now() - record.dismissedAt > REMINDER_AFTER_MS
    );
}

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

export function ControlsTooltipHud({
    mode = 'edit',
    offsetForItemsHud = true,
}: {
    mode?: 'edit' | 'view';
    offsetForItemsHud?: boolean;
} = {}) {
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState(0.75);

    useEffect(() => {
        const syncDeviceType = () => {
            const nextType = getDeviceType();
            setDeviceType(nextType);
            const record = readStorage()[tooltipStorageKey(mode, nextType)];
            if (shouldShowTooltip(record)) {
                setOpen(true);
            }
        };

        syncDeviceType();
        window.addEventListener('resize', syncDeviceType);
        return () => window.removeEventListener('resize', syncDeviceType);
    }, [mode]);

    useEffect(() => {
        if (!open || prefersReducedMotion()) return;

        const interval = window.setInterval(() => {
            setPhase((current) => current + 0.12);
        }, 50);

        return () => window.clearInterval(interval);
    }, [open]);

    const dismiss = () => {
        setOpen(false);
        const map = readStorage();
        map[tooltipStorageKey(mode, deviceType)] = {
            dismissedAt: Date.now(),
            seenVersion: TOOLTIP_VERSION,
        };
        writeStorage(map);
    };

    return (
        <>
            {open ? (
                <div
                    id="game-controls-tooltip"
                    data-controls-tooltip-hud="open"
                    className={`pointer-events-auto relative p-2 sm:p-3 ${offsetForItemsHud ? 'md:mb-24' : ''}`}
                >
                    <ControlsVisualization
                        deviceType={deviceType}
                        mode={mode}
                        phase={phase}
                    />
                    <ButtonGreen
                        title="Zatvori"
                        variant="soft"
                        size="sm"
                        onClick={dismiss}
                        className="absolute top-4 right-4 z-10 shrink-0 size-7 min-h-0 p-0 rounded-full"
                    >
                        <Check className="size-4 shrink-0" />
                    </ButtonGreen>
                </div>
            ) : null}
            <div className="pointer-events-auto">
                <IconButton
                    title={open ? 'Sakrij kontrole' : 'Prikaži kontrole'}
                    aria-controls="game-controls-tooltip"
                    aria-expanded={open}
                    variant="plain"
                    onClick={open ? dismiss : () => setOpen(true)}
                    className="hover:bg-muted"
                >
                    <GamepadDirectional className="size-5" />
                </IconButton>
            </div>
        </>
    );
}
