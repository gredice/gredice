import { OAuthCallbackPanel } from '../../../../components/auth/OAuthCallbackPanel';
import { safeDeliveryReturnTarget } from '../../../../lib/deliveryDeepLink';

type GoogleCallbackPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GoogleCallbackPage({
    searchParams,
}: GoogleCallbackPageProps) {
    const resolvedSearchParams = await searchParams;
    const returnTo = resolvedSearchParams.returnTo;
    return (
        <OAuthCallbackPanel
            provider="Google"
            returnTarget={safeDeliveryReturnTarget(
                typeof returnTo === 'string' ? returnTo : null,
            )}
            hasError={resolvedSearchParams.error !== undefined}
        />
    );
}
