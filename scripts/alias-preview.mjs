#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function sanitizeLabel(value, maxLength = 63) {
  return value
    .toLowerCase()
    .replace(/^refs\/heads\//, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/g, "");
}

function writeGithubOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  appendFileSync(outputFile, `${key}=${value}\n`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe", env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      const t = c.toString();
      stdout += t;
      process.stdout.write(t);
    });
    child.stderr.on("data", (c) => {
      const t = c.toString();
      stderr += t;
      process.stderr.write(t);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function main() {
  const token = required("VERCEL_TOKEN");
  const scope = required("VERCEL_SCOPE");
  const deploymentUrl = required("VERCEL_DEPLOYMENT_URL");
  const previewDomain = required("GREDICE_PREVIEW_DOMAIN");
  const branch = required("GITHUB_HEAD_REF");
  const aliasPrefix = process.env.GREDICE_PREVIEW_ALIAS_PREFIX?.trim();

  const prefixSlug = aliasPrefix ? sanitizeLabel(aliasPrefix) : "";
  if (aliasPrefix && !prefixSlug)
    throw new Error(`Alias prefix ${aliasPrefix} results in empty slug`);

  const maxBranchSlugLength = prefixSlug ? 63 - prefixSlug.length - 1 : 63;
  if (maxBranchSlugLength < 1)
    throw new Error(`Alias prefix ${aliasPrefix} is too long`);

  const branchSlug = sanitizeLabel(branch, maxBranchSlugLength);
  if (!branchSlug)
    throw new Error(`Branch name ${branch} results in empty slug`);

  const aliasName = prefixSlug ? `${prefixSlug}-${branchSlug}` : branchSlug;
  const aliasDomain = `${aliasName}.${previewDomain}`;
  console.log(`Aliasing ${deploymentUrl} to ${aliasDomain}`);
  writeGithubOutput("alias_domain", aliasDomain);

  const result = await run("vercel", [
    "alias",
    "set",
    deploymentUrl,
    aliasDomain,
    "--scope",
    scope,
    "--token",
    token,
  ]);

  if (result.code !== 0) {
    throw new Error(`vercel alias failed with exit code ${result.code}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
