import { create as createQrCode } from 'qrcode';
import {
    DEFAULT_HARVEST_LABEL_PRESET,
    getHarvestLabelCanvasSize,
} from './harvestLabelCanvas';
import type { FieldOperationLabelData } from './types';

const FONT_FAMILY = '"Noto Sans", "Segoe UI", Arial, sans-serif';
const LINE_HEIGHT = 1.05;

function sanitizeText(value: string) {
    return value.trim().replace(/\s+/g, ' ');
}

function clampWithEllipsis(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
) {
    if (context.measureText(text).width <= maxWidth) {
        return text;
    }

    let trimmed = text.trim();
    while (trimmed.length > 0) {
        const next = `${trimmed.trimEnd()}…`;
        if (context.measureText(next).width <= maxWidth) {
            return next;
        }
        trimmed = trimmed.slice(0, -1);
    }

    return '…';
}

function wrapText(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number,
) {
    const words = sanitizeText(text).split(' ').filter(Boolean);
    if (words.length === 0) {
        return [''];
    }

    const lines: string[] = [];
    let wordIndex = 0;
    while (wordIndex < words.length && lines.length < maxLines) {
        let line = words[wordIndex] ?? '';
        wordIndex += 1;

        while (wordIndex < words.length) {
            const candidate = `${line} ${words[wordIndex]}`;
            if (context.measureText(candidate).width > maxWidth) {
                break;
            }
            line = candidate;
            wordIndex += 1;
        }

        lines.push(clampWithEllipsis(context, line, maxWidth));
    }

    if (wordIndex < words.length && lines.length > 0) {
        lines[lines.length - 1] = clampWithEllipsis(
            context,
            `${lines.at(-1) ?? ''} ${words.slice(wordIndex).join(' ')}`,
            maxWidth,
        );
    }

    return lines;
}

function fitSingleLineFont(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxFontSize: number,
    minFontSize: number,
    fontWeight: number,
) {
    for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
        context.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
        if (context.measureText(text).width <= maxWidth) {
            return fontSize;
        }
    }

    return minFontSize;
}

function fitWrappedFont(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number,
    maxLines: number,
    maxFontSize: number,
    minFontSize: number,
    fontWeight: number,
) {
    for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
        context.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
        const lines = wrapText(context, text, maxWidth, maxLines);
        if (lines.length * fontSize * LINE_HEIGHT <= maxHeight) {
            return { fontSize, lines };
        }
    }

    context.font = `${fontWeight} ${minFontSize}px ${FONT_FAMILY}`;
    return {
        fontSize: minFontSize,
        lines: wrapText(context, text, maxWidth, maxLines),
    };
}

function drawQrCode(
    context: CanvasRenderingContext2D,
    payload: string,
    x: number,
    y: number,
    size: number,
) {
    const qrCode = createQrCode(payload, { errorCorrectionLevel: 'M' });
    const moduleCount = qrCode.modules.size;
    const quietModules = 4;
    const totalModules = moduleCount + quietModules * 2;
    if (totalModules > size) {
        throw new Error('QR sadržaj je predug za dostupnu površinu etikete.');
    }

    const moduleSize = Math.floor(size / totalModules);
    const renderedSize = moduleSize * totalModules;
    const offsetX = x + Math.floor((size - renderedSize) / 2);
    const offsetY = y + Math.floor((size - renderedSize) / 2);

    context.save();
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(x, y, size, size);
    context.fillStyle = '#000000';

    for (let row = 0; row < moduleCount; row += 1) {
        for (let column = 0; column < moduleCount; column += 1) {
            if (!qrCode.modules.data[row * moduleCount + column]) {
                continue;
            }

            context.fillRect(
                offsetX + (column + quietModules) * moduleSize,
                offsetY + (row + quietModules) * moduleSize,
                moduleSize,
                moduleSize,
            );
        }
    }

    context.restore();
}

function configureIconStroke(
    context: CanvasRenderingContext2D,
    lineWidth: number,
) {
    context.strokeStyle = '#000000';
    context.fillStyle = '#ffffff';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = lineWidth;
}

