import Image from 'next/image';
import {
    getAutumnArrangementItems,
    getAutumnArrangementLayout,
    getAutumnArrangementPreviewUrl,
    getAvailableAutumnArrangements,
} from '../arrangements/autumnArrangements';
import { useBlockData } from '../hooks/useBlockData';
import { useIsSandboxGarden } from '../hooks/useCurrentGarden';
import { useGameState } from '../useGameState';

export function AutumnArrangementPreview({
    collectionId,
}: {
    collectionId: string;
}) {
    const { data: blockData } = useBlockData();
    const isSandbox = useIsSandboxGarden();
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const arrangement = getAvailableAutumnArrangements({
        blockData,
        isSandbox,
    }).find((entry) => entry.collectionId === collectionId);
    if (!arrangement || !blockData) return null;
    const { decoration, garden } = getAutumnArrangementLayout(
        arrangement,
        blockData,
    );
    const labels = new Map(
        blockData.map((block) => [
            block.information.name,
            block.information.label,
        ]),
    );
    return (
        <details
            className="col-span-full min-w-full w-0 border-b pb-2 text-sm"
            data-autumn-arrangement={arrangement.id}
        >
            <summary className="cursor-pointer rounded px-2 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
                Primjer rasporeda · {decoration.width} × {decoration.depth}
            </summary>
            <div className="space-y-2 px-2 pt-2">
                <Image
                    src={getAutumnArrangementPreviewUrl(
                        arrangement,
                        appBaseUrl,
                    )}
                    unoptimized
                    alt={arrangement.description}
                    width={780}
                    height={600}
                    className="h-auto w-full rounded"
                    draggable={false}
                />
                <p className="font-medium">{arrangement.title}</p>
                <p className="text-muted-foreground">
                    Ideja za ručno slaganje. Predmeti se odabiru pojedinačno.
                </p>
                <p>Ukrasi · {decoration.occupiedCells} zauzetih polja</p>
                <ul className="list-disc space-y-1 pl-4">
                    {getAutumnArrangementItems(arrangement, 'included').map(
                        (item) => (
                            <li key={item.entityName}>
                                {item.quantity} × {labels.get(item.entityName)}
                            </li>
                        ),
                    )}
                </ul>
                <p className="text-muted-foreground">
                    Okolina na slici ({garden.width} × {garden.depth}):{' '}
                    {getAutumnArrangementItems(arrangement, 'scenery')
                        .map(
                            (item) =>
                                `${item.quantity} × ${labels.get(item.entityName)}`,
                        )
                        .join(', ')}
                    . Okolina je prikazana zasebno od popisa ukrasa.
                </p>
            </div>
        </details>
    );
}
