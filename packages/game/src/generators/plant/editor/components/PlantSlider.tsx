'use client';

import { Slider } from '@signalco/ui-primitives/Slider';

interface PlantSliderProps {
    label: string;
    value: number[];
    onValueChange: (value: number[]) => void;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
}

export function PlantSlider({ label, ...props }: PlantSliderProps) {
    return (
        <div className="space-y-1">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Slider renders its own input internally */}
            <label className="text-sm font-medium">{label}</label>
            <Slider {...props} />
        </div>
    );
}
