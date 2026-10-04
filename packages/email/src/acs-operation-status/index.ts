import {
    createCommunicationAuthPolicy,
    parseConnectionString,
} from '@azure/communication-common';
import {
    createDefaultHttpClient,
    createEmptyPipeline,
    createPipelineRequest,
    type HttpClient,
    type PipelineResponse,
} from '@azure/core-rest-pipeline';

const apiVersion = '2025-09-01';
const maximumConnectionStringLength = 4_096;
const maximumResponseBodyLength = 16_384;
const requestTimeoutMs = 10_000;
const canonicalUuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const acsEmailOperationStatuses = [
    'Succeeded',
    'Failed',
    'Canceled',
    'Running',
    'NotStarted',
] as const;

export type AcsEmailOperationStatus =
    (typeof acsEmailOperationStatuses)[number];

export type AcsEmailOperationStatusConfigErrorReason =
    | 'invalid_connection_string'
    | 'invalid_endpoint'
    | 'invalid_operation_id'
    | 'missing_connection_string';

export class AcsEmailOperationStatusConfigError extends Error {
    readonly code = 'acs_email_operation_status_configuration_error';
    readonly reason: AcsEmailOperationStatusConfigErrorReason;

    constructor(reason: AcsEmailOperationStatusConfigErrorReason) {
        super(`ACS email operation status configuration failed: ${reason}.`);
        this.name = 'AcsEmailOperationStatusConfigError';
        this.reason = reason;
    }
}

export type AcsEmailOperationStatusHttpErrorReason =
    | 'invalid_response_status'
    | 'response'
    | 'transport';

export class AcsEmailOperationStatusHttpError extends Error {
    readonly code = 'acs_email_operation_status_http_error';
    readonly reason: AcsEmailOperationStatusHttpErrorReason;
    readonly retryable: boolean;
    readonly statusCode: number | null;

    constructor({
        reason,
        retryable,
        statusCode,
    }: {
        reason: AcsEmailOperationStatusHttpErrorReason;
        retryable: boolean;
        statusCode: number | null;
    }) {
        super(
            statusCode === null
                ? `ACS email operation status request failed: ${reason}.`
                : `ACS email operation status request failed with HTTP status ${statusCode}.`,
        );
        this.name = 'AcsEmailOperationStatusHttpError';
        this.reason = reason;
        this.retryable = retryable;
        this.statusCode = statusCode;
    }
}

export type AcsEmailOperationStatusParseErrorReason =
    | 'body_too_large'
    | 'empty_body'
    | 'invalid_json'
    | 'invalid_payload'
    | 'mismatched_operation_id'
    | 'unknown_status';

export class AcsEmailOperationStatusParseError extends Error {
    readonly code = 'acs_email_operation_status_parse_error';
    readonly reason: AcsEmailOperationStatusParseErrorReason;

    constructor(reason: AcsEmailOperationStatusParseErrorReason) {
        super(
            `ACS email operation status response could not be parsed: ${reason}.`,
        );
        this.name = 'AcsEmailOperationStatusParseError';
        this.reason = reason;
    }
}

export class AcsEmailOperationStatusAbortedError extends Error {
    readonly code = 'acs_email_operation_status_aborted';

    constructor() {
        super('ACS email operation status request was aborted.');
        this.name = 'AcsEmailOperationStatusAbortedError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConfigErrorReason(
    value: unknown,
): value is AcsEmailOperationStatusConfigErrorReason {
    return (
        value === 'invalid_connection_string' ||
        value === 'invalid_endpoint' ||
        value === 'invalid_operation_id' ||
        value === 'missing_connection_string'
    );
}

function isHttpErrorReason(
    value: unknown,
): value is AcsEmailOperationStatusHttpErrorReason {
    return (
        value === 'invalid_response_status' ||
        value === 'response' ||
        value === 'transport'
    );
}

function isParseErrorReason(
    value: unknown,
): value is AcsEmailOperationStatusParseErrorReason {
    return (
        value === 'body_too_large' ||
        value === 'empty_body' ||
        value === 'invalid_json' ||
        value === 'invalid_payload' ||
        value === 'mismatched_operation_id' ||
        value === 'unknown_status'
    );
}

function isBoundedHttpStatus(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 100 &&
        value <= 599
    );
}

export function isAcsEmailOperationStatusConfigError(
    error: unknown,
): error is AcsEmailOperationStatusConfigError {
    return (
        error instanceof AcsEmailOperationStatusConfigError ||
        (isRecord(error) &&
            error.code === 'acs_email_operation_status_configuration_error' &&
            isConfigErrorReason(error.reason))
    );
}

export function isAcsEmailOperationStatusHttpError(
    error: unknown,
): error is AcsEmailOperationStatusHttpError {
    return (
        error instanceof AcsEmailOperationStatusHttpError ||
        (isRecord(error) &&
            error.code === 'acs_email_operation_status_http_error' &&
            isHttpErrorReason(error.reason) &&
            typeof error.retryable === 'boolean' &&
            (error.statusCode === null ||
                isBoundedHttpStatus(error.statusCode)))
    );
}

export function isAcsEmailOperationStatusParseError(
    error: unknown,
): error is AcsEmailOperationStatusParseError {
    return (
        error instanceof AcsEmailOperationStatusParseError ||
        (isRecord(error) &&
            error.code === 'acs_email_operation_status_parse_error' &&
            isParseErrorReason(error.reason))
    );
}

export function isAcsEmailOperationStatusAbortedError(
    error: unknown,
): error is AcsEmailOperationStatusAbortedError {
    return (
        error instanceof AcsEmailOperationStatusAbortedError ||
        (isRecord(error) && error.code === 'acs_email_operation_status_aborted')
    );
}

