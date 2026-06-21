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
export const runtime = 'nodejs';

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
    const pdf = generateFarmerDocumentationPdf(documentationPackage, {
        content,
    });

    return new Response(arrayBufferToReadableStream(pdf), {
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

function arrayBufferToReadableStream(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    const chunkSize = 64 * 1024;

    return new ReadableStream<Uint8Array>({
        pull(controller) {
            if (offset >= bytes.byteLength) {
                controller.close();
                return;
            }

            const chunk = bytes.subarray(
                offset,
                Math.min(offset + chunkSize, bytes.byteLength),
            );
            offset += chunk.byteLength;
            controller.enqueue(chunk);
        },
    });
}
