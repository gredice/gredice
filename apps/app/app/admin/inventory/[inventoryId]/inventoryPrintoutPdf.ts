type InventoryPrintoutSummary = {
    totalItems: number;
    totalQuantity: number;
    emptyItems: number;
    lowItems: number;
    normalItems: number;
};

export type InventoryPrintoutPdfItem = {
    label: string;
    details: string[];
    quantity: number;
    currentStatus: string;
};

export type InventoryPrintoutPdfData = {
    inventoryLabel: string;
    printedAt: Date;
    summary: InventoryPrintoutSummary;
    items: InventoryPrintoutPdfItem[];
};

type PdfFontKey = 'F1' | 'F2';

type PdfColor = {
    r: number;
    g: number;
    b: number;
};

const colors = {
    brand: { r: 0.18, g: 0.44, b: 0.25 },
    text: { r: 0.09, g: 0.1, b: 0.12 },
    muted: { r: 0.42, g: 0.45, b: 0.5 },
    lightText: { r: 0.3, g: 0.34, b: 0.38 },
    line: { r: 0.86, g: 0.88, b: 0.9 },
    softLine: { r: 0.93, g: 0.94, b: 0.95 },
    softGreen: { r: 0.94, g: 0.97, b: 0.94 },
    softGray: { r: 0.98, g: 0.98, b: 0.97 },
    white: { r: 1, g: 1, b: 1 },
};

const pageWidth = 841.89;
const pageHeight = 595.28;
const margin = 36;
const footerY = 18;
const footerLineY = 34;
const bottomContentY = footerLineY + 16;
const tableWidth = pageWidth - margin * 2;
const tableHeaderHeight = 24;
const rowPaddingY = 8;
const labelFontSize = 9.4;
const detailFontSize = 7.4;
const bodyFontSize = 9;
const labelLineHeight = 11.2;
const detailLineHeight = 9;
const bodyLineHeight = 11;

const columns = [
    { key: 'number', label: '#', width: 34 },
    { key: 'item', label: 'Stavka i detalji', width: 370 },
    { key: 'quantity', label: 'Trenutno', width: 90 },
    { key: 'currentStatus', label: 'Status', width: 128 },
    { key: 'newStatus', label: 'Novo stanje', width: 148 },
] as const;

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

type TableColumnKey = (typeof columns)[number]['key'];

type RowLayout = {
    labelLines: string[];
    detailLines: string[];
    statusLines: string[];
    height: number;
};

export function generateInventoryPrintoutPdf(
    data: InventoryPrintoutPdfData,
): ArrayBuffer {
    const pages: PdfCanvas[] = [];
    let page = new PdfCanvas();
    let y = 0;

    function startPage() {
        page = new PdfCanvas();
        pages.push(page);
        y =
            pages.length === 1
                ? drawFirstPageHeader(page, data)
                : drawContinuationHeader(page, data);
        drawTableHeader(page, y);
        y -= tableHeaderHeight;
    }

    startPage();

    if (data.items.length === 0) {
        drawEmptyItemsRow(page, y);
    } else {
        data.items.forEach((item, index) => {
            const row = buildRowLayout(item);
            if (y - row.height < bottomContentY) {
                startPage();
            }
            drawTableRow(page, item, row, index + 1, y, index);
            y -= row.height;
        });
    }

    pages.forEach((currentPage, index) => {
        drawFooter(currentPage, index + 1, pages.length);
    });

    return writePdf(pages.map((currentPage) => currentPage.toString()));
}

export function inventoryPrintoutFilename(label: string, printedAt: Date) {
    const datePart = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(printedAt);
    const labelPart = sanitizePdfText(label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64);

    return `${labelPart || 'inventar'}-inventura-${datePart}.pdf`;
}

