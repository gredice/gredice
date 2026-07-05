import 'server-only';

import {
    ensureReceiptForInvoice,
    getAllFiscalizationSettings,
    getFiscalizationUserSettings,
    getReceipt,
    type ReceiptForInvoiceData,
    updateReceiptFiscalization,
} from '@gredice/storage';
import {
    type ReceiptRequestResult,
    receiptRequest,
} from './clients/requests/receiptRequest';

const DEFAULT_BUSINESS_NAME = 'Gredice d.o.o.';
const DEFAULT_BUSINESS_ADDRESS =
    'Ulica Julija Knifera 3, 10000 Zagreb, Hrvatska';

type ReceiptRequestFn = typeof receiptRequest;
type FiscalizationEnvironment = 'educ' | 'prod';

export interface IssueReceiptForPaidInvoiceInput {
    invoiceId: number;
    issuedAt?: Date | null;
    paymentMethod?: ReceiptForInvoiceData['paymentMethod'];
    paymentReference?: string | null;
}

type IssueReceiptForPaidInvoiceDeps = {
    ensureReceiptForInvoice: typeof ensureReceiptForInvoice;
    getFiscalizationUserSettings: typeof getFiscalizationUserSettings;
};

const issueReceiptDeps: IssueReceiptForPaidInvoiceDeps = {
    ensureReceiptForInvoice,
    getFiscalizationUserSettings,
};

export async function issueReceiptForPaidInvoice(
    input: IssueReceiptForPaidInvoiceInput,
    deps: IssueReceiptForPaidInvoiceDeps = issueReceiptDeps,
) {
    const userSettings = await deps.getFiscalizationUserSettings();

    return deps.ensureReceiptForInvoice(input.invoiceId, {
        issuedAt: input.issuedAt,
        paymentMethod: input.paymentMethod ?? 'card',
        paymentReference: input.paymentReference,
        businessPin: userSettings?.pin,
        businessName: DEFAULT_BUSINESS_NAME,
        businessAddress: DEFAULT_BUSINESS_ADDRESS,
    });
}

export type FiscalizeReceiptFailedReason =
    | 'missing_user_settings'
    | 'missing_pos_settings'
    | 'cis_rejected'
    | 'request_failed';

export type FiscalizeReceiptResult =
    | {
          status: 'confirmed' | 'existing';
          receiptId: number;
          receiptNumber: string;
          jir?: string | null;
          zki?: string | null;
      }
    | {
          status: 'failed';
          reason: FiscalizeReceiptFailedReason;
          receiptId: number;
          message: string;
          zki?: string | null;
      }
    | {
          status: 'skipped';
          reason: 'receipt_not_found';
          message: string;
      };

type FiscalizeReceiptDeps = {
    getAllFiscalizationSettings: typeof getAllFiscalizationSettings;
    getReceipt: typeof getReceipt;
    receiptRequest: ReceiptRequestFn;
    updateReceiptFiscalization: typeof updateReceiptFiscalization;
};

const fiscalizeReceiptDeps: FiscalizeReceiptDeps = {
    getAllFiscalizationSettings,
    getReceipt,
    receiptRequest,
    updateReceiptFiscalization,
};

function normalizeFiscalizationEnvironment(
    environment: string,
): FiscalizationEnvironment {
    return environment === 'prod' ? 'prod' : 'educ';
}

async function markReceiptFiscalizationFailed(
    receipt: NonNullable<Awaited<ReturnType<typeof getReceipt>>>,
    reason: FiscalizeReceiptFailedReason,
    message: string,
    deps: Pick<FiscalizeReceiptDeps, 'updateReceiptFiscalization'>,
    response?: Pick<
        Extract<ReceiptRequestResult, { success: false }>,
        'responseText' | 'zki'
    >,
): Promise<FiscalizeReceiptResult> {
    await deps.updateReceiptFiscalization(receipt.id, {
        zki: response?.zki ?? receipt.zki ?? undefined,
        cisStatus: 'failed',
        cisErrorMessage: message,
        cisTimestamp: new Date(),
        cisResponse: response?.responseText ?? receipt.cisResponse,
    });

    return {
        status: 'failed',
        reason,
        receiptId: receipt.id,
        message,
        zki: response?.zki ?? receipt.zki,
    };
}

export async function fiscalizeReceipt(
    receiptId: number,
    deps: FiscalizeReceiptDeps = fiscalizeReceiptDeps,
): Promise<FiscalizeReceiptResult> {
    const receipt = await deps.getReceipt(receiptId);
    if (!receipt) {
        return {
            status: 'skipped',
            reason: 'receipt_not_found',
            message: `Receipt ${receiptId} was not found.`,
        };
    }

    if (receipt.cisStatus === 'confirmed' && receipt.jir) {
        return {
            status: 'existing',
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            jir: receipt.jir,
            zki: receipt.zki,
        };
    }

    const fiscalizationSettings = await deps.getAllFiscalizationSettings();
    if (!fiscalizationSettings.userSettings) {
        return markReceiptFiscalizationFailed(
            receipt,
            'missing_user_settings',
            'Fiscalization user settings not found for account.',
            deps,
        );
    }
    if (!fiscalizationSettings.posSettings) {
        return markReceiptFiscalizationFailed(
            receipt,
            'missing_pos_settings',
            'Fiscalization POS settings not found for account.',
            deps,
        );
    }

    try {
        const response = await deps.receiptRequest(
            {
                date: receipt.issuedAt,
                receiptNumber: receipt.receiptNumber,
                totalAmount: Number(receipt.totalAmount),
            },
            {
                posSettings: {
                    posId: fiscalizationSettings.posSettings.posId,
                    premiseId: fiscalizationSettings.posSettings.premiseId,
                },
                posUser: {
                    posPin: fiscalizationSettings.userSettings.pin,
                },
                userSettings: {
                    pin: fiscalizationSettings.userSettings.pin,
                    environment: normalizeFiscalizationEnvironment(
                        fiscalizationSettings.userSettings.environment,
                    ),
                    useVat: fiscalizationSettings.userSettings.useVat,
                    credentials: {
                        password:
                            fiscalizationSettings.userSettings.certPassword,
                        cert: Buffer.from(
                            fiscalizationSettings.userSettings.certBase64,
                            'base64',
                        ).toString('binary'),
                    },
                    receiptNumberOnDevice:
                        fiscalizationSettings.userSettings
                            .receiptNumberOnDevice,
                },
            },
        );

        if (!response.success) {
            return markReceiptFiscalizationFailed(
                receipt,
                'cis_rejected',
                response.errors?.[0]?.errorMessage ??
                    'Fiscalization request was rejected.',
                deps,
                response,
            );
        }

        await deps.updateReceiptFiscalization(receipt.id, {
            jir: response.jir,
            zki: response.zki,
            cisTimestamp: response.dateTime,
            cisStatus: 'confirmed',
            cisErrorMessage: null,
            cisReference: response.receiptNumber,
            cisResponse: response.responseText,
        });

        return {
            status: 'confirmed',
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            jir: response.jir,
            zki: response.zki,
        };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Failed to fiscalize receipt.';
        return markReceiptFiscalizationFailed(
            receipt,
            'request_failed',
            message,
            deps,
        );
    }
}
