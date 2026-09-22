import { SunflowerMascot3D } from '@gredice/ui/SunflowerVisuals';
import type { ReactNode } from 'react';

export function EmptyNewsState({
    children,
    title,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="grid min-h-72 place-items-center rounded-md border border-dashed bg-muted/20 p-8 text-center">
            <div className="grid max-w-sm gap-4 justify-items-center">
                <SunflowerMascot3D
                    expression="sad"
                    aria-hidden
                    className="size-24"
                />
                <div className="grid gap-2">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                        {children}
                    </p>
                </div>
            </div>
        </div>
    );
}
