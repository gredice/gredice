import 'server-only';
import { generateQr } from '@gredice/fiscalization';
import type {
    SelectInvoice,
    SelectInvoiceItem,
    SelectReceipt,
} from '@gredice/storage';
import { deflateSync, inflateSync } from 'node:zlib';

type ReceiptForPdf = SelectReceipt & {
    invoice?: (SelectInvoice & { invoiceItems: SelectInvoiceItem[] | undefined | null }) | null;
};

type QrImage = {
    object: Buffer;
    width: number;
    height: number;
};

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const ACCENT_COLOR = '#2E6F40';
const TEXT_COLOR = '#1F2937';
const MUTED_COLOR = '#6B7280';
const LIGHT_BACKGROUND = '#F3F4F6';
const TABLE_BORDER = '#E5E7EB';
const SUMMARY_BACKGROUND = '#E6F4EA';

function escapePdfString(value: string) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function hexToRgb(color: string) {
    const normalized = color.replace('#', '');
    const int = Number.parseInt(normalized, 16);
    const r = ((int >> 16) & 255) / 255;
    const g = ((int >> 8) & 255) / 255;
    const b = (int & 255) / 255;
    return { r, g, b };
}

function formatCurrency(amount: string | number | null | undefined, currency = 'EUR') {
    if (amount === null || amount === undefined) {
        return '-';
    }

    const numeric = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
    if (Number.isNaN(numeric)) {
        return '-';
    }

    try {
        return new Intl.NumberFormat('hr-HR', {
            style: 'currency',
            currency: currency.toUpperCase(),
            minimumFractionDigits: 2,
        }).format(numeric);
    } catch (error) {
        console.warn('Failed to format currency', error);
        return `${numeric.toFixed(2)} ${currency.toUpperCase()}`;
    }
}

function formatQuantity(value: string | number | null | undefined) {
    if (value === null || value === undefined) {
        return '-';
    }
    const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (Number.isNaN(numeric)) {
        return '-';
    }
    return new Intl.NumberFormat('hr-HR', {
        minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(numeric);
}

function formatDate(value: Date | string | null | undefined) {
    if (!value) {
        return '-';
    }
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(date);
}

function resolveCustomerName(receipt: ReceiptForPdf) {
    return receipt.customerName || receipt.invoice?.billToName || 'Nepoznat kupac';
}

function resolveCustomerAddress(receipt: ReceiptForPdf) {
    if (receipt.customerAddress) {
        return receipt.customerAddress;
    }
    const parts = [
        receipt.invoice?.billToAddress,
        receipt.invoice?.billToZip && receipt.invoice?.billToCity
            ? `${receipt.invoice.billToZip} ${receipt.invoice.billToCity}`
            : receipt.invoice?.billToCity,
        receipt.invoice?.billToCountry,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : undefined;
}

function mapPaymentMethod(method: string | null | undefined) {
    switch (method) {
        case 'card':
            return 'Kartično plaćanje';
        case 'cash':
            return 'Gotovina';
        case 'bank_transfer':
            return 'Transakcijski račun';
        default:
            return method ?? 'Nepoznato';
    }
}

function wrapText(value: string, maxWidth: number, fontSize: number) {
    const approxCharWidth = fontSize * 0.5;
    const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / approxCharWidth));
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if ((current + (current ? ' ' : '') + word).length > maxCharsPerLine) {
            if (current) {
                lines.push(current);
            }
            current = word;
        } else {
            current = current ? `${current} ${word}` : word;
        }
    }
    if (current) {
        lines.push(current);
    }
    return lines;
}

function appendColor(commands: string[], color: string, type: 'fill' | 'stroke') {
    const { r, g, b } = hexToRgb(color);
    const command = `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${type === 'fill' ? 'rg' : 'RG'}`;
    commands.push(command);
}

function drawRect(commands: string[], xOffset: number, top: number, width: number, height: number, color?: string) {
    if (color) {
        appendColor(commands, color, 'fill');
    }
    const x = MARGIN + xOffset;
    const y = PAGE_HEIGHT - top - height;
    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    commands.push('f');
}

function drawLine(commands: string[], x1: number, y1: number, x2: number, y2: number, color: string) {
    appendColor(commands, color, 'stroke');
    const startX = MARGIN + x1;
    const startY = PAGE_HEIGHT - y1;
    const endX = MARGIN + x2;
    const endY = PAGE_HEIGHT - y2;
    commands.push(`${startX.toFixed(2)} ${startY.toFixed(2)} m`);
    commands.push(`${endX.toFixed(2)} ${endY.toFixed(2)} l`);
    commands.push('S');
}

