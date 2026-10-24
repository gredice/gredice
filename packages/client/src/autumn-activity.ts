import {
    autumnActivityActionBodySchema,
    autumnActivityResponseSchema,
    autumnActivityStateSchema,
} from '@gredice/storage/autumnActivityContract';
import type { InferRequestType, InferResponseType } from 'hono';
import { clientAuthenticated } from './hono';

const endpoint = () =>
    clientAuthenticated().api.accounts.current['autumn-activity'];
type Endpoint = ReturnType<typeof endpoint>;
export type AutumnActivityState = InferResponseType<Endpoint['$get'], 200>;
export type AutumnActivityCommand = InferRequestType<
    Endpoint['actions']['$post']
>['json'];
export type AutumnActivityResponse = InferResponseType<
    Endpoint['actions']['$post'],
    200
>;
export function readStoredAutumnActivityCommand(
    value: unknown,
): AutumnActivityCommand | null {
    const result = autumnActivityActionBodySchema.safeParse(value);
    return result.success ? result.data : null;
}
export class AutumnActivityRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
    get uncertain() {
        return (
            this.status === 0 ||
            this.status === 401 ||
            this.status === 403 ||
            this.status === 408 ||
            this.status === 429 ||
            this.status >= 500 ||
            this.code === 'EXPECTED_ACCOUNT_MISMATCH'
        );
    }
    get serverDefinitive() {
        return !this.uncertain;
    }
}
export async function getAutumnActivityState(
    options: { signal?: AbortSignal } = {},
) {
    const response = await endpoint().$get(
        {},
        { init: { signal: options.signal } },
    );
    const value = await response.json().catch(() => null);
    const parsed = autumnActivityStateSchema.safeParse(value);
    if (!response.ok || !parsed.success)
        throw new AutumnActivityRequestError(
            response.ok ? 500 : response.status,
            'ACTIVITY_READ_FAILED',
            'Jesenski album trenutačno nije moguće učitati.',
        );
    return parsed.data;
}
export async function submitAutumnActivityAction(
    command: AutumnActivityCommand,
) {
    const response = await endpoint()
        .actions.$post({ json: command })
        .catch(() => {
            throw new AutumnActivityRequestError(
                0,
                'NETWORK_ERROR',
                'Potvrda albuma nije stigla. Pokušaj ponovno istim zahtjevom.',
            );
        });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const code =
            value &&
            typeof value === 'object' &&
            'code' in value &&
            typeof value.code === 'string'
                ? value.code
                : 'ACTIVITY_FAILED';
        const error =
            value &&
            typeof value === 'object' &&
            'error' in value &&
            typeof value.error === 'string'
                ? value.error
                : 'Radnja albuma nije uspjela.';
        throw new AutumnActivityRequestError(response.status, code, error);
    }
    const parsed = autumnActivityResponseSchema.safeParse(value);
    if (
        !parsed.success ||
        parsed.data.accountId !== command.expectedAccountId ||
        parsed.data.operationId !== command.operationId ||
        parsed.data.campaignId !== command.campaignId ||
        parsed.data.campaignVersionId !== command.campaignVersionId ||
        (command.action.kind === 'discover' &&
            !parsed.data.progress.discoveredMotifIds.includes(
                command.action.motifId,
            )) ||
        (command.action.kind === 'claim-welcome' &&
            parsed.data.progress.welcomePurchaseId === null) ||
        parsed.data.granted.some(
            (grant) =>
                grant.kind !==
                    (command.action.kind === 'claim-welcome'
                        ? 'welcome'
                        : 'completion') ||
                grant.purchaseId !==
                    (grant.kind === 'welcome'
                        ? parsed.data.progress.welcomePurchaseId
                        : parsed.data.progress.completionPurchaseId),
        )
    )
        throw new AutumnActivityRequestError(
            500,
            'INVALID_RECEIPT',
            'Potvrdu albuma nije moguće provjeriti. Pokušaj ponovno istim zahtjevom.',
        );
    return parsed.data;
}
