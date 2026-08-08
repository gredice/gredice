import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const allowMissingScreenshots = args.includes("--allow-missing-screenshots");
const appArgument = args.find((argument) => !argument.startsWith("--"));

if (!appArgument) {
    console.error(
        "Usage: node scripts/validate-android-store-listing.mjs <app-directory> [--allow-missing-screenshots]",
    );
    process.exit(1);
}

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const appDirectory = path.resolve(repoRoot, appArgument);
const listingDirectory = path.join(
    appDirectory,
    "store",
    "google-play",
    "hr-HR",
);
const graphicsDirectory = path.join(listingDirectory, "graphics");
const screenshotsDirectory = path.join(graphicsDirectory, "screenshots");

const failures = [];
const check = (condition, message) => {
    if (!condition) {
        failures.push(message);
    }
};

const readText = (fileName) => {
    const filePath = path.join(listingDirectory, fileName);
    check(fs.existsSync(filePath), `Missing ${fileName}`);
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "";
};

const codePointLength = (value) => Array.from(value).length;
const validateText = (fileName, maximum) => {
    const value = readText(fileName);
    check(value.length > 0, `${fileName} must not be empty`);
    check(
        codePointLength(value) <= maximum,
        `${fileName} exceeds ${maximum} characters (${codePointLength(value)})`,
    );
};

const readPng = (filePath) => {
    const buffer = fs.readFileSync(filePath);
    check(
        buffer.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        ),
        `${filePath} is not a PNG`,
    );
    check(buffer.length >= 26, `${filePath} has an incomplete PNG header`);
    if (buffer.length < 26) {
        return { width: 0, height: 0, alpha: true };
    }

    const colorType = buffer.readUInt8(25);
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        alpha: colorType === 4 || colorType === 6,
    };
};

const startOfFrameMarkers = new Set([
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
]);

const readJpeg = (filePath) => {
    const buffer = fs.readFileSync(filePath);
    check(
        buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8,
        `${filePath} is not a JPEG`,
    );

    let offset = 2;
    while (offset + 8 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        while (buffer[offset] === 0xff) {
            offset += 1;
        }
        const marker = buffer[offset];
        offset += 1;

        if (startOfFrameMarkers.has(marker)) {
            return {
                width: buffer.readUInt16BE(offset + 5),
                height: buffer.readUInt16BE(offset + 3),
                alpha: false,
            };
        }

        if (
            marker === 0xd8 ||
            marker === 0xd9 ||
            marker === 0x01 ||
            (marker >= 0xd0 && marker <= 0xd7)
        ) {
            continue;
        }

        if (offset + 2 > buffer.length) {
            break;
        }
        const segmentLength = buffer.readUInt16BE(offset);
        if (segmentLength < 2) {
            break;
        }
        offset += segmentLength;
    }

    check(false, `${filePath} has no readable JPEG dimensions`);
    return { width: 0, height: 0, alpha: false };
};

const readImage = (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".png") {
        return readPng(filePath);
    }
    if (extension === ".jpg" || extension === ".jpeg") {
        return readJpeg(filePath);
    }
    check(false, `${filePath} must be PNG or JPEG`);
    return { width: 0, height: 0, alpha: true };
};

validateText("app-name.txt", 30);
validateText("short-description.txt", 80);
validateText("full-description.txt", 4_000);

const releaseNotesDirectory = path.join(listingDirectory, "release-notes");
check(fs.existsSync(releaseNotesDirectory), "Missing release-notes directory");
if (fs.existsSync(releaseNotesDirectory)) {
    const releaseNotes = fs
        .readdirSync(releaseNotesDirectory)
        .filter((fileName) => fileName.endsWith(".txt"));
    check(releaseNotes.length > 0, "At least one release note is required");
    for (const fileName of releaseNotes) {
        const value = fs
            .readFileSync(path.join(releaseNotesDirectory, fileName), "utf8")
            .trim();
        check(value.length > 0, `${fileName} must not be empty`);
        check(
            codePointLength(value) <= 500,
            `${fileName} exceeds the 500-character release-note limit`,
        );
    }
}

const iconPath = path.join(graphicsDirectory, "play-icon-512x512.png");
check(fs.existsSync(iconPath), "Missing play-icon-512x512.png");
if (fs.existsSync(iconPath)) {
    const icon = readPng(iconPath);
    check(icon.width === 512 && icon.height === 512, "Play icon must be 512×512");
    check(icon.alpha, "Play icon must be a 32-bit PNG with an alpha channel");
    check(
        fs.statSync(iconPath).size <= 1024 * 1024,
        "Play icon must not exceed 1 MB",
    );
}

const featureCandidates = [
    path.join(graphicsDirectory, "feature-graphic-1024x500.png"),
    path.join(graphicsDirectory, "feature-graphic-1024x500.jpg"),
];
const featurePath = featureCandidates.find((candidate) => fs.existsSync(candidate));
check(Boolean(featurePath), "Missing feature graphic");
if (featurePath) {
    const feature = readImage(featurePath);
    check(
        feature.width === 1024 && feature.height === 500,
        "Feature graphic must be exactly 1024×500",
    );
    check(!feature.alpha, "Feature graphic must not contain an alpha channel");
}

const screenshotFiles = fs.existsSync(screenshotsDirectory)
    ? fs
          .readdirSync(screenshotsDirectory)
          .filter((fileName) => /\.(png|jpe?g)$/i.test(fileName))
          .sort()
    : [];

check(screenshotFiles.length <= 8, "Google Play accepts at most eight screenshots");
if (!allowMissingScreenshots) {
    check(screenshotFiles.length >= 2, "At least two genuine screenshots are required");
}

for (const fileName of screenshotFiles) {
    const filePath = path.join(screenshotsDirectory, fileName);
    const screenshot = readImage(filePath);
    const shorter = Math.min(screenshot.width, screenshot.height);
    const longer = Math.max(screenshot.width, screenshot.height);

    check(!screenshot.alpha, `${fileName} must not contain an alpha channel`);
    check(
        shorter >= 320 && longer <= 3840,
        `${fileName} dimensions must stay between 320 and 3840 pixels`,
    );
    check(longer <= shorter * 2, `${fileName} exceeds the 2:1 aspect-ratio limit`);
}

if (failures.length > 0) {
    for (const failure of failures) {
        console.error(`[store-listing] ${failure}`);
    }
    process.exit(1);
}

console.log(
    `✅ ${path.relative(repoRoot, listingDirectory)} is structurally ready` +
        (allowMissingScreenshots && screenshotFiles.length < 2
            ? " (screenshots intentionally pending)"
            : ""),
);
