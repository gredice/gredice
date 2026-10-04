import { getDeliveryRequestOwners } from '@gredice/storage';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth/auth';
import { authCookieSettings } from '../../../lib/auth/cookieSecurity';
import { accountCookieName } from '../../../lib/auth/sessionConfig';
import {
    deliveryDashboardKindForRole,
    getDeliveryDashboard,
} from '../../../lib/deliveryDashboard';
import {
    parseDeliveryDeepLink,
    resolveDeliveryDeepLinkAccount,
} from '../../../lib/deliveryDeepLink';

export const dynamic = 'force-dynamic';

const deliveryAccountCookieMaxAgeSeconds = 365 * 24 * 60 * 60;

type DeliveryDashboardAuthContext = {
    accountId: string;
    userId: string;
    user: {
        accountIds: string[];
        role: string;
    };
};

type DeliveryDashboardRouteDependencies = {
    authCookieSettings: typeof authCookieSettings;
    getDeliveryDashboard: typeof getDeliveryDashboard;
    getDeliveryRequestOwners: typeof getDeliveryRequestOwners;
};

const defaultDependencies: DeliveryDashboardRouteDependencies = {
    authCookieSettings,
    getDeliveryDashboard,
    getDeliveryRequestOwners,
};

function deliveryTargetFromRequest(request: Request) {
    const values = new URL(request.url).searchParams.getAll('delivery');
    return parseDeliveryDeepLink(
        values.length === 0
            ? undefined
            : values.length === 1
              ? values[0]
              : values,
    );
}

export async function deliveryDashboardResponse(
    request: Request,
    authContext: DeliveryDashboardAuthContext,
    dependencies: DeliveryDashboardRouteDependencies = defaultDependencies,
) {
    const target = deliveryTargetFromRequest(request);
    const canSelectCustomerAccount =
        deliveryDashboardKindForRole(authContext.user.role) === 'customer';
    const owner =
        canSelectCustomerAccount && target.kind === 'request'
            ? (
                  await dependencies.getDeliveryRequestOwners([
                      target.requestId,
                  ])
              ).find(({ requestId }) => requestId === target.requestId)
            : undefined;
    const accountResolution = resolveDeliveryDeepLinkAccount({
        authorizedAccountIds: authContext.user.accountIds,
        currentAccountId: authContext.accountId,
        ownerAccountId: owner?.accountId ?? null,
        target: canSelectCustomerAccount ? target : { kind: 'none' },
    });
    const dashboard = await dependencies.getDeliveryDashboard({
        accountId: accountResolution.accountId,
        userId: authContext.userId,
        role: authContext.user.role,
    });
    const response = NextResponse.json(dashboard, {
        headers: { 'Cache-Control': 'private, no-store' },
    });

    if (accountResolution.shouldSetAccountCookie) {
        const settings = await dependencies.authCookieSettings();
        response.cookies.set(accountCookieName, accountResolution.accountId, {
            domain: settings.domain,
            httpOnly: true,
            maxAge: deliveryAccountCookieMaxAgeSeconds,
            path: '/',
            sameSite: 'lax',
            secure: settings.secure,
        });
    }

    return response;
}

export async function GET(request: Request) {
    return await withAuth(
        ['user', 'farmer', 'driver', 'admin'],
        async (authContext) =>
            await deliveryDashboardResponse(request, authContext),
    );
}
