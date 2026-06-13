import { create as createQrCode } from 'qrcode';
import {
    documentationChangeLabel,
    type FarmerDocumentationOperation,
    type FarmerDocumentationPackage,
    formatDocumentationDateTime,
    getFarmerAppOrigin,
} from './farmerDocumentationData';

type PdfFontKey = 'F1' | 'F2';

type PdfColor = {
    r: number;
    g: number;
    b: number;
};

type HeaderData = {
    code: string;
    title: string;
    subtitle: string;
    qrUrl: string;
    version: string;
    generatedAt: Date;
};

type FlowContext = {
    page: PdfCanvas;
    pages: PdfCanvas[];
    header: HeaderData;
    y: number;
};

const colors = {
    brand: { r: 0.18, g: 0.44, b: 0.25 },
    text: { r: 0.09, g: 0.1, b: 0.12 },
    muted: { r: 0.42, g: 0.45, b: 0.5 },
    line: { r: 0.86, g: 0.88, b: 0.9 },
    softGreen: { r: 0.94, g: 0.97, b: 0.94 },
    softGray: { r: 0.97, g: 0.98, b: 0.96 },
    white: { r: 1, g: 1, b: 1 },
    black: { r: 0, g: 0, b: 0 },
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 36;
const headerHeight = 102;
const bottomY = 42;
const contentWidth = pageWidth - margin * 2;
const bodyFontSize = 9.4;
const bodyLineHeight = 13.2;
const smallFontSize = 7.8;
const titleFontSize = 17;

const croatianReplacements: Record<string, string> = {
    '\u010c': 'C',
    '\u010d': 'c',
    '\u0106': 'C',
    '\u0107': 'c',
    '\u0110': 'Dj',
    '\u0111': 'dj',
    '\u0160': 'S',
    '\u0161': 's',
    '\u017d': 'Z',
    '\u017e': 'z',
};

class PdfCanvas {
    private readonly operations: string[] = [];

    text({
        x,
        y,
        value,
        size,
        font = 'F1',
        color = colors.text,
    }: {
        x: number;
        y: number;
        value: string;
        size: number;
        font?: PdfFontKey;
        color?: PdfColor;
    }) {
        this.operations.push(
            [
                'q',
                `${formatColor(color)} rg`,
                `BT /${font} ${formatNumber(size)} Tf 1 0 0 1 ${formatNumber(
                    x,
                )} ${formatNumber(y)} Tm (${escapePdfText(value)}) Tj ET`,
                'Q',
            ].join(' '),
        );
    }

    line({
        x1,
        y1,
        x2,
        y2,
        color = colors.line,
        width = 0.6,
    }: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        color?: PdfColor;
        width?: number;
    }) {
        this.operations.push(
            [
                'q',
                `${formatColor(color)} RG`,
                `${formatNumber(width)} w`,
                `${formatNumber(x1)} ${formatNumber(y1)} m`,
                `${formatNumber(x2)} ${formatNumber(y2)} l S`,
                'Q',
            ].join(' '),
        );
    }

    fillRect({
        x,
        y,
        width,
        height,
        color,
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: PdfColor;
    }) {
        this.operations.push(
            [
                'q',
                `${formatColor(color)} rg`,
                `${formatNumber(x)} ${formatNumber(y)} ${formatNumber(
                    width,
                )} ${formatNumber(height)} re f`,
                'Q',
            ].join(' '),
        );
    }

    toString() {
        return this.operations.join('\n');
    }
}

export function generateFarmerDocumentationPdf(
    data: FarmerDocumentationPackage,
): ArrayBuffer {
    const farmOrigin = getFarmerAppOrigin();
    const version = farmerDocumentationVersion(data.generatedAt);
    const pages: PdfCanvas[] = [];

    drawOrganizationGuide({ data, farmOrigin, pages, version });

    for (const operation of data.includedOperations) {
        drawOperationManual({ farmOrigin, operation, pages, version, data });
    }

    return writePdf(pages.map((page) => page.toString()));
}

export function farmerDocumentationFilename(data: FarmerDocumentationPackage) {
    const datePart = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(data.generatedAt);
    const scopePart = data.since ? 'promjene' : 'sve-stranice';

    return `farmeri-dokumentacija-${scopePart}-${datePart}.pdf`;
}

