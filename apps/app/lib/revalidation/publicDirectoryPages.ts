import 'server-only';

type PublicDirectoryEntityType =
    | 'block'
    | 'plant'
    | 'plantDisease'
    | 'plantPest'
    | 'plantSort'
    | 'operation';

const publicWwwRevalidationPath = '/api/revalidate/directories';

function publicDirectoryEntityType(
    entityTypeName: string | null | undefined,
): PublicDirectoryEntityType | null {
    switch (entityTypeName) {
        case 'block':
        case 'plant':
        case 'plantDisease':
        case 'plantPest':
        case 'plantSort':
        case 'operation':
            return entityTypeName;
        default:
            return null;
    }
}

function publicWwwBaseUrl() {
    const configuredBaseUrl = process.env.GREDICE_WWW_REVALIDATE_URL?.trim();
    if (configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/+$/, '');
    }

    const isDevelopment =
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'development' ||
        process.env.VERCEL_ENV === 'development' ||
        process.env.NODE_ENV === 'development';

    if (isDevelopment) {
        return 'https://www.gredice.test';
    }

    const isProduction =
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production';

    return isProduction ? 'https://www.gredice.com' : null;
}

export async function revalidatePublicDirectoryPagesForEntityTypes(
    entityTypeNames: Iterable<string | null | undefined>,
    reason: string,
) {
    const entityTypes = new Set<PublicDirectoryEntityType>();
    for (const entityTypeName of entityTypeNames) {
        const entityType = publicDirectoryEntityType(entityTypeName);
        if (entityType) {
            entityTypes.add(entityType);
        }
    }

    if (entityTypes.size === 0) {
        return;
    }

    const secret = process.env.GREDICE_WWW_REVALIDATE_SECRET?.trim();
    if (!secret) {
        if (
            process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ||
            process.env.VERCEL_ENV === 'production'
        ) {
            console.warn(
                'Skipping public directory page revalidation because GREDICE_WWW_REVALIDATE_SECRET is not configured.',
            );
        }
        return;
    }

    const baseUrl = publicWwwBaseUrl();
    if (!baseUrl) {
        console.warn(
            'Skipping public directory page revalidation because GREDICE_WWW_REVALIDATE_URL is not configured for this environment.',
        );
        return;
    }

    const url = new URL(publicWwwRevalidationPath, baseUrl);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-revalidate-secret': secret,
            },
            body: JSON.stringify({
                entityTypes: Array.from(entityTypes),
                reason,
            }),
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            console.error('Failed to revalidate public directory pages', {
                status: response.status,
                statusText: response.statusText,
                body: responseText,
            });
        }
    } catch (error) {
        console.error('Failed to request public directory page revalidation', {
            error,
        });
    }
}

export async function revalidatePublicDirectoryPagesForEntityType(
    entityTypeName: string | null | undefined,
    reason: string,
) {
    await revalidatePublicDirectoryPagesForEntityTypes(
        [entityTypeName],
        reason,
    );
}