function drawFirstPageHeader(page: PdfCanvas, data: InventoryPrintoutPdfData) {
    drawLogo(page, margin, pageHeight - margin - 26);

    page.text({
        x: margin,
        y: pageHeight - margin - 58,
        value: 'INVENTURNI LIST',
        size: 17,
        font: 'F2',
    });
    page.text({
        x: margin,
        y: pageHeight - margin - 76,
        value: data.inventoryLabel,
        size: 11,
        font: 'F2',
        color: colors.lightText,
    });

    const metaX = pageWidth - margin - 322;
    drawMetaLabelValue(
        page,
        metaX,
        pageHeight - margin - 12,
        'Datum ispisa',
        formatDateTime(data.printedAt),
    );
    drawMetaLabelValue(
        page,
        metaX,
        pageHeight - margin - 34,
        'Inventura obavljena',
        '____________________',
    );
    drawMetaLabelValue(
        page,
        metaX,
        pageHeight - margin - 56,
        'Stavke / kolicina',
        `${data.summary.totalItems} / ${data.summary.totalQuantity}`,
    );
    drawMetaLabelValue(
        page,
        metaX,
        pageHeight - margin - 78,
        'Prazno / nisko / uredno',
        `${data.summary.emptyItems} / ${data.summary.lowItems} / ${data.summary.normalItems}`,
    );

    page.line({
        x1: margin,
        y1: pageHeight - margin - 98,
        x2: pageWidth - margin,
        y2: pageHeight - margin - 98,
        color: colors.line,
    });

    return pageHeight - margin - 118;
}

function drawContinuationHeader(
    page: PdfCanvas,
    data: InventoryPrintoutPdfData,
) {
    drawLogo(page, margin, pageHeight - margin - 23, 0.82);
    page.text({
        x: margin + 132,
        y: pageHeight - margin - 17,
        value: `Inventurni list - ${data.inventoryLabel}`,
        size: 11,
        font: 'F2',
        color: colors.lightText,
    });
    page.line({
        x1: margin,
        y1: pageHeight - margin - 36,
        x2: pageWidth - margin,
        y2: pageHeight - margin - 36,
        color: colors.line,
    });

    return pageHeight - margin - 56;
}

function drawLogo(page: PdfCanvas, x: number, y: number, scale = 1) {
    const markSize = 25 * scale;
    const barX = x + 5 * scale;
    const barWidth = 15 * scale;
    const barHeight = 1.4 * scale;

    page.fillRect({
        x,
        y,
        width: markSize,
        height: markSize,
        color: colors.brand,
    });

    for (let index = 0; index < 3; index += 1) {
        page.fillRect({
            x: barX,
            y: y + (8 + index * 5) * scale,
            width: barWidth,
            height: barHeight,
            color: colors.white,
        });
    }

    page.text({
        x: x + 35 * scale,
        y: y + 8.2 * scale,
        value: 'GREDICE',
        size: 12 * scale,
        font: 'F2',
        color: colors.brand,
    });
}

function drawMetaLabelValue(
    page: PdfCanvas,
    x: number,
    y: number,
    label: string,
    value: string,
) {
    page.text({
        x,
        y,
        value: label.toUpperCase(),
        size: 6.7,
        font: 'F2',
        color: colors.muted,
    });
    page.text({
        x: x + 118,
        y,
        value,
        size: 9,
        font: 'F2',
        color: colors.text,
    });
}

function drawTableHeader(page: PdfCanvas, topY: number) {
    page.fillRect({
        x: margin,
        y: topY - tableHeaderHeight,
        width: tableWidth,
        height: tableHeaderHeight,
        color: colors.softGreen,
    });
    page.line({
        x1: margin,
        y1: topY,
        x2: pageWidth - margin,
        y2: topY,
        color: colors.line,
    });
    page.line({
        x1: margin,
        y1: topY - tableHeaderHeight,
        x2: pageWidth - margin,
        y2: topY - tableHeaderHeight,
        color: colors.line,
    });

    let x = margin;
    for (const column of columns) {
        page.text({
            x: x + 6,
            y: topY - 15,
            value: column.label.toUpperCase(),
            size: 7.1,
            font: 'F2',
            color: colors.brand,
        });
        x += column.width;
    }
}

function drawEmptyItemsRow(page: PdfCanvas, topY: number) {
    const height = 34;
    page.text({
        x: margin + 6,
        y: topY - 21,
        value: 'Nema stavki u zalihi.',
        size: bodyFontSize,
        color: colors.muted,
    });
    page.line({
        x1: margin,
        y1: topY - height,
        x2: pageWidth - margin,
        y2: topY - height,
        color: colors.softLine,
    });
}

