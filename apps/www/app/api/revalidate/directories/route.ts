import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

type PublicDirectoryEntityType =
    | 'block'
    | 'brand'
    | 'plant'
    | 'plantDisease'
    | 'plantPest'
    | 'plantSort'
    | 'operation'
    | 'seed';
type RevalidationPath = {
    path: string;
    type?: 'page' | 'layout';
};

const revalidationPathsByEntityType: Record<
    PublicDirectoryEntityType,
    RevalidationPath[]
> = {
    block: [{ path: '/blokovi' }, { path: '/blokovi/[alias]', type: 'page' }],
    brand: [
        { path: '/sjeme' },
        { path: '/sjeme/[slug]', type: 'page' },
        { path: '/sjeme/brendovi' },
        { path: '/sjeme/brend/[slug]', type: 'page' },
    ],
    plant: [
        { path: '/' },
        { path: '/biljke' },
        { path: '/biljke/[alias]', type: 'page' },
        { path: '/biljke/[alias]/sorte/[sortAlias]', type: 'page' },
        { path: '/blokovi' },
        { path: '/blokovi/biljke' },
        { path: '/blokovi/biljke/[alias]', type: 'page' },
        { path: '/radnje/[alias]', type: 'page' },
        { path: '/cjenik' },
        { path: '/sjeme/[slug]', type: 'page' },
    ],
    plantDisease: [
        { path: '/bolesti' },
        { path: '/bolesti/[alias]', type: 'page' },
        { path: '/biljke/[alias]', type: 'page' },
    ],
    plantPest: [
        { path: '/stetnici' },
        { path: '/stetnici/[alias]', type: 'page' },
        { path: '/biljke/[alias]', type: 'page' },
    ],
    plantSort: [
        { path: '/' },
        { path: '/biljke/[alias]', type: 'page' },
        { path: '/biljke/[alias]/sorte/[sortAlias]', type: 'page' },
        { path: '/blokovi/biljke/[alias]', type: 'page' },
        { path: '/sjeme/[slug]', type: 'page' },
    ],
    operation: [
        { path: '/radnje' },
        { path: '/radnje/[alias]', type: 'page' },
        { path: '/biljke/[alias]', type: 'page' },
        { path: '/sjetva' },
        { path: '/cjenik' },
    ],
    seed: [
        { path: '/sjeme' },
        { path: '/sjeme/[slug]', type: 'page' },
        { path: '/sjeme/brendovi' },
        { path: '/sjeme/brend/[slug]', type: 'page' },
    ],
};

function publicDirectoryEntityType(
    value: unknown,
): PublicDirectoryEntityType | null {
    switch (value) {
        case 'block':
        case 'brand':
        case 'plant':
        case 'plantDisease':
        case 'plantPest':
        case 'plantSort':
        case 'operation':
        case 'seed':
            return value;
        default:
            return null;
    }
}

function hasEntityTypes(value: unknown): value is { entityTypes: unknown } {
    return (
        typeof value === 'object' && value !== null && 'entityTypes' in value
    );
}

async function requestedEntityTypes(request: NextRequest) {
    if (request.method === 'GET') {
        return request.nextUrl.searchParams
            .getAll('entityType')
            .map(publicDirectoryEntityType)
            .filter((entityType) => entityType !== null);
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return [];
    }

    if (!hasEntityTypes(payload) || !Array.isArray(payload.entityTypes)) {
        return [];
    }

    return payload.entityTypes
        .map(publicDirectoryEntityType)
        .filter((entityType) => entityType !== null);
}

function revalidationSecret(request: NextRequest) {
    const authorization = request.headers.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
        return authorization.slice('Bearer '.length);
    }

    return (
        request.headers.get('x-revalidate-secret') ??
        request.nextUrl.searchParams.get('secret')
    );
}

function collectRevalidationPaths(entityTypes: PublicDirectoryEntityType[]) {
    const paths: RevalidationPath[] = [];
    const pathKeys = new Set<string>();

    for (const entityType of entityTypes) {
        for (const revalidationPath of revalidationPathsByEntityType[
            entityType
        ]) {
            const key = `${revalidationPath.type ?? 'path'}:${revalidationPath.path}`;
            if (!pathKeys.has(key)) {
                pathKeys.add(key);
                paths.push(revalidationPath);
            }
        }
    }

    return paths;
}

async function handleRevalidationRequest(request: NextRequest) {
    const expectedSecret = process.env.GREDICE_WWW_REVALIDATE_SECRET?.trim();
    if (!expectedSecret) {
        return NextResponse.json(
            { error: 'Revalidation secret is not configured.' },
            { status: 503 },
        );
    }

    if (revalidationSecret(request) !== expectedSecret) {
        return NextResponse.json(
            { error: 'Invalid credentials.' },
            { status: 401 },
        );
    }

    const entityTypes = Array.from(
        new Set(await requestedEntityTypes(request)),
    );
    if (entityTypes.length === 0) {
        return NextResponse.json(
            { error: 'At least one public directory entity type is required.' },
            { status: 400 },
        );
    }

    const paths = collectRevalidationPaths(entityTypes);
    for (const { path, type } of paths) {
        if (type) {
            revalidatePath(path, type);
        } else {
            revalidatePath(path);
        }
    }

    return NextResponse.json({
        revalidated: true,
        entityTypes,
        paths,
        now: Date.now(),
    });
}

export async function GET(request: NextRequest) {
    return handleRevalidationRequest(request);
}

export async function POST(request: NextRequest) {
    return handleRevalidationRequest(request);
}
