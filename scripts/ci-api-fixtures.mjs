import { createServer } from 'node:http';

// These routes are intentionally explicit. A new API interaction needs a
// fixture, rather than quietly forwarding to a deployed application.
export const ciDeliveryPage = {
    slug: 'dostava-povrca-zagreb',
    title: 'Dostava svježeg povrća u Zagrebu',
    content: [
        {
            component: 'MarkdownBlock',
            markdown:
                '# Dostava svježeg povrća u Zagrebu\n\n[Dostava](/dostava)\n\n[Kako funkcioniraju Gredice](/novosti/dostava-povrca-u-zagrebu-kako-funkcioniraju-gredice)\n\n[Povrtna košarica ili vlastita gredica](/novosti/povrtna-kosarica-ili-vlastita-gredica)\n\n[Koliko košta dostava](/novosti/koliko-kosta-dostava-povrca-u-zagrebu)',
        },
    ],
    contentKind: 'page',
    canonicalPath: '/dostava-povrca-zagreb',
    metaDescription: 'Lokalna testna stranica dostave povrća u Zagrebu.',
};

if (process.env.GREDICE_CI_NETWORK_ISOLATION !== '1') {
    throw new Error('The fixture API may only run in isolated CI.');
}
const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    let body;
    if (request.method !== 'GET') {
        response.writeHead(405).end();
        return;
    }
    switch (path) {
        case '/health':
            body = { ok: true };
            break;
        case '/api/data/weather/now':
            body = {
                cloudy: 0.1,
                foggy: 0,
                rainy: 0,
                snowy: 0,
                thundery: 0,
                windSpeed: 0,
                windDirection: 0,
                snowAccumulation: 0,
            };
            break;
        case '/api/data/statistics/plants':
            body = {
                totalPlants: 47,
                totalPlantSorts: 26,
                totalPlantedPlants: 0,
            };
            break;
        case '/api/outlet/offers':
            body = { items: [] };
            break;
        case '/api/gardens/public':
            body = { items: [] };
            break;
        case '/api/directories/pages/dostava-povrca-zagreb':
            body = ciDeliveryPage;
            break;
        case '/api/directories/pages':
            body = [ciDeliveryPage];
            break;
        case '/api/auth/current-claims':
            body = null;
            break;
        default:
            response.writeHead(404, { 'content-type': 'application/json' });
            response.end(
                JSON.stringify({
                    error: 'Add an explicit local CI API fixture.',
                    path,
                }),
            );
            return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
});
server.listen(45450, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close());
