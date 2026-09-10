'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Check, GamepadDirectional } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { useEffect, useState } from 'react';
import { observeDocumentVisibility } from '../hooks/documentVisibilityObserver';
import { VisibilityAwareInterval } from '../hooks/visibilityAwareInterval';
import { useGameSceneRuntimeActive } from '../scene/sceneRuntimeActivity';
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
    isCloseup = false,
    mode = 'edit',
    offsetForItemsHud = true,
}: {
    isCloseup?: boolean;
    mode?: 'edit' | 'view';
    offsetForItemsHud?: boolean;
} = {}) {
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState(0.75);
    const runtimeActive = useGameSceneRuntimeActive();

    useEffect(() => {
        const syncDeviceType = () => {
            const nextType = getDeviceType();
            setDeviceType(nextType);
            if (isCloseup) {
                setOpen(false);
                return;
            }
            const record = readStorage()[tooltipStorageKey(mode, nextType)];
            if (shouldShowTooltip(record)) {
                setOpen(true);
            }
        };

        syncDeviceType();
        window.addEventListener('resize', syncDeviceType);
        return () => window.removeEventListener('resize', syncDeviceType);
    }, [isCloseup, mode]);

    useEffect(() => {
        if (!open || prefersReducedMotion()) return;

        const interval = new VisibilityAwareInterval({
            clearInterval: (handle) => window.clearInterval(Number(handle)),
            documentVisible: !document.hidden,
            intervalMs: 50,
            runtimeActive,
            setInterval: (callback, intervalMs) =>
                window.setInterval(callback, intervalMs),
            tick: () => setPhase((current) => current + 0.12),
        });
        const stopVisibilityTracking = observeDocumentVisibility({
            documentTarget: document,
            onVisibilityChange: (visible) =>
                interval.setDocumentVisible(visible),
            windowTarget: window,
        });

        return () => {
            stopVisibilityTracking();
            interval.dispose();
        };
    }, [open, runtimeActive]);

    const dismiss = () => {
        setOpen(false);
        const map = readStorage();
        map[tooltipStorageKey(mode, deviceType)] = {
            dismissedAt: Date.now(),
            seenVersion: TOOLTIP_VERSION,
        };
        writeStorage(map);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setOpen(true);
            return;
        }

        dismiss();
    };

    return (
        <Popper
            align="start"
            className="relative w-auto border-0 bg-transparent p-2 shadow-none sm:p-3"
            data-controls-tooltip-hud="open"
            id="game-controls-tooltip"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onOpenChange={handleOpenChange}
            open={open}
            side="top"
            sideOffset={offsetForItemsHud && deviceType !== 'mobile' ? 104 : 8}
            trigger={
                <IconButton
                    title={open ? 'Sakrij kontrole' : 'Prikaži kontrole'}
                    aria-controls="game-controls-tooltip"
                    aria-expanded={open}
                    variant="plain"
                    className="pointer-events-auto hover:bg-muted"
                >
                    <GamepadDirectional className="size-5" />
                </IconButton>
            }
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
        </Popper>
    );
}
