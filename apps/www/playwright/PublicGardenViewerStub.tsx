import type { PublicGardenViewerProps } from '@gredice/game';

export function PublicGardenViewerDynamic({ garden }: PublicGardenViewerProps) {
    return (
        <p data-testid="garden-scene" data-garden-id={garden?.id}>
            Pregled vrta: {garden?.name}
        </p>
    );
}