function drawText(
    commands: string[],
    text: string,
    xOffset: number,
    baselineFromTop: number,
    font: 'F1' | 'F2',
    fontSize: number,
    color = TEXT_COLOR,
) {
    appendColor(commands, color, 'fill');
    const x = MARGIN + xOffset;
    const y = PAGE_HEIGHT - baselineFromTop;
    commands.push('BT');
    commands.push(`/${font} ${fontSize.toFixed(2)} Tf`);
    commands.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
    commands.push(`(${escapePdfString(text)}) Tj`);
    commands.push('ET');
}

function drawWrappedText(
    commands: string[],
    text: string,
    xOffset: number,
    top: number,
    font: 'F1' | 'F2',
    fontSize: number,
    maxWidth: number,
    color = TEXT_COLOR,
) {
    const lines = wrapText(text, maxWidth, fontSize);
    let currentTop = top;
    for (const line of lines) {
        drawText(commands, line, xOffset, currentTop, font, fontSize, color);
        currentTop += fontSize + 4;
    }
    return currentTop;
}

function paethPredictor(a: number, b: number, c: number) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) {
        return a;
    }
    if (pb <= pc) {
        return b;
    }
    return c;
}

function decodePng(data: Buffer) {
    const expectedSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!data.subarray(0, 8).equals(expectedSignature)) {
        throw new Error('Invalid PNG signature');
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks: Buffer[] = [];

    while (offset < data.length) {
        const length = data.readUInt32BE(offset);
        offset += 4;
        const type = data.subarray(offset, offset + 4).toString('ascii');
        offset += 4;
        const chunkData = data.subarray(offset, offset + length);
        offset += length;
        offset += 4; // Skip CRC

        if (type === 'IHDR') {
            width = chunkData.readUInt32BE(0);
            height = chunkData.readUInt32BE(4);
            bitDepth = chunkData.readUInt8(8);
            colorType = chunkData.readUInt8(9);
        } else if (type === 'IDAT') {
            idatChunks.push(chunkData);
        } else if (type === 'IEND') {
            break;
        }
    }

    const compressed = Buffer.concat(idatChunks);
    const decompressed = inflateSync(compressed);

    let channels: number;
    let colorSpace: 'DeviceGray' | 'DeviceRGB';
    if (colorType === 0) {
        channels = 1;
        colorSpace = 'DeviceGray';
    } else if (colorType === 2) {
        channels = 3;
        colorSpace = 'DeviceRGB';
    } else if (colorType === 3) {
        throw new Error('Indexed PNG is not supported for QR codes');
    } else if (colorType === 4) {
        channels = 2;
        colorSpace = 'DeviceGray';
    } else if (colorType === 6) {
        channels = 4;
        colorSpace = 'DeviceRGB';
    } else {
        throw new Error(`Unsupported PNG color type: ${colorType}`);
    }

    const bytesPerPixel = Math.ceil((bitDepth * channels) / 8);
    const stride = width * bytesPerPixel;
    const raw = Buffer.alloc(height * stride);
    let srcOffset = 0;
    let rawOffset = 0;
    let prevRow = Buffer.alloc(stride);

    for (let row = 0; row < height; row++) {
        const filterType = decompressed.readUInt8(srcOffset);
        srcOffset += 1;
        const recon = Buffer.alloc(stride);
        for (let i = 0; i < stride; i++) {
            const rawByte = decompressed[srcOffset + i];
            const left = i >= bytesPerPixel ? recon[i - bytesPerPixel] : 0;
            const up = prevRow[i];
            const upLeft = i >= bytesPerPixel ? prevRow[i - bytesPerPixel] : 0;
            switch (filterType) {
                case 0:
                    recon[i] = rawByte;
                    break;
                case 1:
                    recon[i] = (rawByte + left) & 0xff;
                    break;
                case 2:
                    recon[i] = (rawByte + up) & 0xff;
                    break;
                case 3:
                    recon[i] = (rawByte + Math.floor((left + up) / 2)) & 0xff;
                    break;
                case 4:
                    recon[i] = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
                    break;
                default:
                    throw new Error(`Unsupported PNG filter type: ${filterType}`);
            }
        }
        recon.copy(raw, rawOffset);
        prevRow = recon;
        srcOffset += stride;
        rawOffset += stride;
    }

    let pixelData: Buffer;
    if (channels === 4) {
        pixelData = Buffer.alloc(width * height * 3);
        for (let i = 0, j = 0; i < raw.length; i += 4, j += 3) {
            const alpha = raw[i + 3];
            pixelData[j] = alpha === 0 ? 255 : raw[i];
            pixelData[j + 1] = alpha === 0 ? 255 : raw[i + 1];
            pixelData[j + 2] = alpha === 0 ? 255 : raw[i + 2];
        }
        colorSpace = 'DeviceRGB';
    } else if (channels === 2) {
        pixelData = Buffer.alloc(width * height);
        for (let i = 0, j = 0; i < raw.length; i += 2, j++) {
            const alpha = raw[i + 1];
            pixelData[j] = alpha === 0 ? 255 : raw[i];
        }
        colorSpace = 'DeviceGray';
    } else {
        pixelData = raw;
    }

    return {
        width,
        height,
        data: pixelData,
        colorSpace,
    };
}

