import { spawnSync } from "node:child_process";

const migrationGate = process.env.GREDICE_PR_PREVIEW_MIGRATION;

if (migrationGate) {
    const expectedBranch = "feat/add-guest-play-mode";
    const postgresUrl = process.env.POSTGRES_URL;
    const productionHost = process.env.GREDICE_PRODUCTION_POSTGRES_HOST;

    if (migrationGate !== "3691") {
        throw new Error("Unexpected preview migration gate.");
    }
    if (process.env.VERCEL_ENV !== "preview") {
        throw new Error("Preview migration refused outside Vercel Preview.");
    }
    if (process.env.VERCEL_GIT_COMMIT_REF !== expectedBranch) {
        throw new Error("Preview migration refused for a different branch.");
    }
    if (!postgresUrl || !productionHost) {
        throw new Error("Preview migration safety configuration is missing.");
    }

    const previewHost = new URL(postgresUrl).hostname;
    if (previewHost === productionHost) {
        throw new Error(
            "Preview migration refused because Preview is using the Production database host.",
        );
    }

    const result = spawnSync(
        "pnpm",
        ["--filter", "@gredice/storage", "migrate:deploy"],
        { env: process.env, stdio: "inherit" },
    );

    if (result.status !== 0) {
        throw new Error("Preview database migration failed.");
    }
}
