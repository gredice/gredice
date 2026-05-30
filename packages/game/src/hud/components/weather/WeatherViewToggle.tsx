'use client';

import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import { Graph, Sun } from '@gredice/ui/icons';

export type WeatherPopoverView = 'weather' | 'graph';

export function WeatherViewToggle({
    value,
    onValueChange,
}: {
    value: WeatherPopoverView;
    onValueChange: (value: WeatherPopoverView) => void;
}) {
    return (
        <ButtonGroup legend="Prikaz vremena" size="xs">
            <Button
                type="button"
                variant={value === 'weather' ? 'soft' : 'plain'}
                aria-label="Vrijeme"
                aria-pressed={value === 'weather'}
                title="Vrijeme"
                className={buttonGroupItemClassName({
                    iconOnly: true,
                    size: 'xs',
                })}
                onClick={() => onValueChange('weather')}
            >
                <Sun className="size-3.5" />
            </Button>
            <Button
                type="button"
                variant={value === 'graph' ? 'soft' : 'plain'}
                aria-label="Graf"
                aria-pressed={value === 'graph'}
                title="Graf"
                className={buttonGroupItemClassName({
                    iconOnly: true,
                    size: 'xs',
                })}
                onClick={() => onValueChange('graph')}
            >
                <Graph className="size-3.5" />
            </Button>
        </ButtonGroup>
    );
}
