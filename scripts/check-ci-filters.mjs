import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "ci.yml");
const appsDir = path.join(repoRoot, "apps");
const packagesDir = path.join(repoRoot, "packages");

const appNames = ["www", "garden", "farm", "app", "api"];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const loadWorkspacePackages = () => {
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    const mapping = new Map();

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const packageJsonPath = path.join(packagesDir, entry.name, "package.json");
        if (!fs.existsSync(packageJsonPath)) {
            continue;
        }

        const packageJson = readJson(packageJsonPath);
        if (packageJson?.name) {
            mapping.set(packageJson.name, entry.name);
        }
    }

    return mapping;
};

const parseFiltersBlock = (workflowText) => {
    const lines = workflowText.split(/\r?\n/);
    const filtersIndex = lines.findIndex((line) => line.includes("filters: |"));
    if (filtersIndex === -1) {
        throw new Error("Unable to locate filters block in .github/workflows/ci.yml");
    }

    const baseIndent = lines[filtersIndex].match(/^(\s*)/)?.[1]?.length ?? 0;
    const filters = {};
    let currentKey = null;

    for (let i = filtersIndex + 1; i < lines.length; i += 1) {
        const line = lines[i];
        const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
        const trimmed = line.trim();

        if (trimmed.length === 0) {
            continue;
        }

        if (indent <= baseIndent) {
            break;
        }

        const keyMatch = trimmed.match(/^([a-zA-Z0-9_]+):\s*$/);
        if (keyMatch) {
            currentKey = keyMatch[1];
            filters[currentKey] = [];
            continue;
        }

        if (currentKey && trimmed.startsWith("- ")) {
            filters[currentKey].push(trimmed.slice(2).trim());
        }
    }

    return filters;
};

const collectAppWorkspaceDeps = (workspacePackages) => {
    const appDeps = new Map();

    for (const appName of appNames) {
        const packageJsonPath = path.join(appsDir, appName, "package.json");
        const packageJson = readJson(packageJsonPath);
        const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        const workspaceDeps = Object.keys(dependencies)
            .filter((depName) => workspacePackages.has(depName))
            .map((depName) => `packages/${workspacePackages.get(depName)}/**`);

        appDeps.set(appName, new Set(workspaceDeps));
    }

    return appDeps;
};

const normalizePaths = (pathsList) =>
    new Set(pathsList.filter((entry) => entry.startsWith("packages/")));

const compareSets = (expected, actual) => {
    const missing = [];
    const extra = [];

    for (const item of expected) {
        if (!actual.has(item)) {
            missing.push(item);
        }
    }

    for (const item of actual) {
        if (!expected.has(item)) {
            extra.push(item);
        }
    }

    return { missing, extra };
};

const workspacePackages = loadWorkspacePackages();
const workflowText = fs.readFileSync(workflowPath, "utf8");
const filters = parseFiltersBlock(workflowText);
const appWorkspaceDeps = collectAppWorkspaceDeps(workspacePackages);

let hasErrors = false;

for (const [appName, expectedPackages] of appWorkspaceDeps.entries()) {
    const filterKey = `app_${appName}`;
    const filterEntries = filters[filterKey];

    if (!filterEntries) {
        console.error(`[ci-filter] Missing filters for ${filterKey}`);
        hasErrors = true;
        continue;
    }

    const actualPackages = normalizePaths(filterEntries);
    const { missing, extra } = compareSets(expectedPackages, actualPackages);

    if (missing.length > 0 || extra.length > 0) {
        hasErrors = true;
        console.error(`[ci-filter] Package filter mismatch for ${filterKey}`);
        if (missing.length > 0) {
            console.error(`  Missing: ${missing.sort().join(", ")}`);
        }
        if (extra.length > 0) {
            console.error(`  Extra: ${extra.sort().join(", ")}`);
        }
    }
}

if (hasErrors) {
    process.exit(1);
}

console.log("✅ CI filter package lists match app workspace dependencies.");
