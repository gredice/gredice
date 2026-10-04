import { OAuthCallbackPanel } from '../../../../components/auth/OAuthCallbackPanel';
import { safeDeliveryReturnTarget } from '../../../../lib/deliveryDeepLink';

type FacebookCallbackPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FacebookCallbackPage({
    searchParams,
}: FacebookCallbackPageProps) {
    const resolvedSearchParams = await searchParams;
    const returnTo = resolvedSearchParams.returnTo;
    return (
        <OAuthCallbackPanel
            provider="Facebook"
            returnTarget={safeDeliveryReturnTarget(
                typeof returnTo === 'string' ? returnTo : null,
            )}
            hasError={resolvedSearchParams.error !== undefined}
        />
    );
}
