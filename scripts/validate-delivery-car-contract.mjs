import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
    fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

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
const navigationUri = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/NavigationUri.java",
);
const navigationLaunchGate = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/NavigationLaunchGate.java",
);
const stopsScreen = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/car/DeliveryStopsScreen.java",
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
assert.match(carDescriptor, /<uses name="template" \/>/);

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
    "✅ Delivery Android contract is POI-only, permission-minimal, and provider-neutral.",
);
