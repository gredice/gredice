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
const navigationHandoffController = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/NavigationHandoffController.java",
);
const pendingNavigationHandoff = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/PendingNavigationHandoff.java",
);
const navigationHandoffStore = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/SharedPreferencesNavigationHandoffStore.java",
);
const stopsScreen = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/car/DeliveryStopsScreen.java",
);
const nativeApiClient = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/auth/DeliveryNativeApiClient.java",
);
const mobileRoutes = read(
    "apps/api/app/api/[...route]/deliveryMobileRoutes.ts",
);
const androidAutoFlag = read(
    "apps/api/lib/delivery/deliveryAndroidAutoFlag.ts",
);
const nativeRouteRepository = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/data/NativeDeliveryStopRepository.java",
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
    "android.permission.POST_NOTIFICATIONS",
    "androidx.car.app.MAP_TEMPLATES",
]);
assert.match(manifest, /androidx\.car\.app\.category\.POI/);
assert.doesNotMatch(manifest, /androidx\.car\.app\.category\.NAVIGATION/);
const callbackActivity = manifest.match(
    /<activity\b(?=[^>]*android:name="\.auth\.NativeAuthCallbackActivity")[\s\S]*?<\/activity>/,
)?.[0];
assert.ok(callbackActivity, "Native callback activity must be declared");
const callbackFilters = [
    ...callbackActivity.matchAll(
        /<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g,
    ),
];
assert.ok(
    callbackFilters.some(
        ([filter]) =>
            /<intent-filter\b[^>]*android:autoVerify="true"/.test(filter) &&
            /<data\b(?=[^>]*android:host="@string\/hostName")(?=[^>]*android:path="\/android\/auth\/callback")(?=[^>]*android:scheme="https")[^>]*\/>/.test(
                filter,
            ),
    ),
    "Native callback must use one exact auto-verified HTTPS intent filter",
);
assert.match(manifest, /android:allowBackup="false"/);
assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
assert.match(manifest, /android:value="@string\/launchUrl"/);
assert.match(manifest, /android:host="@string\/hostName"/);
assert.match(
    manifest,
    /android:manageSpaceActivity="com\.google\.androidbrowserhelper\.trusted\.ManageDataLauncherActivity"/,
);
assert.match(
    manifest,
    /<activity android:name="com\.google\.androidbrowserhelper\.trusted\.ManageDataLauncherActivity">[\s\S]*?android:name="android\.support\.customtabs\.trusted\.MANAGE_SPACE_URL"[\s\S]*?android:value="@string\/launchUrl"[\s\S]*?<\/activity>/,
);
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
assert.match(stopsScreen, /navigationHandoffController\.launch\(/);
assert.match(stopsScreen, /SystemClock\.elapsedRealtime\(\)/);
assert.match(stopsScreen, /void onStart\(/);
assert.match(stopsScreen, /void onResume\(/);
assert.match(stopsScreen, /ActivityNotFoundException/);
assert.match(stopsScreen, /Result\.NO_HANDLER/);
assert.match(stopsScreen, /Result\.HOST_FAILURE/);
assert.match(stopsScreen, /Result\.SECURITY_FAILURE/);
for (const source of [stopsScreen, navigationHandoffController]) {
    assert.doesNotMatch(source, /setPackage\s*\(/);
    assert.doesNotMatch(source, /setComponent\s*\(/);
    assert.doesNotMatch(source, /com\.google\.android\.apps\.maps/);
}
assert.match(navigationLaunchGate, /DEFAULT_SUPPRESSION_WINDOW_MILLIS = 1_500L/);
assert.match(navigationLaunchGate, /catch \(RuntimeException \| Error failure\)/);
assert.match(navigationHandoffController, /launchGate\.launchIfAllowed\(/);
assert.match(navigationHandoffController, /Result\.SUPPRESSED/);
assert.match(navigationHandoffController, /recordNavigationHandoff\(/);
assert.match(navigationUri, /"geo:%\.6f,%\.6f"/);
assert.doesNotMatch(
    pendingNavigationHandoff,
    /private final (?:String|double) (?:latitude|longitude|address|label|token|customer)/i,
);
assert.doesNotMatch(
    navigationHandoffStore,
    /"(?:latitude|longitude|address|label|token|customer)(?:_|\")/i,
);
assert.match(navigationHandoffStore, /\.commit\(\)/);
assert.doesNotMatch(navigationHandoffStore, /\.apply\(\)/);
assert.match(strings, /<string name="navigation_action">Navigacija<\/string>/);
assert.match(nativeApiClient, /setInstanceFollowRedirects\(false\)/);
assert.match(androidAutoFlag, /DELIVERY_ANDROID_AUTO_ENABLED/);
assert.match(androidAutoFlag, /=== 'true'/);
assert.match(mobileRoutes, /code: 'ANDROID_AUTO_DISABLED'/);
assert.match(mobileRoutes, /context\.req\.path\.endsWith\('\/auth\/revoke'\)/);
assert.match(nativeRouteRepository, /"ANDROID_AUTO_DISABLED"\.equals\(errorCode\)/);
assert.match(nativeRouteRepository, /routeCache\.clear\(\)/);

const quickReturnSpec = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/QuickReturnNotificationSpec.java",
);
const quickReturnNotifier = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/CarActiveRouteReturnNotifier.java",
);
const quickReturnIntent = read(
    "apps/delivery-android/app/src/main/java/com/gredice/dostava/navigation/QuickReturnIntent.java",
);
assert.match(quickReturnSpec, /CHANNEL_ID = "active-delivery-route"/);
assert.match(quickReturnSpec, /CHANNEL_NAME = "Aktivna dostava"/);
assert.match(quickReturnSpec, /TITLE = "Gredice Dostava"/);
assert.match(quickReturnSpec, /TEXT = "Otvori aktivnu rutu"/);
assert.match(quickReturnNotifier, /NotificationManagerCompat\.IMPORTANCE_LOW/);
assert.match(quickReturnNotifier, /CarAppExtender\.Builder/);
assert.match(quickReturnNotifier, /CarNotificationManager/);
assert.match(quickReturnNotifier, /CarPendingIntent\.getCarApp/);
assert.match(quickReturnNotifier, /setOnlyAlertOnce\(true\)/);
assert.match(quickReturnNotifier, /setSilent\(true\)/);
assert.match(quickReturnNotifier, /public synchronized PostResult postOrUpdate/);
assert.match(quickReturnNotifier, /public synchronized boolean cancel/);
assert.match(quickReturnIntent, /DeliveryCarAppService\.class/);
for (const source of [quickReturnSpec, quickReturnNotifier, quickReturnIntent]) {
    assert.doesNotMatch(
        source,
        /customer|address|latitude|longitude|coordinate|token|routeId|navigationId/i,
    );
}

console.log(
    "✅ Delivery Android contract is POI-only, provider-neutral, web-associated, exact-callback verified, and quick-return privacy-safe.",
);
