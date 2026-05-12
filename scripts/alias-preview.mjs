#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";

const MAX_DNS_LABEL_LENGTH = 63;
const ALIAS_SEPARATOR_LENGTH = 1;
const MIN_BRANCH_SLUG_LENGTH = 1;
const MAX_ALIAS_PREFIX_LENGTH =
  MAX_DNS_LABEL_LENGTH - ALIAS_SEPARATOR_LENGTH - MIN_BRANCH_SLUG_LENGTH;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function sanitizeLabelValue(value) {
  return value
    .toLowerCase()
    .replace(/^refs\/heads\//, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeLabel(value, maxLength = MAX_DNS_LABEL_LENGTH) {
  const sanitized = sanitizeLabelValue(value);
  return sanitized.slice(0, maxLength).replace(/-+$/g, "");
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

  const prefixSlug = aliasPrefix ? sanitizeLabelValue(aliasPrefix) : "";
  if (aliasPrefix && !prefixSlug)
    throw new Error(
      `Alias prefix ${aliasPrefix} contains no valid DNS label characters after sanitization`,
    );

  if (prefixSlug.length > MAX_ALIAS_PREFIX_LENGTH)
    throw new Error(
      `Alias prefix ${aliasPrefix} sanitizes to ${prefixSlug} (length ${prefixSlug.length}), exceeding the maximum allowed length of ${MAX_ALIAS_PREFIX_LENGTH} characters`,
    );

  const maxBranchSlugLength = prefixSlug
    ? MAX_DNS_LABEL_LENGTH - prefixSlug.length - ALIAS_SEPARATOR_LENGTH
    : MAX_DNS_LABEL_LENGTH;

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