async function createQrImage(receipt: ReceiptForPdf): Promise<QrImage | undefined> {
    const dateSource = receipt.cisTimestamp || receipt.issuedAt || receipt.createdAt;
    const totalNumber = Number.parseFloat(receipt.totalAmount ?? '0');
    if (!dateSource || Number.isNaN(totalNumber) || totalNumber <= 0) {
        return undefined;
    }

    const date = dateSource instanceof Date ? dateSource : new Date(dateSource);
    let qrUrl: string | undefined;
    if (receipt.jir) {
        qrUrl = await generateQr({
            jir: receipt.jir,
            date,
            totalAmount: totalNumber,
        });
    } else if (receipt.zki) {
        qrUrl = await generateQr({
            zki: receipt.zki,
            date,
            totalAmount: totalNumber,
        });
    }

    if (!qrUrl) {
        return undefined;
    }

    const base64 = qrUrl.split(',')[1];
    if (!base64) {
        return undefined;
    }

    const pngBuffer = Buffer.from(base64, 'base64');
    const { width, height, data, colorSpace } = decodePng(pngBuffer);
    const compressed = deflateSync(data);

    const imageStreamParts = [
        Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /${colorSpace} /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
        ),
        compressed,
        Buffer.from('\nendstream\n'),
    ];

    return {
        object: Buffer.concat(imageStreamParts),
        width,
        height,
    };
}

function composePdf(objects: Buffer[]) {
    const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')];
    const xrefEntries = ['0000000000 65535 f \n'];
    let offset = parts[0].length;

    for (const [index, object] of objects.entries()) {
        const objectHeader = Buffer.from(`${index + 1} 0 obj\n`);
        const objectFooter = Buffer.from('endobj\n');
        xrefEntries.push(`${offset.toString().padStart(10, '0')} 00000 n \n`);
        parts.push(objectHeader, object, objectFooter);
        offset += objectHeader.length + object.length + objectFooter.length;
    }

    const xrefStart = offset;
    parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n${xrefEntries.join('')}trailer\n<< /Size ${
        objects.length + 1
    } /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));

    return Buffer.concat(parts);
}

