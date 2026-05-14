import type { HarvestLabelData, HarvestLabelPreset } from "./types";

const FONT_FAMILY = '"Noto Sans", "Segoe UI", Arial, sans-serif';
const DEFAULT_LINE_HEIGHT = 1.1;

export const DEFAULT_HARVEST_LABEL_PRESET: HarvestLabelPreset = {
	widthMm: 50,
	heightMm: 30,
	dpmm: 8,
	printDirection: "top",
};

function sanitizeText(value: string) {
	return value.trim().replace(/\s+/g, " ");
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
		const next = `${trimmed.trimEnd()}...`;
		if (context.measureText(next).width <= maxWidth) {
			return next;
		}

		trimmed = trimmed.slice(0, -1);
	}

	return "...";
}

function wrapText(
	context: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number,
) {
	const words = sanitizeText(text).split(" ").filter(Boolean);
	if (words.length === 0) {
		return [""];
	}

	const lines: string[] = [];
	let index = 0;

	while (index < words.length && lines.length < maxLines) {
		let line = words[index] ?? "";
		index += 1;

		while (index < words.length) {
			const candidate = `${line} ${words[index]}`;
			if (context.measureText(candidate).width > maxWidth) {
				break;
			}

			line = candidate;
			index += 1;
		}

		lines.push(line);
	}

	if (index < words.length && lines.length > 0) {
		const remaining = words.slice(index - 1).join(" ");
		lines[lines.length - 1] = clampWithEllipsis(context, remaining, maxWidth);
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
		const lineHeight = fontSize * DEFAULT_LINE_HEIGHT;
		if (lines.length <= maxLines && lineHeight * lines.length <= maxHeight) {
			return { fontSize, lines };
		}
	}

	context.font = `${fontWeight} ${minFontSize}px ${FONT_FAMILY}`;
	return {
		fontSize: minFontSize,
		lines: wrapText(context, text, maxWidth, maxLines),
	};
}

export function getHarvestLabelCanvasSize(
	preset = DEFAULT_HARVEST_LABEL_PRESET,
) {
	return {
		width: Math.max(1, Math.round(preset.widthMm * preset.dpmm)),
		height: Math.max(1, Math.round(preset.heightMm * preset.dpmm)),
	};
}

export function renderHarvestLabel(
	canvas: HTMLCanvasElement,
	data: HarvestLabelData,
	preset = DEFAULT_HARVEST_LABEL_PRESET,
) {
	const { width, height } = getHarvestLabelCanvasSize(preset);
	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Unable to render label preview.");
	}

	const paddingX = Math.round(width * 0.07);
	const paddingY = Math.round(height * 0.08);
	const headerText = "BERBA";
	const fieldText = `Polje ${data.fieldIndex}`;
	const bedText = `Gr ${sanitizeText(data.raisedBedPhysicalId)}`;
	const plantSortName = sanitizeText(data.plantSortName);
	const dividerY = Math.round(height * 0.26);
	const bedAreaTop = dividerY + Math.round(height * 0.06);
	const bedAreaHeight = Math.round(height * 0.32);
	const sortAreaTop = bedAreaTop + bedAreaHeight + Math.round(height * 0.06);
	const sortAreaHeight = height - sortAreaTop - paddingY;

	context.clearRect(0, 0, width, height);
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, width, height);
	context.strokeStyle = "#000000";
	context.lineWidth = Math.max(2, Math.round(width * 0.008));
	context.strokeRect(
		context.lineWidth / 2,
		context.lineWidth / 2,
		width - context.lineWidth,
		height - context.lineWidth,
	);

	const headerFontSize = Math.max(14, Math.round(height * 0.1));
	context.fillStyle = "#000000";
	context.textBaseline = "alphabetic";

	context.font = `800 ${headerFontSize}px ${FONT_FAMILY}`;
	context.textAlign = "left";
	context.fillText(headerText, paddingX, paddingY + headerFontSize);

	const fieldFontSize = fitSingleLineFont(
		context,
		fieldText,
		width * 0.42,
		headerFontSize,
		Math.max(11, headerFontSize - 8),
		700,
	);
	context.font = `700 ${fieldFontSize}px ${FONT_FAMILY}`;
	context.textAlign = "right";
	context.fillText(fieldText, width - paddingX, paddingY + fieldFontSize);

	context.beginPath();
	context.moveTo(paddingX, dividerY);
	context.lineTo(width - paddingX, dividerY);
	context.stroke();

	const bedFontSize = fitSingleLineFont(
		context,
		bedText,
		width - paddingX * 2,
		Math.round(height * 0.26),
		Math.round(height * 0.14),
		800,
	);
	context.font = `800 ${bedFontSize}px ${FONT_FAMILY}`;
	context.textAlign = "center";
	context.fillText(bedText, width / 2, bedAreaTop + bedAreaHeight * 0.75);

	const sortLayout = fitWrappedFont(
		context,
		plantSortName,
		width - paddingX * 2,
		sortAreaHeight,
		2,
		Math.round(height * 0.17),
		Math.round(height * 0.1),
		700,
	);
	const sortLineHeight = sortLayout.fontSize * DEFAULT_LINE_HEIGHT;
	const sortBlockHeight = sortLineHeight * sortLayout.lines.length;
	let sortBaseline =
		sortAreaTop + (sortAreaHeight - sortBlockHeight) / 2 + sortLayout.fontSize;

	context.font = `700 ${sortLayout.fontSize}px ${FONT_FAMILY}`;
	for (const line of sortLayout.lines) {
		context.fillText(line, width / 2, sortBaseline);
		sortBaseline += sortLineHeight;
	}
}
