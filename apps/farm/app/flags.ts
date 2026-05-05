import { flag } from 'flags/next';

function isDevOrTestEnvironment() {
    return (
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test'
    );
}

export const showUIFlag = flag<boolean>({
    key: 'showUI',
    description: 'Enable feature-gated UI elements in farm app.',
    decide: () => isDevOrTestEnvironment(),
    options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
    ],
});
