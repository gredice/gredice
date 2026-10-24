import assert from 'node:assert/strict';
import test from 'node:test';
import { build, parse } from 'plist';

test('Electron property lists round-trip with xmldom 0.9', () => {
    const info = {
        CFBundleDisplayName: 'Gredice vrt',
        CFBundleIdentifier: 'com.gredice.garden',
        CFBundleVersion: '1.0.0',
        NSHighResolutionCapable: true,
        CFBundleURLTypes: [
            {
                CFBundleURLSchemes: ['gredice'],
                CFBundleURLName: 'Vrt & povrće',
            },
        ],
    };
    assert.deepEqual(parse(build(info)), info);
    assert.deepEqual(
        parse(build({ 'com.apple.security.app-sandbox': false })),
        { 'com.apple.security.app-sandbox': false },
    );
});
