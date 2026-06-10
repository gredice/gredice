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
                {/* biome-ignore lint/performance/noImgElement: CDN asset is shared public brand artwork. */}
                <img
                    alt=""
                    className="size-24"
                    src="https://cdn.gredice.com/sunflower-sad-500x500.png"
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
