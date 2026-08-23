import { expect, test } from '@playwright/experimental-ct-react';
import { DeliveryInteractiveMap } from '../components/DeliveryInteractiveMap';
import { DeliveryInteractiveMapSelectionStory } from './DeliveryInteractiveMapSelectionStory';
import '../app/globals.css';

declare global {
    interface Window {
        __deliveryMarkerClicks?: Record<string, () => void>;
    }
}

const googleMapsStub = `
class TestMap {
  constructor(element) {
    this.element = element;
    element.dataset.googleMapReady = 'true';
  }
  fitBounds() {
    const count = Number(this.element.dataset.fitBoundsCalls || '0') + 1;
    this.element.dataset.fitBoundsCalls = String(count);
  }
  setCenter() {
    const count = Number(this.element.dataset.setCenterCalls || '0') + 1;
    this.element.dataset.setCenterCalls = String(count);
  }
  setZoom(value) { this.element.dataset.zoom = String(value); }
}
class TestMarker {
  constructor({ map, icon, title }) {
    this.title = title;
    const count = Number(map.element.dataset.markerCount || '0') + 1;
    map.element.dataset.markerCount = String(count);
    if (icon && icon.scale === 13) {
      map.element.dataset.selectedMarkerTitle = title;
    }
  }
  addListener(name, handler) {
    if (name !== 'click') return;
    window.__deliveryMarkerClicks = window.__deliveryMarkerClicks || {};
    window.__deliveryMarkerClicks[this.title] = handler;
  }
  setMap() {}
}
class TestPolyline {
  constructor({ map }) {
    map.element.dataset.polylineReady = 'true';
  }
  setMap() {}
}
class TestLatLngBounds {
  extend() { return this; }
}
window.google.maps.importLibrary = async (name) => {
  if (name === 'maps') return { Map: TestMap, Polyline: TestPolyline };
  if (name === 'marker') return { Marker: TestMarker };
  if (name === 'core') {
    return { LatLngBounds: TestLatLngBounds, SymbolPath: { CIRCLE: 0 } };
  }
  throw new Error('Unexpected library: ' + name);
};
window.google.maps.__ib__();
`;

test('loads authorized map data into a live interactive map', async ({
    mount,
    page,
}) => {
    await page.route('https://maps.googleapis.com/maps/api/js?**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: googleMapsStub,
        }),
    );
    await page.route('**/api/map/run-interactive?**', (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get('format')).toBe('json');
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                driverLocation: { latitude: 45.801, longitude: 15.981 },
                pickupNodes: [
                    {
                        latitude: 45.79,
                        longitude: 15.97,
                        selectionId: 'pickup-node-1',
                    },
                ],
                stops: [
                    {
                        latitude: 45.81,
                        longitude: 16.01,
                        sequence: 2,
                        selectionId: '20',
                    },
                ],
                encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            }),
        });
    });

    await mount(
        <DeliveryInteractiveMap
            apiKey="browser-test-key"
            mapUrl="/api/map/run-interactive"
            version="2026-07-15T14:00:00.000Z"
            title="Interaktivna karta dostave"
        />,
    );

    const map = page.getByRole('region', {
        name: 'Interaktivna karta dostave',
    });
    await expect(map).toHaveAttribute('data-google-map-ready', 'true');
    await expect(map).toHaveAttribute('data-marker-count', '3');
    await expect(map).toHaveAttribute('data-polyline-ready', 'true');
    await expect(map).toHaveAttribute('data-fit-bounds-calls', '1');

    await page.getByRole('button', { name: 'Centriraj kartu' }).click();
    await expect(map).toHaveAttribute('data-fit-bounds-calls', '2');
});

test('synchronizes marker selection and highlights the selected route node', async ({
    mount,
    page,
}) => {
    await page.route('https://maps.googleapis.com/maps/api/js?**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: googleMapsStub,
        }),
    );
    await page.route('**/api/map/run-interactive?**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                driverLocation: null,
                pickupNodes: [
                    {
                        latitude: 45.79,
                        longitude: 15.97,
                        selectionId: 'pickup-node-1',
                    },
                ],
                stops: [
                    {
                        latitude: 45.81,
                        longitude: 16.01,
                        sequence: 2,
                        selectionId: '20',
                    },
                ],
                encodedPolyline: null,
            }),
        }),
    );

    await mount(<DeliveryInteractiveMapSelectionStory />);
    const map = page.getByRole('region', {
        name: 'Interaktivna karta dostave',
    });
    await expect(map).toHaveAttribute('data-google-map-ready', 'true');

    await page.evaluate(() =>
        window.__deliveryMarkerClicks?.['Dostavna stanica 2']?.(),
    );
    await expect(page.getByTestId('map-selection')).toHaveText('delivery:20');
    await expect(map).toHaveAttribute(
        'data-selected-marker-title',
        'Dostavna stanica 2',
    );
    await expect(map).toHaveAttribute('data-zoom', '15');

    await page.evaluate(() =>
        window.__deliveryMarkerClicks?.['Lokacija preuzimanja 1']?.(),
    );
    await expect(page.getByTestId('map-selection')).toHaveText(
        'pickup:pickup-node-1',
    );
    await expect(map).toHaveAttribute(
        'data-selected-marker-title',
        'Lokacija preuzimanja 1',
    );

    await page
        .getByRole('button', {
            name: 'Odaberi dovršenu stanicu bez markera',
        })
        .click();
    await expect(page.getByTestId('map-selection')).toHaveText(
        'delivery:completed-stop-without-marker',
    );
    await expect(map).toHaveAttribute('data-fit-bounds-calls', '2');
});
