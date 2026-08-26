import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertHandleAllUrlsRelation } from "./digital-asset-links.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
    fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));

const playAppSigningFingerprint =
    "BD:05:C5:6A:AB:8C:E4:5D:41:22:4B:06:F9:20:D8:9D:06:5F:4E:E5:9C:D5:69:26:EB:02:6E:C3:7A:44:53:6B";
const assetLinksOrigin = "https://dostava.gredice.com";

const appBuild = read("apps/delivery-android/app/build.gradle");
const manifest = read(
    "apps/delivery-android/app/src/main/AndroidManifest.xml",
);
const carDescriptor = read(
    "apps/delivery-android/app/src/main/res/xml/automotive_app_desc.xml",
);
const strings = read(
    "apps/delivery-android/app/src/main/res/values/strings.xml",
);
const assetLinks = readJson(
    "apps/delivery/public/.well-known/assetlinks.json",
);
const navigationUri = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/NavigationUri.java",
);
const navigationLaunchGate = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/NavigationLaunchGate.java",
);
const stopsScreen = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/car/DeliveryStopsScreen.java",
);

const readStringResValue = (name) => {
    const match = appBuild.match(
        new RegExp(`resValue 'string', '${name}', '([^']+)'`),
    );
    assert.ok(match, `Android string resource ${name} must be configured`);
    return match[1];
};

const launchUrl = new URL(readStringResValue("launchUrl"));
const hostName = readStringResValue("hostName");
const assetStatementsValue = strings.match(
    /<string name="asset_statements">(.+)<\/string>/,
)?.[1];
assert.ok(assetStatementsValue, "Android web asset statements are required");
const webAssetStatements = JSON.parse(
    assetStatementsValue.replaceAll('\\"', '"'),
);
const webAssetStatement = webAssetStatements.find(
    (entry) => entry.target?.namespace === "web",
);

assert.match(appBuild, /applicationId 'com\.gredice\.dostava'/);
assert.match(appBuild, /minSdk 28/);
assert.match(appBuild, /targetSdk 36/);
assert.match(appBuild, /androidx\.car\.app:app:1\.7\.0/);
assert.match(appBuild, /androidx\.car\.app:app-projected:1\.7\.0/);

const permissions = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
assert.deepEqual(permissions, [
    "android.permission.INTERNET",
    "androidx.car.app.MAP_TEMPLATES",
]);
assert.match(manifest, /androidx\.car\.app\.category\.POI/);
assert.doesNotMatch(manifest, /androidx\.car\.app\.category\.NAVIGATION/);
assert.match(manifest, /<intent-filter android:autoVerify="true">/);
assert.match(manifest, /android:value="@string\/launchUrl"/);
assert.match(manifest, /android:host="@string\/hostName"/);
assert.match(carDescriptor, /<uses name="template" \/>/);
assert.equal(launchUrl.protocol, "https:");
assert.equal(launchUrl.hostname, hostName);
assert.equal(launchUrl.origin, assetLinksOrigin);
assert.ok(webAssetStatement, "Android must delegate trust to the web origin");
assertHandleAllUrlsRelation(
    webAssetStatement.relation,
    "Android web asset statement",
);
assert.equal(webAssetStatement.target.site, assetLinksOrigin);

const assetLink = assetLinks.find(
    (entry) => entry.target?.package_name === "com.gredice.dostava",
);
assert.ok(assetLink, "Digital Asset Links must contain the Delivery package");
assert.equal(assetLink.target.namespace, "android_app");
assertHandleAllUrlsRelation(assetLink.relation, "Digital Asset Links statement");
assert.ok(
    assetLink.target.sha256_cert_fingerprints?.includes(
        playAppSigningFingerprint,
    ),
    "Digital Asset Links must contain the Play app-signing fingerprint",
);

assert.match(stopsScreen, /CarContext\.ACTION_NAVIGATE/);
assert.match(stopsScreen, /startCarApp\(intent\)/);
assert.match(stopsScreen, /navigationLaunchGate\.launchIfAllowed\(/);
assert.match(stopsScreen, /SystemClock\.elapsedRealtime\(\)/);
assert.match(stopsScreen, /void onStart\(/);
assert.match(stopsScreen, /void onResume\(/);
assert.match(stopsScreen, /HostException \| SecurityException/);
assert.match(stopsScreen, /catch \(RuntimeException exception\)/);
assert.doesNotMatch(stopsScreen, /setPackage\s*\(/);
assert.doesNotMatch(stopsScreen, /setComponent\s*\(/);
assert.doesNotMatch(stopsScreen, /com\.google\.android\.apps\.maps/);
assert.match(navigationLaunchGate, /DEFAULT_SUPPRESSION_WINDOW_MILLIS = 1_500L/);
assert.match(navigationLaunchGate, /catch \(RuntimeException \| Error failure\)/);
assert.match(navigationUri, /"geo:%\.6f,%\.6f"/);
assert.match(strings, /<string name="navigation_action">Navigacija<\/string>/);

console.log(
    "✅ Delivery Android contract is POI-only, permission-minimal, provider-neutral, and web-associated.",
);
