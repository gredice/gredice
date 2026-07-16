import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type EmailClientOptions,
    KnownEmailSendStatus,
} from '@azure/communication-email';
import {
    assertEmailProviderSendSucceeded,
    classifyEmailProviderSubmissionFailure,
    createAtMostOnceEmailClient,
    EmailProviderSubmissionRejectedError,
    isEmailProviderSubmissionRejectedError,
} from './index';

const operationId = '018f0d12-2ec4-7fab-9d91-91f890ad5d73';

function classify(
    error: unknown,
    options: {
        providerSubmissionAccepted?: boolean;
        providerSubmissionStarted?: boolean;
    } = {},
) {
    return classifyEmailProviderSubmissionFailure({
        error,
        operationId,
        providerSubmissionAccepted: options.providerSubmissionAccepted ?? false,
        providerSubmissionStarted: options.providerSubmissionStarted ?? true,
    });
}

test('classifies explicit beginSend HTTP rejections with bounded retry semantics', () => {
    assert.deepEqual(
        classify({
            name: 'RestError',
            response: { status: 429 },
            statusCode: 429,
        }),
        { kind: 'rejected', retryable: true, statusCode: 429 },
    );

    for (const statusCode of [400, 401, 403, 404, 409, 422]) {
        assert.deepEqual(
            classify({
                name: 'RestError',
                response: { status: statusCode },
                statusCode,
            }),
            { kind: 'rejected', retryable: false, statusCode },
        );
    }

    assert.deepEqual(
        classify({ name: 'RestError', statusCode: 429 }),
        { kind: 'rejected', retryable: true, statusCode: 429 },
        'a bounded top-level SDK status is an explicit response rejection',
    );
    assert.deepEqual(classify({ name: 'RestError', statusCode: 400 }), {
        kind: 'rejected',
        retryable: false,
        statusCode: 400,
    });
});

test('keeps beginSend transport and post-acceptance polling failures uncertain', () => {
    assert.deepEqual(classify({ code: 'ETIMEDOUT', name: 'RestError' }), {
        kind: 'uncertain',
    });
    assert.deepEqual(classify(new Error('socket closed')), {
        kind: 'uncertain',
    });
    for (const statusCode of [408, 500, 501, 502, 503, 504, 505]) {
        assert.deepEqual(
            classify({
                name: 'RestError',
                response: { status: statusCode },
                statusCode,
            }),
            { kind: 'uncertain' },
            `HTTP ${statusCode}`,
        );
    }
    assert.deepEqual(
        classify(
            {
                name: 'RestError',
                response: { status: 503 },
                statusCode: 503,
            },
            { providerSubmissionAccepted: true },
        ),
        { kind: 'uncertain' },
        'poll failures remain ambiguous after beginSend returned a poller',
    );
});

test('at-most-once client performs one provider request when the transport result is ambiguous', async () => {
    let providerRequests = 0;
    const httpClient: NonNullable<EmailClientOptions['httpClient']> = {
        sendRequest: async () => {
            providerRequests += 1;
            throw Object.assign(new Error('connection reset after write'), {
                code: 'ECONNRESET',
            });
        },
    };
    const accessKey = Buffer.alloc(32, 7).toString('base64');
    const client = createAtMostOnceEmailClient(
        `endpoint=https://email.example.test/;accesskey=${accessKey}`,
        { httpClient },
    );

    await assert.rejects(
        client.beginSend(
            {
                senderAddress: 'sender@example.test',
                recipients: { to: [{ address: 'recipient@example.test' }] },
                content: { subject: 'At most once', plainText: 'Test' },
            },
            { operationId },
        ),
        /connection reset after write/u,
    );
    assert.equal(providerRequests, 1);
});

test('ignores malformed response status values and bounds rejection errors', () => {
    for (const status of [undefined, 0, 200, 399, 600, 429.5, '429']) {
        assert.deepEqual(
            classify({ name: 'RestError', response: { status } }),
            { kind: 'uncertain' },
        );
        assert.deepEqual(classify({ name: 'RestError', statusCode: status }), {
            kind: 'uncertain',
        });
    }

    const rejection = new EmailProviderSubmissionRejectedError(429);
    assert.equal(rejection.code, 'email_provider_submission_rejected');
    assert.equal(rejection.retryable, true);
    assert.equal(rejection.statusCode, 429);
    assert.equal(isEmailProviderSubmissionRejectedError(rejection), true);
    assert.equal(
        isEmailProviderSubmissionRejectedError({
            code: rejection.code,
            retryable: false,
            statusCode: 429,
        }),
        false,
        'structured guards reject inconsistent retry semantics',
    );
    assert.throws(
        () => new EmailProviderSubmissionRejectedError(200),
        /HTTP status/u,
    );
});

test('terminal poll results throw after the provider has completed the operation', () => {
    assert.doesNotThrow(() =>
        assertEmailProviderSendSucceeded({
            status: KnownEmailSendStatus.Succeeded,
        }),
    );
    for (const status of [
        KnownEmailSendStatus.Failed,
        KnownEmailSendStatus.Canceled,
    ]) {
        assert.throws(
            () =>
                assertEmailProviderSendSucceeded({
                    error: { code: 'ProviderFailure', message: 'terminal' },
                    status,
                }),
            /terminal/u,
        );
    }
});