export async function buildReceiptPdfBuffer(receipt: ReceiptForPdf) {
    const commands: string[] = [];
    let cursorTop = MARGIN;

    const headerHeight = 90;
    drawRect(commands, 0, cursorTop, CONTENT_WIDTH, headerHeight, LIGHT_BACKGROUND);
    drawText(commands, 'Gredice fiskalni račun', 20, cursorTop + 34, 'F2', 24, ACCENT_COLOR);
    drawText(
        commands,
        `Broj računa: ${receipt.receiptNumber}`,
        20,
        cursorTop + 58,
        'F1',
        12,
        MUTED_COLOR,
    );
    drawText(
        commands,
        `Datum izdavanja: ${formatDate(receipt.issuedAt)}`,
        20,
        cursorTop + 74,
        'F1',
        12,
        MUTED_COLOR,
    );
    cursorTop += headerHeight + 24;

    const columnGap = 24;
    const columnWidth = (CONTENT_WIDTH - columnGap) / 2;
    const leftValues = [
        receipt.businessName || 'Gredice',
        receipt.businessAddress,
        receipt.businessPin ? `OIB: ${receipt.businessPin}` : undefined,
    ].filter(Boolean) as string[];
    const rightValues = [
        resolveCustomerName(receipt),
        resolveCustomerAddress(receipt),
        receipt.customerPin ? `OIB: ${receipt.customerPin}` : undefined,
        receipt.invoice?.billToEmail,
    ].filter(Boolean) as string[];

    drawText(commands, 'Izdavatelj', 0, cursorTop + 12, 'F2', 12, ACCENT_COLOR);
    let leftTop = cursorTop + 28;
    for (const value of leftValues) {
        leftTop = drawWrappedText(commands, value, 0, leftTop, 'F1', 12, columnWidth, TEXT_COLOR);
    }

    drawText(commands, 'Kupac', columnWidth + columnGap, cursorTop + 12, 'F2', 12, ACCENT_COLOR);
    let rightTop = cursorTop + 28;
    for (const value of rightValues) {
        rightTop = drawWrappedText(
            commands,
            value,
            columnWidth + columnGap,
            rightTop,
            'F1',
            12,
            columnWidth,
            TEXT_COLOR,
        );
    }

    cursorTop = Math.max(leftTop, rightTop) + 16;

    drawText(commands, 'Detalji plaćanja', 0, cursorTop, 'F2', 14, ACCENT_COLOR);
    cursorTop += 20;
    cursorTop = drawWrappedText(
        commands,
        `Način plaćanja: ${mapPaymentMethod(receipt.paymentMethod)}`,
        0,
        cursorTop,
        'F1',
        12,
        CONTENT_WIDTH,
        TEXT_COLOR,
    );
    if (receipt.paymentReference) {
        cursorTop = drawWrappedText(
            commands,
            `Referenca plaćanja: ${receipt.paymentReference}`,
            0,
            cursorTop,
            'F1',
            12,
            CONTENT_WIDTH,
            TEXT_COLOR,
        );
    }
    cursorTop = drawWrappedText(
        commands,
        `Povezana ponuda: ${receipt.invoice?.invoiceNumber ?? `#${receipt.invoiceId}`}`,
        0,
        cursorTop,
        'F1',
        12,
        CONTENT_WIDTH,
        TEXT_COLOR,
    );
    cursorTop = drawWrappedText(
        commands,
        `Datum fiskalizacije: ${formatDate(receipt.cisTimestamp)}`,
        0,
        cursorTop,
        'F1',
        12,
        CONTENT_WIDTH,
        TEXT_COLOR,
    );
    cursorTop += 16;

    const items = receipt.invoice?.invoiceItems ?? [];
    if (items.length > 0) {
        drawText(commands, 'Stavke računa', 0, cursorTop, 'F2', 14, ACCENT_COLOR);
        cursorTop += 20;

        const columnWidths = [CONTENT_WIDTH * 0.45, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.2];
        drawRect(commands, 0, cursorTop - 6, CONTENT_WIDTH, 28, LIGHT_BACKGROUND);
        drawText(commands, 'Opis', 10, cursorTop + 12, 'F2', 12, MUTED_COLOR);
        drawText(
            commands,
            'Količina',
            columnWidths[0] + 10,
            cursorTop + 12,
            'F2',
            12,
            MUTED_COLOR,
        );
        drawText(
            commands,
            'Jed. cijena',
            columnWidths[0] + columnWidths[1] + 10,
            cursorTop + 12,
            'F2',
            12,
            MUTED_COLOR,
        );
        drawText(
            commands,
            'Ukupno',
            columnWidths[0] + columnWidths[1] + columnWidths[2] + 10,
            cursorTop + 12,
            'F2',
            12,
            MUTED_COLOR,
        );
        cursorTop += 28;

        for (const item of items) {
            drawLine(commands, 0, cursorTop + 4, CONTENT_WIDTH, cursorTop + 4, TABLE_BORDER);
            cursorTop = drawWrappedText(commands, item.description, 10, cursorTop + 12, 'F1', 12, columnWidths[0] - 20);
            drawText(
                commands,
                formatQuantity(item.quantity),
                columnWidths[0] + 10,
                cursorTop + 12,
                'F1',
                12,
                TEXT_COLOR,
            );
            drawText(
                commands,
                formatCurrency(item.unitPrice, receipt.currency),
                columnWidths[0] + columnWidths[1] + 10,
                cursorTop + 12,
                'F1',
                12,
                TEXT_COLOR,
            );
            drawText(
                commands,
                formatCurrency(item.totalPrice, receipt.currency),
                columnWidths[0] + columnWidths[1] + columnWidths[2] + 10,
                cursorTop + 12,
                'F1',
                12,
                TEXT_COLOR,
            );
            cursorTop += 24;
        }
        cursorTop += 12;
    }

    // Summary block
    drawText(commands, 'Sažetak', 0, cursorTop, 'F2', 14, ACCENT_COLOR);
    cursorTop += 20;
    drawText(commands, 'Međusuma', 0, cursorTop, 'F1', 12, TEXT_COLOR);
    drawText(
        commands,
        formatCurrency(receipt.subtotal, receipt.currency),
        CONTENT_WIDTH - 120,
        cursorTop,
        'F1',
        12,
        TEXT_COLOR,
    );
    cursorTop += 18;
    drawText(commands, 'Porez', 0, cursorTop, 'F1', 12, TEXT_COLOR);
    drawText(
        commands,
        formatCurrency(receipt.taxAmount, receipt.currency),
        CONTENT_WIDTH - 120,
        cursorTop,
        'F1',
        12,
        TEXT_COLOR,
    );
    cursorTop += 22;
    drawRect(commands, 0, cursorTop - 6, CONTENT_WIDTH, 30, SUMMARY_BACKGROUND);
    drawText(commands, 'Ukupno', 10, cursorTop + 16, 'F2', 14, ACCENT_COLOR);
    drawText(
        commands,
        formatCurrency(receipt.totalAmount, receipt.currency),
        CONTENT_WIDTH - 130,
        cursorTop + 16,
        'F2',
        14,
        ACCENT_COLOR,
    );
    cursorTop += 42;

    drawText(commands, 'Fiskalizacija', 0, cursorTop, 'F2', 14, ACCENT_COLOR);
    cursorTop += 20;
    cursorTop = drawWrappedText(
        commands,
        `JIR: ${receipt.jir ?? '-'}`,
        0,
        cursorTop,
        'F1',
        12,
        CONTENT_WIDTH * 0.6,
        TEXT_COLOR,
    );
    cursorTop = drawWrappedText(
        commands,
        `ZKI: ${receipt.zki ?? '-'}`,
        0,
        cursorTop,
        'F1',
        12,
        CONTENT_WIDTH * 0.6,
        TEXT_COLOR,
    );
    cursorTop = drawWrappedText(
        commands,
        `CIS referenca: ${receipt.cisReference ?? '-'}`,
        0,
        cursorTop,
        'F1',
        12,
        CONTENT_WIDTH * 0.6,
        TEXT_COLOR,
    );
    cursorTop = drawWrappedText(
        commands,
        `Status: ${receipt.cisStatus}`,
        0,
        cursorTop,
        'F1',
        12,
        CONTENT_WIDTH * 0.6,
        TEXT_COLOR,
    );
    if (receipt.cisErrorMessage) {
        cursorTop = drawWrappedText(
            commands,
            `CIS poruka: ${receipt.cisErrorMessage}`,
            0,
            cursorTop,
            'F1',
            12,
            CONTENT_WIDTH * 0.6,
            '#DC2626',
        );
    }

    const qrImage = await createQrImage(receipt);
    if (qrImage) {
        const qrSize = 140;
        const x = CONTENT_WIDTH - qrSize;
        const y = cursorTop - 20;
        const pdfX = MARGIN + x;
        const pdfY = PAGE_HEIGHT - y - qrSize;
        commands.push('q');
        commands.push(`${qrSize.toFixed(2)} 0 0 ${qrSize.toFixed(2)} ${pdfX.toFixed(2)} ${pdfY.toFixed(2)} cm`);
        commands.push('/Im1 Do');
        commands.push('Q');
        drawText(
            commands,
            'Skeniraj za potvrdu fiskalnog računa',
            x,
            cursorTop + qrSize,
            'F1',
            10,
            MUTED_COLOR,
        );
    }

    const contentBuffer = Buffer.from(commands.join('\n') + '\n', 'utf8');

    const hasQr = Boolean(qrImage);
    const objects: Buffer[] = [];
    const pageResources = hasQr
        ? `<< /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 6 0 R >> >>`
        : `<< /Font << /F1 4 0 R /F2 5 0 R >> >>`;
    const contentObjectId = hasQr ? 7 : 6;

    objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>\n'));
    objects.push(Buffer.from('<< /Type /Pages /Count 1 /Kids [3 0 R] >>\n'));
    objects.push(
        Buffer.from(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
                2,
            )}] /Resources ${pageResources} /Contents ${contentObjectId} 0 R >>\n`,
        ),
    );
    objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n'));
    objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\n'));
    if (qrImage) {
        objects.push(qrImage.object);
    }
    objects.push(
        Buffer.concat([
            Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`),
            contentBuffer,
            Buffer.from('endstream\n'),
        ]),
    );

    return composePdf(objects);
}