export function farmerDocumentationVersion(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    })
        .formatToParts(date)
        .reduce<Record<string, string>>((result, part) => {
            result[part.type] = part.value;
            return result;
        }, {});

    return `DOK-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function drawOrganizationGuide({
    data,
    farmOrigin,
    pages,
    version,
}: {
    data: FarmerDocumentationPackage;
    farmOrigin: string;
    pages: PdfCanvas[];
    version: string;
}) {
    let context = startPage(pages, {
        code: 'ORG-GUIDE',
        title: 'Vodic za organizaciju',
        subtitle: data.since
            ? `Promjene od ${formatDocumentationDateTime(data.since)}`
            : 'Cijeli prirucnik',
        qrUrl: `${farmOrigin}/operations`,
        version,
        generatedAt: data.generatedAt,
    });
    const packageType = data.since
        ? 'Paket sadrzi organizacijski vodic i sve radnje promijenjene od zadnjeg ispisa.'
        : 'Paket sadrzi organizacijski vodic i sve trenutno objavljene radnje.';

    context = drawSection(context, 'Svrha paketa', [
        packageType,
        'Stranice radnji nisu numerirane. U registratoru ih drzi po rastucem kodu OP-0001, OP-0002, OP-0003 i tako dalje.',
        'Kod dodavanja novih radnji umetni ih na mjesto prema kodu, bez pomicanja ili prepisivanja brojeva stranica.',
    ]);

    context = drawActionList(
        context,
        'Umetni nove stranice',
        data.includedOperations.filter(
            (operation) => operation.changeType === 'insert',
        ),
    );
    context = drawActionList(
        context,
        'Zamijeni postojece stranice',
        data.includedOperations.filter(
            (operation) => operation.changeType === 'replace',
        ),
    );
    context = drawDiscardList(context, data.discardedOperations);
    context = drawSection(context, 'Kontrola nakon umetanja', [
        '1. Provjeri da je svaka nova ili zamijenjena stranica umetnuta pod istim OP kodom kao u ovom vodicu.',
        '2. Stare stranice iz odjeljka za zamjenu izdvoji i odbaci nakon sto nova verzija stoji u registratoru.',
        '3. Stranice iz odjeljka za uklanjanje izvadi iz registratora bez zamjenske stranice.',
        '4. QR kod na svakoj stranici vodi na farmer aplikaciju za aktualnu digitalnu verziju radnje.',
    ]);

    drawFooter(context.page);
}

function drawActionList(
    context: FlowContext,
    title: string,
    operations: FarmerDocumentationOperation[],
) {
    if (operations.length === 0) {
        return drawSection(context, title, ['Nema stranica u ovoj skupini.']);
    }

    return drawSection(
        context,
        title,
        operations.map(
            (operation) =>
                `${operation.code} - ${operation.label} (${operation.revisionActions.join(', ') || 'aktualna verzija'})`,
        ),
    );
}

function drawDiscardList(
    context: FlowContext,
    discardedOperations: FarmerDocumentationPackage['discardedOperations'],
) {
    if (discardedOperations.length === 0) {
        return drawSection(context, 'Ukloni bez zamjene', [
            'Nema stranica za uklanjanje.',
        ]);
    }

    return drawSection(
        context,
        'Ukloni bez zamjene',
        discardedOperations.map(
            (operation) =>
                `${operation.code} - ${operation.label} (${operation.revisionActions.join(', ')})`,
        ),
    );
}

function drawOperationManual({
    data,
    farmOrigin,
    operation,
    pages,
    version,
}: {
    data: FarmerDocumentationPackage;
    farmOrigin: string;
    operation: FarmerDocumentationOperation;
    pages: PdfCanvas[];
    version: string;
}) {
    const operationUrl = `${farmOrigin}/operations/${operation.id}`;
    let context = startPage(pages, {
        code: operation.code,
        title: operation.label,
        subtitle: data.since
            ? documentationChangeLabel(operation.changeType)
            : 'Cijeli prirucnik',
        qrUrl: operationUrl,
        version,
        generatedAt: data.generatedAt,
    });

    context = drawOperationSummary(context, operation);
    context = drawSection(
        context,
        'Opis',
        markdownToPlainLines(operation.description ?? 'Opis nije definiran.'),
    );
    context = drawSection(
        context,
        'Upute',
        markdownToPlainLines(
            operation.instructions ?? 'Upute nisu definirane.',
        ),
    );

    if (operation.attributes.length > 0) {
        context = drawSection(
            context,
            'Podaci radnje',
            operation.attributes.map(
                (attribute) => `${attribute.label}: ${attribute.value}`,
            ),
        );
    }

    drawFooter(context.page);
}

function drawOperationSummary(
    context: FlowContext,
    operation: FarmerDocumentationOperation,
) {
    const rows = [
        ['Kod', operation.code],
        ['Trajanje', operation.durationLabel],
        ['Dokaz fotografijom', operation.photoProofLabel],
        [
            'Promjena',
            operation.changedAt
                ? formatDocumentationDateTime(operation.changedAt)
                : 'Cijeli prirucnik',
        ],
    ];
    const boxHeight = rows.length * 21 + 18;
    context = ensureSpace(context, boxHeight);
    context.page.fillRect({
        x: margin,
        y: context.y - boxHeight,
        width: contentWidth,
        height: boxHeight,
        color: colors.softGray,
    });

    let y = context.y - 25;
    for (const [label, value] of rows) {
        context.page.text({
            x: margin + 12,
            y,
            value: label.toUpperCase(),
            size: 6.9,
            font: 'F2',
            color: colors.muted,
        });
        context.page.text({
            x: margin + 142,
            y,
            value,
            size: 9,
            font: 'F2',
            color: colors.text,
        });
        y -= 21;
    }

    context.y -= boxHeight + 16;
    return context;
}

function startPage(pages: PdfCanvas[], header: HeaderData): FlowContext {
    const page = new PdfCanvas();
    pages.push(page);
    page.fillRect({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: colors.white,
    });
    drawHeader(page, header);

    return {
        page,
        pages,
        header,
        y: pageHeight - margin - headerHeight,
    };
}

function ensureSpace(context: FlowContext, height: number): FlowContext {
    if (context.y - height >= bottomY) {
        return context;
    }

    drawFooter(context.page);
    return startPage(context.pages, {
        ...context.header,
        subtitle: `${context.header.subtitle} - nastavak`,
    });
}

function drawSection(
    initialContext: FlowContext,
    title: string,
    rawLines: string[],
) {
    let context = ensureSpace(initialContext, 34);
    context.page.text({
        x: margin,
        y: context.y,
        value: title.toUpperCase(),
        size: 8,
        font: 'F2',
        color: colors.brand,
    });
    context.page.line({
        x1: margin,
        y1: context.y - 7,
        x2: pageWidth - margin,
        y2: context.y - 7,
        color: colors.line,
    });
    context.y -= 24;

    for (const rawLine of rawLines) {
        const line = rawLine.trim();
        if (!line) {
            context.y -= 6;
            continue;
        }

        const wrappedLines = wrapText(line, contentWidth, bodyFontSize);
        for (const wrappedLine of wrappedLines) {
            context = ensureSpace(context, bodyLineHeight);
            context.page.text({
                x: margin,
                y: context.y,
                value: wrappedLine,
                size: bodyFontSize,
                color: colors.text,
            });
            context.y -= bodyLineHeight;
        }
    }

    context.y -= 12;
    return context;
}

function drawHeader(page: PdfCanvas, header: HeaderData) {
    drawLogo(page, margin, pageHeight - margin - 28);
    const headerTextWidth = contentWidth - 86;

    page.text({
        x: margin,
        y: pageHeight - margin - 54,
        value: header.code,
        size: 10,
        font: 'F2',
        color: colors.brand,
    });
    page.text({
        x: margin,
        y: pageHeight - margin - 76,
        value: fitSingleLine(header.title, headerTextWidth, titleFontSize),
        size: titleFontSize,
        font: 'F2',
        color: colors.text,
    });
    page.text({
        x: margin,
        y: pageHeight - margin - 94,
        value: fitSingleLine(header.subtitle, headerTextWidth, 9),
        size: 9,
        color: colors.muted,
    });

    const metaX = pageWidth - margin - 190;
    page.text({
        x: metaX,
        y: pageHeight - margin - 16,
        value: `Verzija ${header.version}`,
        size: smallFontSize,
        font: 'F2',
        color: colors.text,
    });
    page.text({
        x: metaX,
        y: pageHeight - margin - 31,
        value: `Datum ${formatDocumentationDateTime(header.generatedAt)}`,
        size: smallFontSize,
        color: colors.muted,
    });

    drawQrCode(
        page,
        header.qrUrl,
        pageWidth - margin - 60,
        pageHeight - 98,
        58,
    );
    page.line({
        x1: margin,
        y1: pageHeight - margin - headerHeight + 18,
        x2: pageWidth - margin,
        y2: pageHeight - margin - headerHeight + 18,
        color: colors.line,
    });
}

function drawLogo(page: PdfCanvas, x: number, y: number) {
    page.fillRect({ x, y: y + 15, width: 30, height: 2, color: colors.brand });
    page.fillRect({ x, y: y + 10, width: 30, height: 2, color: colors.brand });
    page.fillRect({ x, y: y + 5, width: 30, height: 2, color: colors.brand });
    page.fillRect({
        x: x + 7,
        y: y + 13,
        width: 2,
        height: 14,
        color: colors.brand,
    });
    page.fillRect({
        x: x + 21,
        y: y + 13,
        width: 2,
        height: 14,
        color: colors.brand,
    });
    page.text({
        x: x + 42,
        y: y + 8,
        value: 'Gredice',
        size: 13,
        font: 'F2',
        color: colors.brand,
    });
}

function drawQrCode(
    page: PdfCanvas,
    payload: string,
    x: number,
    y: number,
    size: number,
) {
    const qrCode = createQrCode(payload, { errorCorrectionLevel: 'M' });
    const moduleCount = qrCode.modules.size;
    const quietModules = 4;
    const cellSize = size / (moduleCount + quietModules * 2);
    const offset = quietModules * cellSize;

    page.fillRect({ x, y, width: size, height: size, color: colors.white });
    for (let row = 0; row < moduleCount; row += 1) {
        for (let column = 0; column < moduleCount; column += 1) {
            if (!qrCode.modules.data[row * moduleCount + column]) {
                continue;
            }
            page.fillRect({
                x: x + offset + column * cellSize,
                y: y + size - offset - (row + 1) * cellSize,
                width: cellSize,
                height: cellSize,
                color: colors.black,
            });
        }
    }
}

function drawFooter(page: PdfCanvas) {
    page.line({
        x1: margin,
        y1: 30,
        x2: pageWidth - margin,
        y2: 30,
        color: colors.line,
    });
    page.text({
        x: margin,
        y: 15,
        value: 'Gredice - farmerska tiskana dokumentacija',
        size: 7.4,
        color: colors.muted,
    });
}

function markdownToPlainLines(value: string) {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
        .split('\n')
        .map((line) =>
            line
                .replace(/^#{1,6}\s+/, '')
                .replace(/^[-*]\s+/, '- ')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .trim(),
        );
}

function wrapText(value: string, maxWidth: number, fontSize: number) {
    const text = sanitizePdfText(value).trim();
    if (!text) {
        return [];
    }

    const lines: string[] = [];
    let currentLine = '';

    for (const word of text.split(/\s+/)) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (measureText(nextLine, fontSize) <= maxWidth) {
            currentLine = nextLine;
            continue;
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        if (measureText(word, fontSize) <= maxWidth) {
            currentLine = word;
            continue;
        }

        const wordParts = splitLongWord(word, maxWidth, fontSize);
        lines.push(...wordParts.slice(0, -1));
        currentLine = wordParts.at(-1) ?? '';
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

function splitLongWord(word: string, maxWidth: number, fontSize: number) {
    const parts: string[] = [];
    let currentPart = '';

    for (const character of word) {
        const nextPart = `${currentPart}${character}`;
        if (measureText(nextPart, fontSize) <= maxWidth) {
            currentPart = nextPart;
            continue;
        }

        if (currentPart) {
            parts.push(currentPart);
        }
        currentPart = character;
    }

    if (currentPart) {
        parts.push(currentPart);
    }

    return parts.length > 0 ? parts : [''];
}

function measureText(value: string, fontSize: number) {
    return value.length * fontSize * 0.52;
}

function fitSingleLine(value: string, maxWidth: number, fontSize: number) {
    const text = sanitizePdfText(value).trim();
    if (measureText(text, fontSize) <= maxWidth) {
        return text;
    }

    let truncated = text;
    while (
        truncated.length > 0 &&
        measureText(`${truncated}...`, fontSize) > maxWidth
    ) {
        truncated = truncated.slice(0, -1).trimEnd();
    }

    return truncated ? `${truncated}...` : '...';
}

function escapePdfText(value: string) {
    return sanitizePdfText(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function sanitizePdfText(value: string) {
    return value
        .replace(
            /[\u010c\u010d\u0106\u0107\u0110\u0111\u0160\u0161\u017d\u017e]/g,
            (character) => croatianReplacements[character] ?? character,
        )
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[–—]/g, '-')
        .replace(/→/g, '->')
        .replace(/[^\x20-\x7e]/g, '?');
}

function formatNumber(value: number) {
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatColor(color: PdfColor) {
    return [color.r, color.g, color.b].map(formatNumber).join(' ');
}

function writePdf(pageContentStreams: string[]) {
    const objects: string[] = [];
    const fontId = 3;
    const boldFontId = 4;
    const firstPageObjectId = 5;
    const kids = pageContentStreams
        .map((_, index) => `${firstPageObjectId + index * 2} 0 R`)
        .join(' ');

    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(
        `<< /Type /Pages /Kids [${kids}] /Count ${pageContentStreams.length} >>`,
    );
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    pageContentStreams.forEach((content, index) => {
        const pageObjectId = firstPageObjectId + index * 2;
        const contentObjectId = pageObjectId + 1;
        objects.push(
            [
                '<< /Type /Page',
                '/Parent 2 0 R',
                `/MediaBox [0 0 ${formatNumber(pageWidth)} ${formatNumber(pageHeight)}]`,
                `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >>`,
                `/Contents ${contentObjectId} 0 R`,
                '>>',
            ].join(' '),
        );
        objects.push(
            `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        );
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
        pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

    const bytes = new TextEncoder().encode(pdf);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);

    return buffer;
}
