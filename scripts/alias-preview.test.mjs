import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = resolve(import.meta.dirname, "..");
const scriptPath = resolve(repoRoot, "scripts", "alias-preview.mjs");

async function runAliasPreview(env) {
  const tempDir = await mkdtemp(join(tmpdir(), "alias-preview-test-"));
  const outputPath = join(tempDir, "github-output");
  const vercelPath = join(tempDir, "vercel");

  await writeFile(
    vercelPath,
    "#!/usr/bin/env bash\nprintf 'vercel %s\\n' \"$*\"\n",
    { mode: 0o755 },
  );

  const result = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH}`,
        VERCEL_TOKEN: "test-token",
        VERCEL_SCOPE: "gredice",
        VERCEL_DEPLOYMENT_URL: "farm-preview.vercel.app",
        GITHUB_OUTPUT: outputPath,
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr, outputPath, tempDir });
    });
  });

  try {
    result.githubOutput = await readFile(outputPath, "utf8");
  } catch {
    result.githubOutput = "";
  }

  await rm(tempDir, { recursive: true, force: true });
  return result;
}

test("caps generated alias domains to Vercel certificate common-name length", async () => {
  const result = await runAliasPreview({
    GREDICE_PREVIEW_DOMAIN: "preview.gredice.com",
    GREDICE_PREVIEW_ALIAS_PREFIX: "farm",
    GITHUB_HEAD_REF: "feat/set-up-custom-preview-deployment-urls",
  });

  assert.equal(result.code, 0, result.stderr);
  const aliasDomain = result.githubOutput.match(/^alias_domain=(.+)$/m)?.[1];
  assert.equal(
    aliasDomain,
    "farm-feat-set-up-custom-preview-deployment-u.preview.gredice.com",
  );
  assert.ok(aliasDomain.length <= 64);
});

test("fails when the preview domain leaves no room for an alias", async () => {
  const result = await runAliasPreview({
    GREDICE_PREVIEW_DOMAIN:
      "too-long-preview-domain-name-for-common-name-limit.example.invalid.test",
    GITHUB_HEAD_REF: "branch",
  });

  assert.equal(result.code, 1);
  assert.match(
    result.stderr,
    /Preview domain .* is too long: preview domain length plus separator must leave room for a branch slug within the 64-character certificate common-name limit/,
  );
});
