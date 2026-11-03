import type { Route } from 'next';
import type { PlantSeasonActivity } from './plantSeason';

export function plantArchivePath({
    activity = 'sijanje',
    month = null,
    search,
    view,
}: {
    activity?: PlantSeasonActivity;
    month?: number | null;
    search: string;
    view: 'kalendar' | 'popis';
}): Route {
    const params = new URLSearchParams();
    if (view === 'kalendar') {
        params.set('pregled', view);
    }
    if (search) {
        params.set('pretraga', search);
    }
    if (month) {
        params.set('mjesec', month.toString());
    }
    if (activity === 'berba') {
        params.set('aktivnost', activity);
    }

    const query = params.toString();
    return `/biljke${query ? `?${query}` : ''}` as Route;
}
