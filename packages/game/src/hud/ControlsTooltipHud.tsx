'use client';

import { Close, Info } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'game-controls-tooltip-v1';
const REMINDER_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

type DeviceType = 'desktop' | 'tablet' | 'mobile';

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

export function ControlsTooltipHud() {
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const nextType = getDeviceType();
        setDeviceType(nextType);
        const map = readStorage();
        const record = map[nextType];
        if (!record || Date.now() - record.dismissedAt > REMINDER_AFTER_MS) {
            setOpen(true);
        }
    }, []);

    const isReminder = useMemo(() => {
        const map = typeof window === 'undefined' ? {} : readStorage();
        return Boolean(map[deviceType]);
    }, [deviceType]);

    const dismiss = () => {
        setOpen(false);
        const map = readStorage();
        map[deviceType] = { dismissedAt: Date.now(), seenVersion: 1 };
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

    const controls =
        deviceType === 'desktop'
            ? ['Pomak kamere: strelice', 'Rotacija: Q / W', 'Zum: kotačić miša']
            : deviceType === 'tablet'
              ? [
                    'Pomak: povuci jednim prstom',
                    'Zum: stisni s dva prsta',
                    'Rotacija vrta: tipke dolje lijevo',
                ]
              : [
                    'Pomak: povuci prstom',
                    'Zum: stisni s dva prsta',
                    'Rotacija vrta: tipke dolje lijevo',
                ];

    return (
        <div className="pointer-events-auto max-w-xs rounded-lg border bg-card/95 p-3 shadow-md backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
                <Typography level="body2" className="font-semibold">
                    {isReminder ? 'Podsjetnik: kontrole' : 'Kontrole igre'}
                </Typography>
                <IconButton
                    title="Zatvori"
                    variant="plain"
                    onClick={dismiss}
                    className="-mr-2 -mt-2"
                >
                    <Close className="size-4" />
                </IconButton>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {controls.map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
            <Button
                variant="solid"
                size="sm"
                className="mt-3 w-full"
                onClick={dismiss}
            >
                Razumijem
            </Button>
        </div>
    );
}