export function isAcsEmailOperationStatus(
    status: unknown,
): status is AcsEmailOperationStatus {
    return acsEmailOperationStatuses.some((candidate) => candidate === status);
}

function parseEndpoint(connectionString: string) {
    if (connectionString.length > maximumConnectionStringLength) {
        throw new AcsEmailOperationStatusConfigError(
            'invalid_connection_string',
        );
    }

    let parsedConnectionString: ReturnType<typeof parseConnectionString>;
    try {
        parsedConnectionString = parseConnectionString(connectionString);
    } catch {
        throw new AcsEmailOperationStatusConfigError(
            'invalid_connection_string',
        );
    }

    let endpoint: URL;
    try {
        endpoint = new URL(parsedConnectionString.endpoint);
    } catch {
        throw new AcsEmailOperationStatusConfigError('invalid_endpoint');
    }

    if (
        !/^[A-Za-z0-9+/]+={0,2}$/u.test(
            parsedConnectionString.credential.key,
        ) ||
        parsedConnectionString.credential.key.length < 16 ||
        parsedConnectionString.credential.key.length > 1_024 ||
        parsedConnectionString.credential.key.length % 4 !== 0
    ) {
        throw new AcsEmailOperationStatusConfigError(
            'invalid_connection_string',
        );
    }

    if (
        endpoint.protocol !== 'https:' ||
        endpoint.username !== '' ||
        endpoint.password !== '' ||
        endpoint.port !== '' ||
        endpoint.search !== '' ||
        endpoint.hash !== '' ||
        (endpoint.pathname !== '' && endpoint.pathname !== '/')
    ) {
        throw new AcsEmailOperationStatusConfigError('invalid_endpoint');
    }

    return {
        credential: parsedConnectionString.credential,
        origin: endpoint.origin,
    };
}

function httpStatusIsRetryable(statusCode: number) {
    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function parseOperationStatus(
    bodyAsText: string | null | undefined,
    operationId: string,
) {
    if (bodyAsText === undefined || bodyAsText === null || bodyAsText === '') {
        throw new AcsEmailOperationStatusParseError('empty_body');
    }
    if (bodyAsText.length > maximumResponseBodyLength) {
        throw new AcsEmailOperationStatusParseError('body_too_large');
    }

    let body: unknown;
    try {
        body = JSON.parse(bodyAsText);
    } catch {
        throw new AcsEmailOperationStatusParseError('invalid_json');
    }

    if (!isRecord(body) || typeof body.status !== 'string') {
        throw new AcsEmailOperationStatusParseError('invalid_payload');
    }
    if (!isAcsEmailOperationStatus(body.status)) {
        throw new AcsEmailOperationStatusParseError('unknown_status');
    }
    if (typeof body.id !== 'string' || !canonicalUuidPattern.test(body.id)) {
        throw new AcsEmailOperationStatusParseError('invalid_payload');
    }
    if (body.id.toLowerCase() !== operationId.toLowerCase()) {
        throw new AcsEmailOperationStatusParseError('mismatched_operation_id');
    }

    return body.status;
}

function errorLooksAborted(error: unknown, abortSignal?: AbortSignal) {
    return (
        abortSignal?.aborted === true ||
        (isRecord(error) && error.name === 'AbortError')
    );
}

export type GetAcsEmailOperationStatusOptions = {
    abortSignal?: AbortSignal;
    connectionString?: string;
    httpClient?: HttpClient;
};

export async function getAcsEmailOperationStatus(
    operationId: string,
    options: GetAcsEmailOperationStatusOptions = {},
): Promise<AcsEmailOperationStatus> {
    if (!canonicalUuidPattern.test(operationId)) {
        throw new AcsEmailOperationStatusConfigError('invalid_operation_id');
    }

    const connectionString =
        options.connectionString ?? process.env.ACS_CONNECTION_STRING;
    if (!connectionString?.trim()) {
        throw new AcsEmailOperationStatusConfigError(
            'missing_connection_string',
        );
    }
    if (options.abortSignal?.aborted) {
        throw new AcsEmailOperationStatusAbortedError();
    }

    const { credential, origin } = parseEndpoint(connectionString);
    const pipeline = createEmptyPipeline();
    pipeline.addPolicy(createCommunicationAuthPolicy(credential), {
        phase: 'Sign',
    });

    const request = createPipelineRequest({
        abortSignal: options.abortSignal,
        method: 'GET',
        timeout: requestTimeoutMs,
        url: `${origin}/emails/operations/${operationId.toLowerCase()}?api-version=${apiVersion}`,
    });

    let response: PipelineResponse;
    try {
        response = await pipeline.sendRequest(
            options.httpClient ?? createDefaultHttpClient(),
            request,
        );
    } catch (error) {
        if (errorLooksAborted(error, options.abortSignal)) {
            throw new AcsEmailOperationStatusAbortedError();
        }
        throw new AcsEmailOperationStatusHttpError({
            reason: 'transport',
            retryable: true,
            statusCode: null,
        });
    }

    if (!isBoundedHttpStatus(response.status)) {
        throw new AcsEmailOperationStatusHttpError({
            reason: 'invalid_response_status',
            retryable: false,
            statusCode: null,
        });
    }
    if (response.status < 200 || response.status >= 300) {
        throw new AcsEmailOperationStatusHttpError({
            reason: 'response',
            retryable: httpStatusIsRetryable(response.status),
            statusCode: response.status,
        });
    }

    return parseOperationStatus(response.bodyAsText, operationId);
}
