import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
    JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

const canonicalManifest = readJson("apps/garden/app/manifest.json");
const embeddedManifest = readJson(
    "apps/garden-android/app/src/main/res/raw/web_app_manifest.json",
);
const twaManifest = readJson("apps/garden-android/twa-manifest.json");
const assetLinks = readJson(
    "apps/garden/public/.well-known/assetlinks.json",
);

assert.deepEqual(
    embeddedManifest,
    canonicalManifest,
    "The Android embedded web manifest must match apps/garden/app/manifest.json",
);

const properties = Object.fromEntries(
    fs
        .readFileSync(
            path.join(repoRoot, "apps/garden-android/gradle.properties"),
            "utf8",
        )
        .split(/\r?\n/)
        .filter((line) => line.includes("="))
        .map((line) => {
            const separator = line.indexOf("=");
            return [line.slice(0, separator), line.slice(separator + 1)];
        }),
);

assert.equal(twaManifest.packageId, "com.gredice.vrt.twa");
assert.equal(twaManifest.host, "vrt.gredice.com");
assert.equal(twaManifest.appVersion, properties.GREDICE_VERSION_NAME);
assert.equal(
    twaManifest.appVersionCode,
    Number(properties.GREDICE_VERSION_CODE),
);
assert.equal(twaManifest.minSdkVersion, 23);
assert.equal(twaManifest.features?.locationDelegation?.enabled, false);

const playFingerprint = twaManifest.fingerprints.find(
    (fingerprint) => fingerprint.name === "Google Play app signing",
)?.value;
assert.ok(playFingerprint, "The named Play app-signing fingerprint is required");

const assetLink = assetLinks.find(
    (entry) => entry.target?.package_name === twaManifest.packageId,
);
assert.ok(assetLink, "Digital Asset Links must contain the Garden package");
assert.ok(
    assetLink.target.sha256_cert_fingerprints.includes(playFingerprint),
    "Digital Asset Links must contain the named Play app-signing fingerprint",
);

console.log("✅ Garden PWA, TWA, version, package, and signing contracts agree.");
