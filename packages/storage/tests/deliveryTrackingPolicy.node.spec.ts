import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryRunRoutePolyline,
    hasLegacyGoogleRouteArtifact,
    persistLegacyGoogleRoutePolyline,
} from '@gredice/storage';

test('marks future legacy Google artifacts without trusting old raw polylines', () => {
    const persisted = persistLegacyGoogleRoutePolyline('google-route');

    assert.equal(hasLegacyGoogleRouteArtifact(persisted), true);
    assert.equal(deliveryRunRoutePolyline(persisted), 'google-route');
    assert.equal(hasLegacyGoogleRouteArtifact('old-raw-route'), false);
    assert.equal(deliveryRunRoutePolyline('old-raw-route'), 'old-raw-route');
});

test('fails closed for empty legacy route artifacts', () => {
    assert.equal(persistLegacyGoogleRoutePolyline(undefined), null);
    assert.equal(persistLegacyGoogleRoutePolyline(null), null);
    assert.equal(persistLegacyGoogleRoutePolyline(''), null);
    assert.equal(hasLegacyGoogleRouteArtifact(null), false);
    assert.equal(deliveryRunRoutePolyline(null), null);
    const emptyMarked = persistLegacyGoogleRoutePolyline('route')?.replace(
        'route',
        '',
    );
    assert.equal(hasLegacyGoogleRouteArtifact(emptyMarked), false);
    assert.equal(deliveryRunRoutePolyline(emptyMarked), null);
});
