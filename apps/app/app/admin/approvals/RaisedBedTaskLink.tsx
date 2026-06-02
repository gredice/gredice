import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';

export function RaisedBedTaskLink({
    raisedBedId,
    physicalId,
}: {
    raisedBedId: number;
    physicalId?: string | null;
}) {
    const label = physicalId ? `Gredica ${physicalId}` : 'Gredica';

    return (
        <Link
            href={KnownPages.RaisedBed(raisedBedId)}
            aria-label={`Otvori detalje: ${label}`}
            title={`Otvori detalje: ${label}`}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
            <RaisedBedIcon
                physicalId={physicalId ?? null}
                containerClassName="h-8 min-w-8"
                className="size-7"
            />
        </Link>
    );
}