function drawOperationIcon(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number,
) {
    const radius = size / 2;
    configureIconStroke(context, Math.max(2, size * 0.08));

    context.beginPath();
    context.moveTo(centerX - radius * 0.8, centerY + radius * 0.75);
    context.bezierCurveTo(
        centerX - radius * 0.6,
        centerY - radius * 0.55,
        centerX + radius * 0.3,
        centerY - radius * 0.9,
        centerX + radius * 0.75,
        centerY - radius * 0.8,
    );
    context.bezierCurveTo(
        centerX + radius * 0.8,
        centerY + radius * 0.15,
        centerX + radius * 0.2,
        centerY + radius * 0.75,
        centerX - radius * 0.8,
        centerY + radius * 0.75,
    );
    context.stroke();

    context.beginPath();
    context.moveTo(centerX - radius * 0.9, centerY + radius * 0.95);
    context.lineTo(centerX + radius * 0.45, centerY - radius * 0.45);
    context.stroke();
}

function drawPlantIcon(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number,
) {
    const radius = size * 0.36;
    configureIconStroke(context, Math.max(2, size * 0.08));

    context.beginPath();
    context.arc(centerX, centerY + size * 0.08, radius, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX - size * 0.16, centerY - radius - size * 0.18);
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + size * 0.16, centerY - radius - size * 0.18);
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX, centerY - radius - size * 0.24);
    context.stroke();
}

function drawDateIcon(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number,
) {
    const left = centerX - size * 0.42;
    const top = centerY - size * 0.38;
    const width = size * 0.84;
    const height = size * 0.76;
    configureIconStroke(context, Math.max(2, size * 0.08));

    context.strokeRect(left, top, width, height);
    context.beginPath();
    context.moveTo(left, top + size * 0.24);
    context.lineTo(left + width, top + size * 0.24);
    context.moveTo(centerX - size * 0.22, top - size * 0.1);
    context.lineTo(centerX - size * 0.22, top + size * 0.12);
    context.moveTo(centerX + size * 0.22, top - size * 0.1);
    context.lineTo(centerX + size * 0.22, top + size * 0.12);
    context.stroke();

    context.fillStyle = '#000000';
    const dotSize = Math.max(2, Math.round(size * 0.08));
    for (const xOffset of [-0.2, 0, 0.2]) {
        for (const yOffset of [0.04, 0.24]) {
            context.fillRect(
                centerX + size * xOffset - dotSize / 2,
                centerY + size * yOffset - dotSize / 2,
                dotSize,
                dotSize,
            );
        }
    }
}

function drawTopValue(
    context: CanvasRenderingContext2D,
    label: string,
    value: string,
    left: number,
    right: number,
    labelTop: number,
    valueBaseline: number,
    labelFontSize: number,
    maxValueFontSize: number,
    minValueFontSize: number,
) {
    const centerX = (left + right) / 2;
    const maxWidth = right - left - Math.max(8, (right - left) * 0.12);

    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.font = `700 ${labelFontSize}px ${FONT_FAMILY}`;
    context.fillText(label, centerX, labelTop);

    const fontSize = fitSingleLineFont(
        context,
        value,
        maxWidth,
        maxValueFontSize,
        minValueFontSize,
        800,
    );
    context.textBaseline = 'alphabetic';
    context.font = `800 ${fontSize}px ${FONT_FAMILY}`;
    context.fillText(
        clampWithEllipsis(context, value, maxWidth),
        centerX,
        valueBaseline,
    );
}

function drawBottomCell(
    context: CanvasRenderingContext2D,
    text: string,
    left: number,
    right: number,
    top: number,
    bottom: number,
    icon: (
        context: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        size: number,
    ) => void,
) {
    const width = right - left;
    const textLayout = fitWrappedFont(
        context,
        text,
        width - Math.max(10, width * 0.12),
        (bottom - top) * 0.4,
        2,
        Math.round((bottom - top) * 0.19),
        Math.round((bottom - top) * 0.12),
        700,
    );
    const lineHeight = textLayout.fontSize * LINE_HEIGHT;
    const centerX = (left + right) / 2;
    let baseline = top + textLayout.fontSize;

    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.font = `700 ${textLayout.fontSize}px ${FONT_FAMILY}`;
    for (const line of textLayout.lines) {
        context.fillText(line, centerX, baseline);
        baseline += lineHeight;
    }

    const iconSize = Math.min(width * 0.28, (bottom - top) * 0.32);
    icon(context, centerX, bottom - iconSize * 0.58, iconSize);
}

