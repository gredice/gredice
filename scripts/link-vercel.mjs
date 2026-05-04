#!/usr/bin/env node

// Links every app to its Vercel project in one go.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vercelCommand = "vercel";
const vercelTeam = "gredice";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const vercelProjects = [
	{ appName: "www", projectName: "www" },
	{ appName: "garden", projectName: "garden" },
	{ appName: "farm", projectName: "farm" },
	{ appName: "app", projectName: "app" },
	{ appName: "storybook", projectName: "storybook" },
	{ appName: "api", projectName: "api" },
];

function getSpawnOptions(command, args) {
	if (process.platform !== "win32") {
		return { command, args };
	}

	return {
		command: process.env.ComSpec ?? "cmd.exe",
		args: ["/d", "/s", "/c", [command, ...args].join(" ")],
	};
}

function run(command, args, options) {
	return new Promise((resolvePromise, rejectPromise) => {
		const spawnOptions = getSpawnOptions(command, args);
		const child = spawn(spawnOptions.command, spawnOptions.args, {
			...options,
			stdio: options?.stdio ?? "inherit",
		});

		child.on("error", (error) => {
			rejectPromise(error);
		});

		child.on("close", (code) => {
			resolvePromise(code ?? 1);
		});
	});
}

async function hasVercelCli() {
	const command = process.platform === "win32" ? "where.exe" : "which";
	const code = await run(command, [vercelCommand], {
		env: process.env,
		stdio: "ignore",
	});

	return code === 0;
}

async function main() {
	if (!(await hasVercelCli())) {
		console.error(
			"Vercel CLI was not found. Install it and make sure `vercel` is on PATH (for example, `pnpm add -Dw vercel` or `npm i -g vercel`).",
		);
		process.exit(1);
	}

	for (const { appName, projectName } of vercelProjects) {
		const cwd = resolve(repoRoot, "apps", appName);
		console.log(`\nLinking ${appName} to Vercel...`);

		const code = await run(
			vercelCommand,
			[
				"link",
				"--yes",
				"--non-interactive",
				"--team",
				vercelTeam,
				"--project",
				projectName,
			],
			{
				cwd,
				env: process.env,
			},
		);

		if (code !== 0) {
			console.error(`Vercel link failed for ${appName}.`);
			process.exit(code ?? 1);
		}
	}

	console.log("\nFinished linking all apps to Vercel.");
}

main().catch((error) => {
	if (error?.code === "ENOENT") {
		console.error(
			"A required command was not found. Make sure Vercel CLI is installed and available as `vercel` on PATH.",
		);
	} else if (error?.message) {
		console.error(error.message);
	} else if (error) {
		console.error(error);
	}

	process.exit(1);
});
