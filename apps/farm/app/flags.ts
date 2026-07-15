import { flag } from 'flags/next';
import type { FarmOperationCompletionSyncMode } from '../lib/offline/operationCompletionSyncMode';

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

export const farmOperationCompletionSyncModeFlag =
    flag<FarmOperationCompletionSyncMode>({
        key: 'farmOperationCompletionSyncMode',
        description:
            'Control local operation-completion queue creation and foreground draining.',
        decide: () => (isDevOrTestEnvironment() ? 'enabled' : 'off'),
        options: [
            { label: 'Off', value: 'off' },
            { label: 'Drain only', value: 'drain_only' },
            { label: 'Enabled', value: 'enabled' },
        ],
    });
