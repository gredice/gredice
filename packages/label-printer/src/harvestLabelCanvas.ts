import type {
	FieldOperationLabelData,
	HarvestLabelData,
	HarvestLabelPreset,
} from "./types";

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

function drawSowingIcon(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const groundY = y + height * 0.72;
	const stemBaseY = groundY - height * 0.04;
	const stemTopY = y + height * 0.14;

	context.save();
	context.strokeStyle = "#000000";
	context.fillStyle = "#000000";
	context.lineWidth = Math.max(2, Math.round(width * 0.035));
	context.lineCap = "round";
	context.lineJoin = "round";

	for (const offset of [0, height * 0.15, height * 0.3]) {
		context.beginPath();
		context.moveTo(x + width * 0.08, groundY + offset);
		context.lineTo(x + width * 0.92, groundY + offset);
		context.stroke();
	}

	for (const stemX of [x + width * 0.28, x + width * 0.5, x + width * 0.72]) {
		context.beginPath();
		context.moveTo(stemX, stemBaseY);
		context.bezierCurveTo(
			stemX - width * 0.08,
			y + height * 0.48,
			stemX + width * 0.08,
			y + height * 0.32,
			stemX,
			stemTopY,
		);
		context.stroke();

		for (const side of [-1, 1]) {
			context.beginPath();
			context.ellipse(
				stemX + side * width * 0.08,
				y + height * 0.42,
				width * 0.08,
				height * 0.035,
				side * 0.9,
				0,
				Math.PI * 2,
			);
			context.stroke();

			context.beginPath();
			context.ellipse(
				stemX + side * width * 0.06,
				y + height * 0.24,
				width * 0.07,
				height * 0.03,
				side * 0.85,
				0,
				Math.PI * 2,
			);
			context.stroke();
		}
	}

	context.restore();
}

export function renderFieldOperationLabel(
	canvas: HTMLCanvasElement,
	data: FieldOperationLabelData,
	preset = DEFAULT_HARVEST_LABEL_PRESET,
) {
	const { width, height } = getHarvestLabelCanvasSize(preset);
	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Unable to render label preview.");
	}

	const paddingX = Math.round(width * 0.06);
	const paddingY = Math.round(height * 0.07);
	const iconBox = {
		x: paddingX + Math.round(width * 0.02),
		y: paddingY + Math.round(height * 0.02),
		width: Math.round(width * 0.22),
		height: Math.round(height * 0.28),
	};
	const centerHeaderX = Math.round(width * 0.55);
	const rightColumnX = width - paddingX - Math.round(width * 0.04);
	const headerTop = paddingY + Math.round(height * 0.01);
	const headerLineHeight = Math.round(height * 0.16);
	const topBedText = sanitizeText(data.raisedBedPhysicalId);
	const topFieldText = sanitizeText(data.fieldLabel);
	const detailText = sanitizeText(data.detailLabel);
	const plantSortName = sanitizeText(data.plantSortName);
	const detailTop = Math.round(height * 0.58);
	const plantTop = Math.round(height * 0.75);
	const bottomMaxWidth = width - paddingX * 2;

	context.clearRect(0, 0, width, height);
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, width, height);
	drawSowingIcon(context, iconBox.x, iconBox.y, iconBox.width, iconBox.height);

	context.fillStyle = "#000000";
	context.textBaseline = "alphabetic";

	const centerFontSize = fitSingleLineFont(
		context,
		"Gredica",
		width * 0.42,
		Math.round(height * 0.18),
		Math.round(height * 0.12),
		500,
	);
	context.font = `500 ${centerFontSize}px ${FONT_FAMILY}`;
	context.textAlign = "center";
	context.fillText("Gredica", centerHeaderX, headerTop + centerFontSize);
	context.fillText(
		"Polje",
		centerHeaderX,
		headerTop + centerFontSize + headerLineHeight,
	);

	const bedFontSize = fitSingleLineFont(
		context,
		topBedText,
		width * 0.2,
		Math.round(height * 0.22),
		Math.round(height * 0.13),
		800,
	);
	context.font = `800 ${bedFontSize}px ${FONT_FAMILY}`;
	context.textAlign = "right";
	context.fillText(topBedText, rightColumnX, headerTop + bedFontSize);

	const fieldFontSize = fitSingleLineFont(
		context,
		topFieldText,
		width * 0.24,
		Math.round(height * 0.2),
		Math.round(height * 0.12),
		800,
	);
	context.font = `800 ${fieldFontSize}px ${FONT_FAMILY}`;
	context.fillText(
		topFieldText,
		rightColumnX,
		headerTop + bedFontSize + headerLineHeight,
	);

	const detailFontSize = fitSingleLineFont(
		context,
		detailText,
		bottomMaxWidth,
		Math.round(height * 0.18),
		Math.round(height * 0.1),
		500,
	);
	context.font = `500 ${detailFontSize}px ${FONT_FAMILY}`;
	context.textAlign = "left";
	context.fillText(detailText, paddingX, detailTop + detailFontSize);

	const sortLayout = fitWrappedFont(
		context,
		plantSortName,
		bottomMaxWidth,
		height - plantTop - paddingY,
		2,
		Math.round(height * 0.18),
		Math.round(height * 0.11),
		500,
	);
	const sortLineHeight = sortLayout.fontSize * DEFAULT_LINE_HEIGHT;
	let sortBaseline = plantTop + sortLayout.fontSize;

	context.font = `500 ${sortLayout.fontSize}px ${FONT_FAMILY}`;
	for (const line of sortLayout.lines) {
		context.fillText(line, paddingX, sortBaseline);
		sortBaseline += sortLineHeight;
	}
}

export function renderHarvestLabel(
	canvas: HTMLCanvasElement,
	data: HarvestLabelData,
	preset = DEFAULT_HARVEST_LABEL_PRESET,
) {
	renderFieldOperationLabel(
		canvas,
		{
			raisedBedPhysicalId: data.raisedBedPhysicalId,
			fieldLabel: data.fieldIndex.toString(),
			detailLabel: data.operationLabel ?? "BERBA",
			plantSortName: data.plantSortName,
		},
		preset,
	);
}
