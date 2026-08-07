import assert from 'node:assert/strict';
import test from 'node:test';
import { navigateNotificationLink } from './notificationNavigation';

const currentOrigin = 'https://vrt.gredice.test';

function createHarness() {
    const assigned: string[] = [];
    const pushed: string[] = [];

    return {
        assigned,
        navigate(href: string) {
            navigateNotificationLink({
                assign: (url) => assigned.push(url),
                currentOrigin,
                href,
                push: (url) => pushed.push(url),
            });
        },
        pushed,
    };
}

test('uses router navigation for relative and absolute same-origin links', () => {
    const harness = createHarness();

    harness.navigate('/obavijesti?filter=neprocitane');
    harness.navigate(`${currentOrigin}/vrt/aktivnosti`);

    assert.deepEqual(harness.pushed, [
        '/obavijesti?filter=neprocitane',
        `${currentOrigin}/vrt/aktivnosti`,
    ]);
    assert.deepEqual(harness.assigned, []);
});

test('uses document navigation for the exact HTTPS delivery tracker origin', () => {
    const harness = createHarness();

    harness.navigate('https://dostava.gredice.com/?delivery=request-123');

    assert.deepEqual(harness.pushed, []);
    assert.deepEqual(harness.assigned, [
        'https://dostava.gredice.com/?delivery=request-123',
    ]);
});

test('uses document navigation for known external notification destinations', () => {
    const harness = createHarness();

    harness.navigate('https://www.gredice.com/radnje');
    harness.navigate(
        'https://www.gredice.com/radnje/zalijevanje-biljke#raisedBedId=101',
    );
    harness.navigate('https://form.typeform.com/to/X727vyBk');

    assert.deepEqual(harness.pushed, []);
    assert.deepEqual(harness.assigned, [
        'https://www.gredice.com/radnje',
        'https://www.gredice.com/radnje/zalijevanje-biljke#raisedBedId=101',
        'https://form.typeform.com/to/X727vyBk',
    ]);
});

test('ignores unsafe and untrusted external notification links', () => {
    const rejectedUrls = [
        'http://dostava.gredice.com/?delivery=request-123',
        'javascript:alert(1)',
        'https://driver:secret@dostava.gredice.com/?delivery=request-123',
        'https://dostava.gredice.com:443/?delivery=request-123',
        ' https://dostava.gredice.com:443/?delivery=request-123 ',
        'https://dostava.gredice.com:8443/?delivery=request-123',
        'https://sub.dostava.gredice.com/?delivery=request-123',
        'https://dostava.gredice.com.evil.test/?delivery=request-123',
        'http://www.gredice.com/radnje',
        'https://editor:secret@www.gredice.com/radnje',
        'https://www.gredice.com:443/radnje',
        'https://www.gredice.com:8443/radnje',
        'https://sub.www.gredice.com/radnje',
        'https://www.gredice.com.evil.test/radnje',
        'https://www.gredice.com/biljke',
        'http://form.typeform.com/to/X727vyBk',
        'https://respondent:secret@form.typeform.com/to/X727vyBk',
        'https://form.typeform.com:443/to/X727vyBk',
        'https://form.typeform.com:8443/to/X727vyBk',
        'https://sub.form.typeform.com/to/X727vyBk',
        'https://form.typeform.com.evil.test/to/X727vyBk',
        'https://form.typeform.com/to/another-form',
        'https://form.typeform.com/to/X727vyBk?source=notification',
        'https://example.com/phishing',
    ];

    for (const href of rejectedUrls) {
        const harness = createHarness();

        harness.navigate(href);

        assert.deepEqual(harness.pushed, [], href);
        assert.deepEqual(harness.assigned, [], href);
    }
});
