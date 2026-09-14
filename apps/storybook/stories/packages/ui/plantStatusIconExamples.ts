import type { PlantFieldStatus } from '@packages/game/hud/raisedBed/featuredOperations';

const statusIdeas = {
    new: 'Seed packet waiting to be sown',
    planned: 'Seed packet with a calendar',
    pendingVerification: 'Sown seed with a magnifying glass',
    sowed: 'Seed nestled in a cutaway of soil',
    sprouted: 'Fresh seedling',
    firstFlowers: 'First pink blossom',
    firstFruitSet: 'Developing fruit still attached to the plant',
    notSprouted: 'Sown seed with a red cross',
    ready: 'Ripe carrot ready to pick',
    harvested: 'Picked vegetables in a wooden crate',
    died: 'Wilted plant with dry drooping leaves',
    removed: 'Cleared bed with a shovel',
} satisfies Record<PlantFieldStatus, string>;

export const plantStatusIconExamples = [
    ...Object.entries(statusIdeas).map(([status, idea]) => ({ status, idea })),
    { status: 'unknown', idea: 'Information marker for an unknown status' },
];
