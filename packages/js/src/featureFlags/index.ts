export const booleanFlagOptions = [
    { label: 'Off', value: false },
    { label: 'On', value: true },
];

export const publicGardensFlagDefinition = {
    key: 'publicGardens',
    description:
        'Enable opt-in public gardens, public garden pages, and visibility controls.',
    options: booleanFlagOptions,
};
