import type { IncomingMessage } from 'node:http';
import { flag } from 'flags/next';

const booleanOptions = [
    { label: 'Off', value: false },
    { label: 'On', value: true },
];

type FlagRequest = IncomingMessage & {
    cookies: Partial<Record<string, string>>;
};

export const tutorialChecklistFlag = flag<boolean>({
    key: 'tutorialChecklist',
    description: 'Enable the tutorial checklist HUD and reward claims.',
    decide: () => false,
    options: booleanOptions,
});

function toFlagRequest(request: Request): FlagRequest {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });

    return {
        cookies: {},
        headers,
    } as FlagRequest;
}

export async function isTutorialChecklistEnabled(request?: Request) {
    if (request) {
        return tutorialChecklistFlag.run({
            identify: {},
            request: toFlagRequest(request),
        });
    }

    return tutorialChecklistFlag();
}
