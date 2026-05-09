import { NextResponse } from 'next/server';
import { buildCacheControlValue } from '../../../lib/http/cacheControl';

export function GET() {
    const securityTxt = `Contact: mailto:security@gredice.com
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en, hr
Canonical: https://api.gredice.com/.well-known/security.txt
`;

    return new NextResponse(securityTxt, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': buildCacheControlValue({
                maxAgeSeconds: 7 * 24 * 60 * 60,
            }),
        },
    });
}
