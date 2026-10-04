#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const requireFromApp = createRequire(
	path.join(repositoryRoot, "apps/app/package.json"),
);
let sharpModule;
try {
	sharpModule = requireFromApp("sharp");
} catch (error) {
	console.error(
		"Unable to load sharp from apps/app. Install workspace dependencies before validating covers.",
	);
	throw error;
}
const sharp = sharpModule.default ?? sharpModule;

const minimumDimension = 1000;
const transparentAlphaMaximum = 8;
const opaqueAlphaMinimum = 247;
const minimumTransparentFraction = 0.15;
const minimumOpaqueFraction = 0.01;

function usage() {
	return "Usage: node scripts/validate-directory-cover.mjs <cover.png> [more.png ...]";
}

function roundFraction(value) {
	return Number(value.toFixed(6));
}

function alphaAt(data, width, x, y) {
	return data[(y * width + x) * 4 + 3];
}

async function inspectCover(filePath) {
	const absolutePath = path.resolve(filePath);
	const bytes = await readFile(absolutePath);
	const metadata = await sharp(bytes, { failOn: "error" }).metadata();
	const errors = [];
	const warnings = [];

	if (metadata.format !== "png") {
		errors.push(`Expected PNG, found ${metadata.format ?? "unknown"}.`);
	}
	if (!metadata.width || !metadata.height) {
		errors.push("Image dimensions are unavailable.");
	}
	if (metadata.width !== metadata.height) {
		errors.push(
			`Expected a square image, found ${metadata.width ?? 0}x${metadata.height ?? 0}.`,
		);
	}
	if (
		(metadata.width ?? 0) < minimumDimension ||
		(metadata.height ?? 0) < minimumDimension
	) {
		errors.push(
			`Expected dimensions of at least ${minimumDimension}x${minimumDimension}.`,
		);
	}
	if (!metadata.hasAlpha || metadata.channels !== 4) {
		errors.push(
			`Expected a four-channel RGBA image, found ${metadata.channels ?? 0} channels.`,
		);
	}

	const { data, info } = await sharp(bytes, { failOn: "error" })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const pixelCount = info.width * info.height;
	let transparentPixels = 0;
	let fullyTransparentPixels = 0;
	let transparentRgbResiduePixels = 0;
	let opaquePixels = 0;
	let minX = info.width;
	let minY = info.height;
	let maxX = -1;
	let maxY = -1;

	for (let index = 0; index < pixelCount; index += 1) {
		const red = data[index * 4];
		const green = data[index * 4 + 1];
		const blue = data[index * 4 + 2];
		const alpha = data[index * 4 + 3];
		if (alpha <= transparentAlphaMaximum) {
			transparentPixels += 1;
		}
		if (alpha === 0) {
			fullyTransparentPixels += 1;
			if (red !== 0 || green !== 0 || blue !== 0) {
				transparentRgbResiduePixels += 1;
			}
		}
		if (alpha >= opaqueAlphaMinimum) {
			opaquePixels += 1;
		}
		if (alpha > transparentAlphaMaximum) {
			const x = index % info.width;
			const y = Math.floor(index / info.width);
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	const cornerAlpha = [
		alphaAt(data, info.width, 0, 0),
		alphaAt(data, info.width, info.width - 1, 0),
		alphaAt(data, info.width, 0, info.height - 1),
		alphaAt(data, info.width, info.width - 1, info.height - 1),
	];
	if (cornerAlpha.some((alpha) => alpha > transparentAlphaMaximum)) {
		errors.push(
			`Expected transparent corners with alpha <= ${transparentAlphaMaximum}; found ${cornerAlpha.join(", ")}.`,
		);
	}

	const transparentFraction = transparentPixels / pixelCount;
	const opaqueFraction = opaquePixels / pixelCount;
	if (transparentFraction < minimumTransparentFraction) {
		errors.push(
			`Transparent coverage ${roundFraction(transparentFraction)} is below ${minimumTransparentFraction}.`,
		);
	}
	if (opaqueFraction < minimumOpaqueFraction) {
		errors.push(
			`Opaque subject coverage ${roundFraction(opaqueFraction)} is below ${minimumOpaqueFraction}.`,
		);
	}
	if (transparentRgbResiduePixels > 0) {
		errors.push(
			`Found RGB color data in ${transparentRgbResiduePixels} fully transparent pixels; clear hidden background color to prevent resize halos.`,
		);
	}
	if (maxX < 0 || maxY < 0) {
		errors.push("No visible subject was detected.");
	}

	if (
		minX === 0 ||
		minY === 0 ||
		maxX === info.width - 1 ||
		maxY === info.height - 1
	) {
		warnings.push(
			"The visible subject touches an image edge; visually check for clipping.",
		);
	}

	return {
		file: absolutePath,
		valid: errors.length === 0,
		sha256: createHash("sha256").update(bytes).digest("hex"),
		format: metadata.format ?? null,
		width: metadata.width ?? null,
		height: metadata.height ?? null,
		channels: metadata.channels ?? null,
		hasAlpha: metadata.hasAlpha ?? false,
		cornerAlpha,
		transparentFraction: roundFraction(transparentFraction),
		fullyTransparentFraction: roundFraction(
			fullyTransparentPixels / pixelCount,
		),
		transparentRgbResiduePixels,
		opaqueFraction: roundFraction(opaqueFraction),
		subjectBounds: maxX < 0 || maxY < 0 ? null : { minX, minY, maxX, maxY },
		visualChecksRequired: [
			"Cultivar or species phenotype matches the sources.",
			"The harvested edible product is the visual focus.",
			"No text, label, banner, logo, hand, packaging, prop, or CGI styling is visible.",
			"Edges are clean and free of white-background halos.",
		],
		warnings,
		errors,
	};
}

const filePaths = process.argv.slice(2).filter((value) => value !== "--");
if (filePaths.length === 0) {
	console.error(usage());
	process.exitCode = 2;
} else {
	const results = [];
	for (const filePath of filePaths) {
		try {
			results.push(await inspectCover(filePath));
		} catch (error) {
			results.push({
				file: path.resolve(filePath),
				valid: false,
				errors: [error instanceof Error ? error.message : String(error)],
			});
		}
	}

	console.log(JSON.stringify(results, null, 2));
	if (results.some((result) => !result.valid)) {
		process.exitCode = 1;
	}
}
