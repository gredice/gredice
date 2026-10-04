import type { ReactNode } from 'react';

export type VisualizationSectionProps = {
    title: string;
    label: string;
    cube: ReactNode;
    controls: ReactNode;
    withDivider?: boolean;
};

export function VisualizationSection({
    title,
    label,
    cube,
    controls,
    withDivider = false,
}: VisualizationSectionProps) {
    return (
        <div
            className={`min-w-0 px-2 py-2 ${
                withDivider ? 'border-l border-border/70' : ''
            }`}
        >
            <div className="flex h-14 items-center justify-center">{cube}</div>
            <div className="mt-2 flex h-10 items-center justify-center rounded-md bg-muted/40">
                {controls}
            </div>
            <p className="mt-1.5 truncate text-center text-[11px] font-semibold leading-tight text-foreground">
                {title}
            </p>
            <p className="truncate text-center text-[10px] leading-tight text-muted-foreground">
                {label}
            </p>
        </div>
    );
}
