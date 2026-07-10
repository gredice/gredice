'use client';

import type { RaisedBedWeedStateLevel } from '@gredice/storage';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { Check, Leaf, Warning } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { setRaisedBedFieldWeedState } from '../../../(actions)/raisedBedFieldsActions';
import { RaisedBedWeedStateItems } from './RaisedBedWeedStateItems';

const weedStatePresentation: Record<
    RaisedBedWeedStateLevel,
    {
        color: ColorPaletteProp;
        icon: typeof Check;
    }
> = {
    none: { color: 'success', icon: Check },
    light: { color: 'warning', icon: Leaf },
    heavy: { color: 'error', icon: Warning },
};

export function RaisedBedFieldWeedStateSelector({
    className,
    level,
    positionIndex,
    raisedBedId,
}: {
    className?: string;
    level: RaisedBedWeedStateLevel;
    positionIndex: number;
    raisedBedId: number;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [optimisticLevel, setOptimisticLevel] = useState(level);
    const currentItem = RaisedBedWeedStateItems.find(
        (item) => item.value === optimisticLevel,
    );
    const currentPresentation = weedStatePresentation[optimisticLevel];
    const CurrentIcon = currentPresentation.icon;

    useEffect(() => {
        setOptimisticLevel(level);
    }, [level]);

    const handleSelect = (nextLevel: RaisedBedWeedStateLevel) => {
        if (nextLevel === optimisticLevel) {
            return;
        }

        setOptimisticLevel(nextLevel);
        startTransition(async () => {
            try {
                await setRaisedBedFieldWeedState({
                    level: nextLevel,
                    positionIndex,
                    raisedBedId,
                });
                router.refresh();
            } catch (error) {
                console.error('Error updating field weed state:', error);
                setOptimisticLevel(level);
                alert('Promjena stanja korova nije uspjela.');
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isPending}>
                <Chip
                    size="sm"
                    variant="solid"
                    color={currentPresentation.color}
                    startDecorator={<CurrentIcon aria-hidden />}
                    title={`Promijeni stanje korova za polje ${positionIndex + 1}`}
                    className={className}
                    onClick={() => {}}
                >
                    <span className="min-w-0 truncate">
                        {currentItem?.label ?? optimisticLevel}
                    </span>
                </Chip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {RaisedBedWeedStateItems.map((item) => {
                    const presentation = weedStatePresentation[item.value];
                    const ItemIcon = presentation.icon;

                    return (
                        <DropdownMenuItem
                            key={item.value}
                            startDecorator={
                                <span
                                    aria-hidden
                                    className="w-4 shrink-0 text-center"
                                >
                                    {optimisticLevel === item.value ? (
                                        <Check className="size-4" />
                                    ) : null}
                                </span>
                            }
                            onSelect={() => handleSelect(item.value)}
                        >
                            <ItemIcon
                                aria-hidden
                                className="mr-1 size-4 shrink-0"
                            />
                            {item.label}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
