'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Check, Info } from '@signalco/ui-icons';
import { useEffect, useState } from 'react';
import { useIsEditMode } from '../hooks/useIsEditMode';
import { ButtonGreen } from '../shared-ui/ButtonGreen';
import type { DeviceType } from './controls-tooltip';
import { ControlsVisualization } from './controls-tooltip';

const STORAGE_KEY = 'game-controls-tooltip-v1';
const TOOLTIP_VERSION = 2;
const REMINDER_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

type TooltipState = { dismissedAt: number; seenVersion: number };

function getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

function readStorage(): Partial<Record<DeviceType, TooltipState>> {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === 'object' && parsed
            ? (parsed as Partial<Record<DeviceType, TooltipState>>)
            : {};
    } catch {
        return {};
    }
}

function writeStorage(next: Partial<Record<DeviceType, TooltipState>>) {
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

export function ControlsTooltipHud() {
    const isEditMode = useIsEditMode();
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState(0.75);

    useEffect(() => {
        const syncDeviceType = () => {
            const nextType = getDeviceType();
            setDeviceType(nextType);
            const record = readStorage()[nextType];
            if (shouldShowTooltip(record)) {
                setOpen(true);
            }
        };

        syncDeviceType();
        window.addEventListener('resize', syncDeviceType);
        return () => window.removeEventListener('resize', syncDeviceType);
    }, []);

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
        map[deviceType] = {
            dismissedAt: Date.now(),
            seenVersion: TOOLTIP_VERSION,
        };
        writeStorage(map);
    };

    if (!open) {
        return (
            <div className="pointer-events-auto">
                <IconButton
                    title="Prikaži kontrole"
                    variant="plain"
                    onClick={() => setOpen(true)}
                    className="hover:bg-muted"
                >
                    <Info className="size-5" />
                </IconButton>
            </div>
        );
    }

    return (
        <div className="pointer-events-auto relative p-2 sm:p-3">
            <ControlsVisualization
                deviceType={deviceType}
                phase={phase}
                isEditMode={isEditMode}
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
    );
}
