import type { Route } from 'next';

export function plantArchivePath({
    search,
    seedTimeOnly,
    view,
}: {
    search: string;
    seedTimeOnly: boolean;
    view: 'kalendar' | 'popis';
}): Route {
    const params = new URLSearchParams();
    if (view === 'kalendar') {
        params.set('pregled', view);
    }
    if (search) {
        params.set('pretraga', search);
    }
    if (seedTimeOnly) {
        params.set('vrijemeZaSijanje', '1');
    }

    const query = params.toString();
    return `/biljke${query ? `?${query}` : ''}` as Route;
}
