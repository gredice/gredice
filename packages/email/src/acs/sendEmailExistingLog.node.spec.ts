import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createElement } from 'react';

const operationId = '018f0d12-2ec4-7fab-9d91-91f890ad5d73';
const existingEmailLogId = 42;

type ProviderMode = 'failed' | 'succeeded';

function mockModule(
    t: TestContext,
    specifier: string,
    exports: Record<string, unknown>,
) {
    // Node 24 renamed `namedExports` to `exports` before @types/node exposed
    // the new option. Reflect keeps this test on the runtime API without a
    // stale type assertion or a deprecation warning.
    Reflect.apply(t.mock.module, t.mock, [specifier, { exports }]);
}

test('existing email logs preserve durable outbox ownership at the provider boundary', async (t) => {
    const events: string[] = [];
    const updates: Array<{
        id: number;
        values: Record<string, unknown>;
    }> = [];
    let createCalls = 0;
    let providerMode: ProviderMode = 'succeeded';
    let providerOptions: unknown;

    mockModule(t, 'react-email', {
        render: async (
            _template: unknown,
            options?: { plainText?: boolean },
        ) => {
            if (options?.plainText) {
                events.push('render-text');
                return 'Rendered plain text';
            }
            events.push('render-html');
            return '<p>Rendered HTML</p>';
        },
    });
    mockModule(t, '@gredice/storage', {
        createEmailMessageLog: async () => {
            createCalls += 1;
            throw new Error(
                'The existing-log path must not create another email log.',
            );
        },
        getEmailMessage: async (id: number) => {
            events.push('get-log');
            return id === existingEmailLogId
                ? {
                      id,
                      providerMessageId: operationId,
                  }
                : null;
        },
        updateEmailMessageLog: async (
            id: number,
            values: Record<string, unknown>,
        ) => {
            events.push('update-log');
            updates.push({ id, values });
            return { id, ...values };
        },
    });
    mockModule(t, '@azure/communication-email', {
        EmailClient: class {
            constructor() {
                events.push('client-created');
            }

            async beginSend(_message: unknown, options: unknown) {
                events.push('begin-send');
                providerOptions = options;
                return {
                    getOperationState: () => {
                        events.push('state-read');
                        return {
                            id: operationId,
                            status: 'Running',
                        };
                    },
                    pollUntilDone: async () => {
                        events.push('poll');
                        return providerMode === 'succeeded'
                            ? {
                                  id: operationId,
                                  status: 'Succeeded',
                              }
                            : {
                                  error: {
                                      code: 'ProviderFailure',
                                      message: 'Provider failed',
                                  },
                                  id: operationId,
                                  status: 'Failed',
                              };
                    },
                };
            }
        },
        KnownEmailSendStatus: {
            Canceled: 'Canceled',
            Failed: 'Failed',
            NotStarted: 'NotStarted',
            Running: 'Running',
            Succeeded: 'Succeeded',
        },
    });

    const moduleUrl = new URL('./index.ts', import.meta.url);
    moduleUrl.searchParams.set('test', 'existing-email-log');
    const { isEmailProviderTerminalFailureError, sendEmail } = await import(
        moduleUrl.href
    );
    const originalConnectionString = process.env.ACS_CONNECTION_STRING;
    process.env.ACS_CONNECTION_STRING =
        'endpoint=https://email.example.test/;accesskey=test';
    t.after(() => {
        if (originalConnectionString === undefined) {
            delete process.env.ACS_CONNECTION_STRING;
        } else {
            process.env.ACS_CONNECTION_STRING = originalConnectionString;
        }
    });

    function reset(mode: ProviderMode = 'succeeded') {
        events.length = 0;
        updates.length = 0;
        createCalls = 0;
        providerMode = mode;
        providerOptions = undefined;
    }

    function sendExisting(options: {
        abortSignal?: AbortSignal;
        beforeProviderSubmission?: () => Promise<void>;
    }) {
        return sendEmail({
            abortSignal: options.abortSignal,
            beforeProviderSubmission: options.beforeProviderSubmission,
            existingEmailLogId,
            from: 'sender@example.test',
            operationId,
            subject: 'Order confirmation',
            template: createElement('p', null, 'Order confirmed'),
            templateName: 'OrderConfirmationEmail',
            messageType: 'order_confirmation',
            to: 'recipient@example.test',
        });
    }

    function assertOnlyContentUpdate() {
        assert.equal(createCalls, 0);
        assert.equal(updates.length, 1);
        assert.equal(updates[0]?.id, existingEmailLogId);
        assert.deepEqual(Object.keys(updates[0]?.values ?? {}).sort(), [
            'attachments',
            'htmlBody',
            'messageType',
            'providerMessageId',
            'templateName',
            'textBody',
        ]);
    }

    await t.test(
        'renders and updates the existing log before fencing immediately before provider submission',
        async () => {
            reset();
            const abortController = new AbortController();

            const response = await sendExisting({
                abortSignal: abortController.signal,
                beforeProviderSubmission: async () => {
                    events.push('before-provider-submission');
                },
            });

            assert.equal(response.status, 'Succeeded');
            assert.deepEqual(events, [
                'render-html',
                'render-text',
                'get-log',
                'update-log',
                'client-created',
                'before-provider-submission',
                'begin-send',
                'state-read',
                'poll',
            ]);
            assertOnlyContentUpdate();
            assert.equal(
                Reflect.get(Object(providerOptions), 'abortSignal'),
                abortController.signal,
            );
            assert.equal(
                Reflect.get(Object(providerOptions), 'operationId'),
                operationId,
            );
        },
    );

    await t.test(
        'does not apply generic terminal status updates over the outbox state machine',
        async () => {
            reset('failed');

            await assert.rejects(
                sendExisting({
                    beforeProviderSubmission: async () => {
                        events.push('before-provider-submission');
                    },
                }),
                (error: unknown) => {
                    assert.equal(
                        isEmailProviderTerminalFailureError(error),
                        true,
                    );
                    return true;
                },
            );

            assertOnlyContentUpdate();
            assert.deepEqual(events, [
                'render-html',
                'render-text',
                'get-log',
                'update-log',
                'client-created',
                'before-provider-submission',
                'begin-send',
                'state-read',
                'poll',
            ]);
        },
    );

    await t.test(
        'checks an expired budget before the submission fence and provider request',
        async () => {
            reset();
            const abortController = new AbortController();
            abortController.abort(new Error('Worker budget exhausted'));

            await assert.rejects(
                sendExisting({
                    abortSignal: abortController.signal,
                    beforeProviderSubmission: async () => {
                        events.push('before-provider-submission');
                    },
                }),
                /Worker budget exhausted/u,
            );

            assertOnlyContentUpdate();
            assert.deepEqual(events, [
                'render-html',
                'render-text',
                'get-log',
                'update-log',
                'client-created',
            ]);
            assert.equal(providerOptions, undefined);
        },
    );
});
