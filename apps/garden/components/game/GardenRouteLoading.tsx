import { Spinner } from '@gredice/ui/Spinner';

export function GardenRouteLoading() {
    return (
        <div className="grid h-[100dvh] place-items-center bg-muted">
            <Spinner
                className="size-8 text-primary"
                loadingLabel="Učitavanje vrta"
            />
        </div>
    );
}
