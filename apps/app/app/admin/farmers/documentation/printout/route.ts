import { auth } from '../../../../../lib/auth/auth';
import {
    getFarmerDocumentationPackage,
    parseDocumentationPackageContent,
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
    const content = parseDocumentationPackageContent(
        url.searchParams.get('content'),
    );
    const since =
        scope === 'all'
            ? null
            : parseDocumentationSince(url.searchParams.get('since') ?? '');
    const documentationPackage = await getFarmerDocumentationPackage({
        since,
    });
    const pdf = await generateFarmerDocumentationPdf(documentationPackage, {
        content,
    });

    return new Response(pdf, {
        headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="${farmerDocumentationFilename(
                documentationPackage,
                content,
            )}"`,
            'Content-Length': String(pdf.byteLength),
            'Content-Type': 'application/pdf',
        },
    });
}
