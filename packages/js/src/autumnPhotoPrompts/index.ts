/** Optional inspiration; no completion, purchase, login or sharing requirement. */
export const autumnPhotoPrompts = [
    {
        id: 'moja-jesenska-gredica',
        title: 'Moja jesenska gredica',
        description: 'Odaberi kut vrta koji ti je najdraži ove jeseni.',
    },
    {
        id: 'pod-svjetlom-fenjera',
        title: 'Pod svjetlom fenjera',
        description:
            'Pronađi svoj mirni večernji prizor. Fenjer je samo inspiracija.',
    },
    {
        id: 'prvi-list',
        title: 'Prvi list',
        description: 'Zabilježi mali znak jeseni, onako kako ga ti vidiš.',
    },
];
export function getAutumnPhotoFilename(promptId: string) {
    const prompt = autumnPhotoPrompts.find(
        (candidate) => candidate.id === promptId,
    );
    if (!prompt) throw new Error('Unknown photo prompt');
    return `${prompt.id}.png`;
}
