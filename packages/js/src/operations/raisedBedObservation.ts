import { validateHostedImageUrl } from '../urls';

export const MAX_OBSERVATION_NOTES_LENGTH = 2000;
export const MAX_OBSERVATION_IMAGE_COUNT = 20;
export const MAX_OBSERVATION_IMAGE_SIZE = 25 * 1024 * 1024;

export type RaisedBedObservationTarget =
    | { kind: 'bed'; raisedBedId: number }
    | {
          kind: 'field';
          raisedBedId: number;
          positionIndex: number;
          plantCycleEventId: number;
          expectedPlantSortId: number;
      }
    | {
          kind: 'planting';
          raisedBedId: number;
          plantingId: number;
          expectedLifecycleVersionEventId: number;
          expectedPlantSortId: number;
      };

export class RaisedBedObservationError extends Error {}

function positiveId(value: unknown) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
        throw new RaisedBedObservationError(
            'Podaci opažanja nisu valjani. Osvježi stranicu.',
        );
    return value;
}

export function parseRaisedBedObservationTarget(
    value: unknown,
): RaisedBedObservationTarget {
    if (
        !value ||
        typeof value !== 'object' ||
        !('kind' in value) ||
        !('raisedBedId' in value)
    )
        throw new RaisedBedObservationError('Odaberi gredicu za opažanje.');
    const raisedBedId = positiveId(value.raisedBedId);
    if (value.kind === 'bed') return { kind: 'bed', raisedBedId };
    if (
        value.kind === 'field' &&
        'positionIndex' in value &&
        'plantCycleEventId' in value &&
        'expectedPlantSortId' in value
    ) {
        if (
            typeof value.positionIndex !== 'number' ||
            !Number.isSafeInteger(value.positionIndex) ||
            value.positionIndex < 0
        )
            throw new RaisedBedObservationError('Polje opažanja nije valjano.');
        return {
            kind: 'field',
            raisedBedId,
            positionIndex: value.positionIndex,
            plantCycleEventId: positiveId(value.plantCycleEventId),
            expectedPlantSortId: positiveId(value.expectedPlantSortId),
        };
    }
    if (
        value.kind === 'planting' &&
        'plantingId' in value &&
        'expectedLifecycleVersionEventId' in value &&
        'expectedPlantSortId' in value
    ) {
        return {
            kind: 'planting',
            raisedBedId,
            plantingId: positiveId(value.plantingId),
            expectedLifecycleVersionEventId: positiveId(
                value.expectedLifecycleVersionEventId,
            ),
            expectedPlantSortId: positiveId(value.expectedPlantSortId),
        };
    }
    throw new RaisedBedObservationError('Biljka opažanja nije valjana.');
}

export function parseObservationSubmissionId(value: unknown) {
    if (
        typeof value !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value,
        )
    )
        throw new RaisedBedObservationError('ID opažanja nije valjan.');
    return value.toLowerCase();
}

export function getObservationImagePathPrefix(
    raisedBedId: number,
    userId: string,
    submissionId: string,
) {
    return `raised-bed-observations/${positiveId(raisedBedId)}/${encodeURIComponent(userId)}/${parseObservationSubmissionId(submissionId)}/`;
}

export function normalizeObservationContent(
    notes: unknown,
    imageUrls: unknown,
    expectedPrefix: string,
) {
    if (
        typeof notes !== 'string' ||
        notes.length > MAX_OBSERVATION_NOTES_LENGTH ||
        !Array.isArray(imageUrls) ||
        imageUrls.length > MAX_OBSERVATION_IMAGE_COUNT
    )
        throw new RaisedBedObservationError(
            'Opažanje može sadržavati do 2000 znakova i 20 fotografija.',
        );
    const images: string[] = [];
    for (const url of imageUrls) {
        if (
            typeof url !== 'string' ||
            validateHostedImageUrl(url) ||
            !new URL(url).pathname.slice(1).startsWith(expectedPrefix)
        )
            throw new RaisedBedObservationError(
                'Fotografija mora biti učitana kroz ovo opažanje.',
            );
        if (images.includes(url))
            throw new RaisedBedObservationError(
                'Fotografija je dodana više puta.',
            );
        images.push(url);
    }
    const text = notes.trim();
    if (!text && images.length === 0)
        throw new RaisedBedObservationError(
            'Dodaj tekst ili fotografiju opažanja.',
        );
    return { notes: text, imageUrls: images };
}

export function isObservationImageUploadPath(pathname: string, prefix: string) {
    return (
        pathname.startsWith(prefix) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/i.test(
            pathname.slice(prefix.length),
        )
    );
}

export function assertObservationImageMetadata(
    url: string,
    prefix: string,
    metadata: {
        url: string;
        pathname: string;
        contentType: string;
        size: number;
    },
) {
    if (
        metadata.url !== url ||
        metadata.pathname !== new URL(url).pathname.slice(1) ||
        !metadata.pathname.startsWith(prefix) ||
        !metadata.contentType.toLowerCase().startsWith('image/') ||
        !Number.isSafeInteger(metadata.size) ||
        metadata.size <= 0 ||
        metadata.size > MAX_OBSERVATION_IMAGE_SIZE
    )
        throw new RaisedBedObservationError(
            'Fotografija nije valjana. Učitaj je ponovno.',
        );
}
