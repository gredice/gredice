import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");

const appName = process.argv[2];
const args = process.argv.slice(3);

const optionValue = (name) => {
    const index = args.indexOf(name);
    if (index === -1) {
        return undefined;
    }

    return args[index + 1];
};

const log = (message) => {
    console.log(`[vercel-ignore] ${message}`);
};

const build = (message) => {
    log(`${message}; continuing build.`);
    process.exit(1);
};

const ignore = (message) => {
    log(`${message}; ignoring deployment.`);
    process.exit(0);
};

if (!appName) {
    build("Missing app package name");
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const loadPackages = (directory) => {
    const root = path.join(repoRoot, directory);
    const packages = [];

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }

        const packageJsonPath = path.join(root, entry.name, "package.json");
        if (!fs.existsSync(packageJsonPath)) {
            continue;
        }

        const packageJson = readJson(packageJsonPath);
        if (!packageJson.name) {
            continue;
        }

        packages.push({
            name: packageJson.name,
            relativePath: `${directory}/${entry.name}`,
            packageJson,
        });
    }

    return packages;
};

const allPackages = [...loadPackages("apps"), ...loadPackages("packages")];
const packageByName = new Map(
    allPackages.map((workspacePackage) => [
        workspacePackage.name,
        workspacePackage,
    ]),
);
const targetPackage = packageByName.get(appName);

if (!targetPackage) {
    build(`Unknown workspace package "${appName}"`);
}

const dependencyNames = (packageJson) =>
    [
        packageJson.dependencies,
        packageJson.devDependencies,
        packageJson.peerDependencies,
        packageJson.optionalDependencies,
    ]
        .filter(Boolean)
        .flatMap((dependencies) => Object.keys(dependencies));

const dependencyClosure = (packageName, seen = new Set()) => {
    if (seen.has(packageName)) {
        return seen;
    }

    seen.add(packageName);

    const workspacePackage = packageByName.get(packageName);
    if (!workspacePackage) {
        return seen;
    }

    for (const dependencyName of dependencyNames(workspacePackage.packageJson)) {
        if (packageByName.has(dependencyName)) {
            dependencyClosure(dependencyName, seen);
        }
    }

    return seen;
};

const relevantPackageNames = dependencyClosure(appName);
const relevantPackagePaths = new Set(
    [...relevantPackageNames].map(
        (packageName) => packageByName.get(packageName)?.relativePath,
    ),
);

const globalFiles = new Set([
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
]);

const globalDirectories = ["scripts/"];

const head =
    optionValue("--head") ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "HEAD";
const base =
    optionValue("--base") ??
    process.env.VERCEL_GIT_PREVIOUS_SHA ??
    (head === "HEAD" ? "HEAD^" : undefined);

if (!base) {
    build("Missing base SHA");
}

const git = (...gitArgs) =>
    spawnSync("git", gitArgs, {
        cwd: repoRoot,
        encoding: "utf8",
    });

for (const ref of [base, head]) {
    const result = git("rev-parse", "--verify", `${ref}^{commit}`);
    if (result.status !== 0) {
        build(`Unable to resolve git ref ${ref}`);
    }
}

const diff = git("diff", "--name-only", base, head, "--");
if (diff.status !== 0) {
    build(`Unable to diff ${base}..${head}`);
}

const changedFiles = diff.stdout
    .split(/\r?\n/)
    .map((filePath) => filePath.trim())
    .filter(Boolean);

if (changedFiles.length === 0) {
    ignore(`No changed files between ${base} and ${head}`);
}

const isRelevantFile = (filePath) => {
    if (globalFiles.has(filePath)) {
        return true;
    }

    if (globalDirectories.some((directory) => filePath.startsWith(directory))) {
        return true;
    }

    for (const packagePath of relevantPackagePaths) {
        if (packagePath && filePath.startsWith(`${packagePath}/`)) {
            return true;
        }
    }

    return false;
};

const relevantChangedFiles = changedFiles.filter(isRelevantFile);

if (relevantChangedFiles.length === 0) {
    ignore(`${appName} is not affected by ${changedFiles.length} changed file(s)`);
}

log(`${appName} is affected by:`);
for (const filePath of relevantChangedFiles.slice(0, 20)) {
    log(`- ${filePath}`);
}

if (relevantChangedFiles.length > 20) {
    log(`- ...and ${relevantChangedFiles.length - 20} more`);
}

process.exit(1);
