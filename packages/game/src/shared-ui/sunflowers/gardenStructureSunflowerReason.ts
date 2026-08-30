export type GardenStructureSunflowerHistoryDescription = Readonly<{
    icon: 'construction' | 'refund' | 'resize';
    label: string;
}>;

export function getGardenStructureSunflowerHistoryDescription(
    reason: string,
): GardenStructureSunflowerHistoryDescription | null {
    const [prefix, gardenId, structureId, kind, operationId, effect, ...rest] =
        reason.split(':');
    if (
        rest.length > 0 ||
        prefix !== 'gardenStructure' ||
        !gardenId ||
        !structureId ||
        !operationId
    ) {
        return null;
    }

    if (kind === 'create' && effect === 'debit') {
        return { icon: 'construction', label: 'Izgradnja građevine' };
    }
    if (kind === 'resize' && effect === 'debit') {
        return { icon: 'resize', label: 'Proširenje građevine' };
    }
    if (kind === 'resize' && effect === 'refund') {
        return {
            icon: 'refund',
            label: 'Povrat za smanjenje građevine',
        };
    }
    if (kind === 'delete' && effect === 'refund') {
        return {
            icon: 'refund',
            label: 'Povrat za uklanjanje građevine',
        };
    }

    return null;
}
