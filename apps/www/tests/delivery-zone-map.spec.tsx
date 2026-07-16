import { expect, test } from '@playwright/experimental-ct-react';
import { DeliveryZoneMap } from '../app/dostava/DeliveryZoneMap';
import '../app/globals.css';

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
}
class TestCircle {
  constructor({ map, radius }) {
    this.map = map;
    map.element.dataset.circleRadius = String(radius);
  }
  getBounds() { return {}; }
  setMap() {}
}
class TestPolygon {
  constructor({ map, paths }) {
    map.element.dataset.zagrebBoundaryPoints = String(paths.length);
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
      Circle: TestCircle,
      Map: TestMap,
      Polygon: TestPolygon,
    };
  }
  if (name === 'marker') return { Marker: TestMarker };
  throw new Error('Unexpected library: ' + name);
};
window.google.maps.__ib__();
`;

test('renders the Zagreb boundary and 100 km delivery radius', async ({
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
    await expect(map).toHaveAttribute('data-circle-radius', '100000');
    await expect(map).toHaveAttribute('data-hq-marker-ready', 'true');
    await expect(map).toHaveAttribute(
        'data-zagreb-boundary-points',
        /^[2-9]\d{2}$/,
    );
    await expect(map).toHaveAttribute('data-fit-bounds-calls', '1');
    await expect(page.getByText('Grad Zagreb – besplatno')).toBeVisible();
    await expect(
        page.getByText('Do 100 km – uz nadoplatu, samo Hrvatska'),
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
        'dostava uz nadoplatu unutar 100 km',
    );
});
