import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGoogleMapsDirectionsUrl } from './googleMapsDirections';

test('builds a Google Maps directions URL for a delivery address', () => {
    const url = new URL(buildGoogleMapsDirectionsUrl('Ilica 42, Zagreb'));

    assert.equal(url.hostname, 'www.google.com');
    assert.equal(url.pathname, '/maps/dir/');
    assert.equal(url.search, '?api=1&destination=Ilica%2042%2C%20Zagreb');
});

test('encodes Croatian characters and reserved URL characters', () => {
    const url = new URL(
        buildGoogleMapsDirectionsUrl('Čićarijska ž 5, Zagreb / ulaz A&B? #ŠĐ'),
    );

    assert.equal(
        url.search,
        '?api=1&destination=%C4%8Ci%C4%87arijska%20%C5%BE%205%2C%20Zagreb%20%2F%20ulaz%20A%26B%3F%20%23%C5%A0%C4%90',
    );
    assert.equal(
        url.searchParams.get('destination'),
        'Čićarijska ž 5, Zagreb / ulaz A&B? #ŠĐ',
    );
});
