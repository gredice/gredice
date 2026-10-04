import { Skeleton } from '@gredice/ui/Skeleton';

export function FarmTodayLoadingState() {
    return (
        <section
            aria-busy="true"
            aria-label="Učitavanje današnjih zadataka"
            className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4"
        >
            <div aria-hidden="true" className="space-y-3">
                <header className="flex min-h-11 items-start justify-between gap-2">
                    <Skeleton className="h-7 w-36 max-w-[60%]" />
                    <div className="flex shrink-0 gap-1">
                        <Skeleton className="size-11" />
                        <Skeleton className="size-11" />
                    </div>
                </header>

                <div
                    className="grid grid-cols-4 divide-x rounded-lg border bg-card px-1 py-2 shadow-xs"
                    data-today-loading-summary
                >
                    <div
                        className="min-w-0 space-y-1 text-center"
                        data-today-loading-summary-item
                    >
                        <Skeleton className="mx-auto h-5 w-8 max-w-full" />
                        <Skeleton className="mx-auto h-3 w-14 max-w-full" />
                    </div>
                    <div
                        className="min-w-0 space-y-1 text-center"
                        data-today-loading-summary-item
                    >
                        <Skeleton className="mx-auto h-5 w-8 max-w-full" />
                        <Skeleton className="mx-auto h-3 w-16 max-w-full" />
                    </div>
                    <div
                        className="min-w-0 space-y-1 text-center"
                        data-today-loading-summary-item
                    >
                        <Skeleton className="mx-auto h-5 w-10 max-w-full" />
                        <Skeleton className="mx-auto h-3 w-20 max-w-full" />
                    </div>
                    <div
                        className="min-w-0 space-y-1 text-center"
                        data-today-loading-summary-item
                    >
                        <Skeleton className="mx-auto h-5 w-10 max-w-full" />
                        <Skeleton className="mx-auto h-3 w-14 max-w-full" />
                    </div>
                </div>

                <section>
                    <div
                        className="space-y-3 rounded-lg border bg-card p-3 shadow-xs"
                        data-today-loading-task
                    >
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-3 w-24 max-w-full" />
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-5 w-4/5" />
                            </div>
                            <Skeleton className="size-6 shrink-0 rounded-full" />
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-2">
                            <Skeleton className="h-6 w-16 max-w-full rounded-full" />
                            <Skeleton className="h-6 w-20 max-w-full rounded-full" />
                            <Skeleton className="h-6 w-24 max-w-full rounded-full" />
                        </div>
                        <Skeleton className="h-11 w-full" />
                    </div>
                </section>

                <section className="space-y-2">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <div className="space-y-2 rounded-lg border bg-card p-3 shadow-xs">
                        <Skeleton className="h-4 w-3/4 max-w-full" />
                        <Skeleton className="h-3 w-1/2 max-w-full" />
                    </div>
                </section>
            </div>
        </section>
    );
}
