import { getEmailMessageByTemplateAndMetadata } from '@gredice/storage';

const orderConfirmationTemplateName = 'commerce-order-confirmation';
const orderConfirmationOutboxKind = 'order_confirmation';

type PaidCart = {
    accountId: string | null;
    id: number;
    status: string;
};

type DirectCheckoutRetryResponse =
    | {
          body: { success: true };
          status: 200;
      }
    | {
          body: {
              code: 'CHECKOUT_CONFIRMATION_MISSING';
              error: string;
          };
          status: 409;
      };

export type DirectCheckoutRetryDependencies = {
    getConfirmationIntent: (input: {
        metadataKey: string;
        metadataValue: string;
        templateName: string;
    }) => Promise<{ metadata: unknown } | undefined>;
};

const realDependencies: DirectCheckoutRetryDependencies = {
    getConfirmationIntent: getEmailMessageByTemplateAndMetadata,
};

function hasOrderConfirmationOutboxMetadata(metadata: unknown) {
    return (
        typeof metadata === 'object' &&
        metadata !== null &&
        !Array.isArray(metadata) &&
        'outboxKind' in metadata &&
        metadata.outboxKind === orderConfirmationOutboxKind
    );
}

/**
 * A paid cart is an idempotent direct-checkout success only after its durable
 * confirmation intent exists. A paid-but-not-enqueued state stays visible as
 * a retryable conflict instead of hiding a partial completion.
 */
export async function getPaidCartCheckoutRetryResponse(
    {
        accountId,
        cart,
    }: {
        accountId: string;
        cart: PaidCart;
    },
    dependencies: DirectCheckoutRetryDependencies = realDependencies,
): Promise<DirectCheckoutRetryResponse | null> {
    if (cart.accountId !== accountId || cart.status !== 'paid') {
        return null;
    }

    const intent = await dependencies.getConfirmationIntent({
        metadataKey: 'cartId',
        metadataValue: cart.id.toString(),
        templateName: orderConfirmationTemplateName,
    });
    if (intent && hasOrderConfirmationOutboxMetadata(intent.metadata)) {
        return { body: { success: true }, status: 200 };
    }

    return {
        body: {
            code: 'CHECKOUT_CONFIRMATION_MISSING',
            error: 'Narudžba je obrađena, ali potvrda nije zabilježena. Ako se stanje ne osvježi, javi se podršci.',
        },
        status: 409,
    };
}
