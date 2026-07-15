import { Button } from '@gredice/ui/Button';
import { ExternalLink } from '@gredice/ui/icons';

interface PlantSortPublicLinkProps {
    label: string;
    publicUrl: string;
}

export function PlantSortPublicLink({
    label,
    publicUrl,
}: PlantSortPublicLinkProps) {
    return (
        <Button
            aria-label={`Otvori javnu stranicu sorte ${label} u novoj kartici`}
            className="h-auto min-h-11 shrink-0"
            href={publicUrl}
            rel="noreferrer"
            size="lg"
            startDecorator={
                <ExternalLink aria-hidden className="size-4 shrink-0" />
            }
            target="_blank"
            title="Otvori javnu stranicu sorte"
            variant="plain"
        >
            www
        </Button>
    );
}
