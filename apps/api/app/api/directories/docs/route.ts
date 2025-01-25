import { openApiDocs } from '@gredice/apidocs/openApiDocs';

export async function GET() {
    return Response.json(await openApiDocs(), {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}