function buildRowLayout(item: InventoryPrintoutPdfItem): RowLayout {
    const itemWidth = columnWidth('item') - 12;
    const statusWidth = columnWidth('currentStatus') - 12;
    const labelLines = wrapText(item.label, itemWidth, labelFontSize);
    const detailLines = wrapText(
        item.details.filter(Boolean).join('  |  '),
        itemWidth,
        detailFontSize,
    ).slice(0, 2);
    const statusLines = wrapText(item.currentStatus, statusWidth, bodyFontSize);
    const itemHeight =
        rowPaddingY * 2 +
        labelLines.length * labelLineHeight +
        detailLines.length * detailLineHeight;
    const statusHeight = rowPaddingY * 2 + statusLines.length * bodyLineHeight;
    const height = Math.max(38, itemHeight, statusHeight);

    return {
        labelLines,
        detailLines,
        statusLines,
        height,
    };
}

function drawTableRow(
    page: PdfCanvas,
    item: InventoryPrintoutPdfItem,
    row: RowLayout,
    number: number,
    topY: number,
    index: number,
) {
    if (index % 2 === 1) {
        page.fillRect({
            x: margin,
            y: topY - row.height,
            width: tableWidth,
            height: row.height,
            color: colors.softGray,
        });
    }

    const rowTop = topY - rowPaddingY - labelFontSize;
    const numberX = columnX('number') + 6;
    const itemX = columnX('item') + 6;
    const quantityX = columnX('quantity') + 6;
    const statusX = columnX('currentStatus') + 6;
    const newStatusX = columnX('newStatus') + 6;

    page.text({
        x: numberX,
        y: rowTop,
        value: String(number),
        size: 8.5,
        font: 'F2',
        color: colors.muted,
    });

    row.labelLines.forEach((line, lineIndex) => {
        page.text({
            x: itemX,
            y: rowTop - lineIndex * labelLineHeight,
            value: line,
            size: labelFontSize,
            font: lineIndex === 0 ? 'F2' : 'F1',
            color: colors.text,
        });
    });

    const detailsStartY = rowTop - row.labelLines.length * labelLineHeight - 1;
    row.detailLines.forEach((line, lineIndex) => {
        page.text({
            x: itemX,
            y: detailsStartY - lineIndex * detailLineHeight,
            value: line,
            size: detailFontSize,
            color: colors.muted,
        });
    });

    page.text({
        x: quantityX,
        y: rowTop,
        value: String(item.quantity),
        size: bodyFontSize,
        font: 'F2',
        color: colors.text,
    });

    row.statusLines.forEach((line, lineIndex) => {
        page.text({
            x: statusX,
            y: rowTop - lineIndex * bodyLineHeight,
            value: line,
            size: bodyFontSize,
            color: colors.lightText,
        });
    });

    page.line({
        x1: newStatusX,
        y1: topY - row.height + 13,
        x2: pageWidth - margin - 8,
        y2: topY - row.height + 13,
        color: colors.line,
        width: 0.7,
    });
    page.line({
        x1: margin,
        y1: topY - row.height,
        x2: pageWidth - margin,
        y2: topY - row.height,
        color: colors.softLine,
        width: 0.5,
    });
}

function drawFooter(page: PdfCanvas, pageNumber: number, totalPages: number) {
    page.line({
        x1: margin,
        y1: footerLineY,
        x2: pageWidth - margin,
        y2: footerLineY,
        color: colors.softLine,
    });
    page.text({
        x: margin,
        y: footerY,
        value: 'Gredice - inventurni list',
        size: 7.2,
        color: colors.muted,
    });
    page.text({
        x: pageWidth - margin - 72,
        y: footerY,
        value: `Stranica ${pageNumber} / ${totalPages}`,
        size: 7.2,
        color: colors.muted,
    });
}

function columnX(key: TableColumnKey) {
    let x = margin;
    for (const column of columns) {
        if (column.key === key) {
            return x;
        }
        x += column.width;
    }

    return x;
}

function columnWidth(key: TableColumnKey) {
    return columns.find((column) => column.key === key)?.width ?? 0;
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

function formatDateTime(date: Date) {
    return new Intl.DateTimeFormat('hr-HR', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
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
