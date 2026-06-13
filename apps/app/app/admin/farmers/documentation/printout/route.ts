import { auth } from '../../../../../lib/auth/auth';
import {
    getFarmerDocumentationPackage,
    parseDocumentationSince,
} from '../farmerDocumentationData';
import {
    farmerDocumentationFilename,
    generateFarmerDocumentationPdf,
} from '../farmerDocumentationPdf';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    await auth(['admin']);

    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const since =
        scope === 'all'
            ? null
            : parseDocumentationSince(url.searchParams.get('since') ?? '');
    const documentationPackage = await getFarmerDocumentationPackage({
        since,
    });
    const pdf = generateFarmerDocumentationPdf(documentationPackage);

    return new Response(pdf, {
        headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="${farmerDocumentationFilename(
                documentationPackage,
            )}"`,
            'Content-Length': String(pdf.byteLength),
            'Content-Type': 'application/pdf',
        },
    });
}
