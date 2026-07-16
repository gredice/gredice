import { expect, test } from '@playwright/experimental-ct-react';
import { DeliveryZoneMap } from '../app/dostava/DeliveryZoneMap';
import '../app/globals.css';

const googleMapsStub = `
class TestMap {
  constructor(element) {
    this.element = element;
    element.dataset.googleMapReady = 'true';
  }
  fitBounds(bounds) {
    const count = Number(this.element.dataset.fitBoundsCalls || '0') + 1;
    this.element.dataset.fitBoundsCalls = String(count);
    this.element.dataset.fitBoundsPoints = String(bounds.points.length);
  }
}
class TestLatLngBounds {
  constructor() {
    this.points = [];
  }
  extend(point) { this.points.push(point); }
}
class TestPolygon {
  constructor({ map, paths, zIndex }) {
    if (zIndex === 1) {
      const polygonCount = Number(map.element.dataset.deliveryAreaPolygonCount || '0') + 1;
      const pointCount = Number(map.element.dataset.deliveryAreaPoints || '0') + paths.length;
      map.element.dataset.deliveryAreaPolygonCount = String(polygonCount);
      map.element.dataset.deliveryAreaPoints = String(pointCount);
    }
    if (zIndex === 2) {
      map.element.dataset.zagrebBoundaryPoints = String(paths.length);
    }
  }
  setMap() {}
}
class TestMarker {
  constructor({ map }) {
    map.element.dataset.hqMarkerReady = 'true';
  }
  setMap() {}
}
window.google.maps.importLibrary = async (name) => {
  if (name === 'maps') {
    return {
      Map: TestMap,
      Polygon: TestPolygon,
    };
  }
  if (name === 'marker') return { Marker: TestMarker };
  if (name === 'core') return { LatLngBounds: TestLatLngBounds };
  throw new Error('Unexpected library: ' + name);
};
window.google.maps.__ib__();
`;

test('renders the Zagreb boundary and Croatia-clipped 100 km road area', async ({
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

    await mount(<DeliveryZoneMap apiKey="browser-test-key" />);

    const map = page.getByRole('region', {
        name: 'Interaktivna karta zona dostave',
    });
    await expect(map).toHaveAttribute('data-google-map-ready', 'true');
    await expect(map).toHaveAttribute('data-delivery-area-polygon-count', '2');
    await expect(map).toHaveAttribute('data-delivery-area-points', '2382');
    await expect(map).toHaveAttribute('data-hq-marker-ready', 'true');
    await expect(map).toHaveAttribute(
        'data-zagreb-boundary-points',
        /^[2-9]\d{2}$/,
    );
    await expect(map).toHaveAttribute('data-fit-bounds-calls', '1');
    await expect(map).toHaveAttribute('data-fit-bounds-points', '2382');
    await expect(page.getByText('Grad Zagreb – besplatno')).toBeVisible();
    await expect(
        page.getByText('Do 100 km vožnje – uz nadoplatu, samo Hrvatska'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Centriraj' }).click();
    await expect(map).toHaveAttribute('data-fit-bounds-calls', '2');
});

test('shows the delivery rules when no browser key is configured', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryZoneMap apiKey="" />);

    await expect(page.getByRole('alert')).toContainText(
        'Interaktivna karta trenutačno nije dostupna',
    );
    await expect(page.getByRole('alert')).toContainText(
        'dostava uz nadoplatu unutar 100 km vožnje cestom',
    );
});