/**
 * Alternative field-operation label layout focused on fast scanning in the
 * field. V1 remains the production renderer; this experimental renderer is
 * currently exposed only through the Farm label debugger.
 */
export function renderFieldOperationLabelV2(
    canvas: HTMLCanvasElement,
    data: FieldOperationLabelData,
    preset = DEFAULT_HARVEST_LABEL_PRESET,
) {
    const { width, height } = getHarvestLabelCanvasSize(preset);
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to render label preview.');
    }

    const raisedBedText = sanitizeText(data.raisedBedPhysicalId);
    const fieldText = sanitizeText(data.fieldLabel);
    const operationText = sanitizeText(data.detailLabel);
    const plantText = sanitizeText(data.plantSortName);
    const dateText = data.dateLabel ? sanitizeText(data.dateLabel) : '—';
    const paddingX = Math.round(width * 0.035);
    const paddingY = Math.round(height * 0.045);
    const topDividerY = Math.round(height * 0.6);
    const lineWidth = Math.max(1, Math.round(height * 0.008));
    const qrPayload = data.traceUrl?.trim();
    const qrSize = qrPayload
        ? Math.round(Math.min(width * 0.245, height * 0.43))
        : 0;
    const qrX = width - paddingX - qrSize;
    const topContentRight = qrPayload
        ? qrX - Math.round(width * 0.02)
        : width - paddingX;
    const topContentWidth = topContentRight - paddingX;
    const topColumnDividerX = paddingX + topContentWidth * 0.53;
    const bottomContentWidth = width - paddingX * 2;
    const bottomColumnWidth = bottomContentWidth / 3;
    const bottomTop = topDividerY + Math.round(height * 0.045);
    const bottom = height - paddingY;

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = '#000000';
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(paddingX, topDividerY);
    context.lineTo(width - paddingX, topDividerY);
    context.moveTo(topColumnDividerX, paddingY);
    context.lineTo(topColumnDividerX, topDividerY - Math.round(height * 0.045));
    for (const columnIndex of [1, 2]) {
        const x = paddingX + bottomColumnWidth * columnIndex;
        context.moveTo(x, bottomTop);
        context.lineTo(x, bottom);
    }
    context.stroke();

    const topLabelFontSize = Math.round(height * 0.068);
    const valueBaseline = topDividerY - Math.round(height * 0.075);
    drawTopValue(
        context,
        'Gredica',
        raisedBedText,
        paddingX,
        topColumnDividerX,
        paddingY,
        valueBaseline,
        topLabelFontSize,
        Math.round(height * 0.3),
        Math.round(height * 0.15),
    );
    drawTopValue(
        context,
        'Polje',
        fieldText,
        topColumnDividerX,
        topContentRight,
        paddingY,
        valueBaseline,
        topLabelFontSize,
        Math.round(height * 0.3),
        Math.round(height * 0.15),
    );

    if (qrPayload) {
        drawQrCode(
            context,
            qrPayload,
            qrX,
            paddingY + Math.round(height * 0.015),
            qrSize,
        );
    }

    const cellTop = topDividerY + Math.round(height * 0.035);
    drawBottomCell(
        context,
        operationText,
        paddingX,
        paddingX + bottomColumnWidth,
        cellTop,
        bottom,
        drawOperationIcon,
    );
    drawBottomCell(
        context,
        plantText,
        paddingX + bottomColumnWidth,
        paddingX + bottomColumnWidth * 2,
        cellTop,
        bottom,
        drawPlantIcon,
    );
    drawBottomCell(
        context,
        dateText,
        paddingX + bottomColumnWidth * 2,
        width - paddingX,
        cellTop,
        bottom,
        drawDateIcon,
    );
}
