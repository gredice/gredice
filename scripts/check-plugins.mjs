import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CANONICAL_MCP_URL = "https://api.gredice.com/api/mcp";
const EXPECTED_SKILLS = ["explore-plants", "plan-garden-cart", "review-garden"];
const SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function invariant(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function readJson(root, relativePath) {
	return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(root, relativePath) {
	return readFileSync(path.join(root, relativePath), "utf8");
}

function catalogToolNames(root) {
	const catalog = readText(root, "apps/api/app/api/mcp/catalog.ts");
	return new Set(
		[
			...catalog.matchAll(
				/name: '((?:directories|gardens|commerce)\/[a-z0-9-]+)'/gu,
			),
		].map((match) => match[1]),
	);
}

function validateSkill(root, skillName, knownTools) {
	const skillPath = `plugins/gredice/skills/${skillName}/SKILL.md`;
	const agentPath = `plugins/gredice/skills/${skillName}/agents/openai.yaml`;
	const skill = readText(root, skillPath);
	const agent = readText(root, agentPath);
	const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];

	invariant(
		frontmatter,
		`${skillPath} must start with closed YAML frontmatter`,
	);
	invariant(
		new RegExp(`^name: ${skillName}$`, "mu").test(frontmatter),
		`${skillPath} name must match its directory`,
	);
	invariant(
		/^description: \S.+$/mu.test(frontmatter),
		`${skillPath} needs a description`,
	);
	invariant(!skill.includes("[TODO:"), `${skillPath} contains a placeholder`);
	invariant(
		agent.includes(`default_prompt: "Use $${skillName}`),
		`${agentPath} default prompt must invoke $${skillName}`,
	);
	invariant(
		agent.includes(`url: "${CANONICAL_MCP_URL}"`),
		`${agentPath} must use the canonical MCP URL`,
	);
	invariant(
		agent.includes('transport: "streamable_http"'),
		`${agentPath} must declare Streamable HTTP`,
	);

	for (const tool of skill.match(
		/\b(?:directories|gardens|commerce)\/[a-z0-9-]+\b/gu,
	) ?? []) {
		invariant(
			knownTools.has(tool),
			`${skillPath} references unknown tool ${tool}`,
		);
	}
}

export function validatePluginPackage(
	root = path.resolve(fileURLToPath(new URL("..", import.meta.url))),
) {
	const codexManifest = readJson(
		root,
		"plugins/gredice/.codex-plugin/plugin.json",
	);
	const claudeManifest = readJson(
		root,
		"plugins/gredice/.claude-plugin/plugin.json",
	);
	const mcp = readJson(root, "plugins/gredice/.mcp.json");
	const codexMarketplace = readJson(root, ".agents/plugins/marketplace.json");
	const claudeMarketplace = readJson(root, ".claude-plugin/marketplace.json");
	const evals = readJson(root, "plugins/gredice/evals/openai-submission.json");
	const knownTools = catalogToolNames(root);

	invariant(
		codexManifest.name === "gredice",
		"Codex plugin name must be gredice",
	);
	invariant(
		claudeManifest.name === codexManifest.name,
		"Plugin names must match",
	);
	invariant(
		SEMVER.test(codexManifest.version),
		"Plugin version must use strict semver",
	);
	invariant(
		claudeManifest.version === codexManifest.version,
		"Plugin versions must match",
	);
	invariant(
		codexManifest.mcpServers === "./.mcp.json",
		"Codex must use shared MCP config",
	);
	invariant(
		claudeManifest.mcpServers === "./.mcp.json",
		"Claude must use shared MCP config",
	);

	const server = mcp.mcpServers?.gredice;
	invariant(server?.type === "http", "Gredice MCP server must use remote HTTP");
	invariant(
		server?.url === CANONICAL_MCP_URL,
		"Gredice MCP URL must be canonical",
	);

	for (const field of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
		invariant(
			codexManifest.interface?.[field]?.startsWith("https://"),
			`Codex interface ${field} must be an HTTPS URL`,
		);
	}
	invariant(
		Array.isArray(codexManifest.interface?.defaultPrompt) &&
			codexManifest.interface.defaultPrompt.length === 3 &&
			codexManifest.interface.defaultPrompt.every(
				(prompt) =>
					typeof prompt === "string" &&
					prompt.length > 0 &&
					prompt.length <= 128,
			),
		"Codex needs exactly three valid starter prompts",
	);
	for (const field of ["composerIcon", "logo"]) {
		const relativeAsset = codexManifest.interface?.[field];
		invariant(
			typeof relativeAsset === "string" &&
				relativeAsset.startsWith("./assets/") &&
				existsSync(path.join(root, "plugins/gredice", relativeAsset)),
			`Codex ${field} must point to a packaged asset`,
		);
	}

	const codexEntry = codexMarketplace.plugins?.find(
		(entry) => entry.name === "gredice",
	);
	invariant(
		codexEntry?.source?.path === "./plugins/gredice",
		"Codex marketplace path is invalid",
	);
	invariant(
		codexEntry?.policy?.installation === "AVAILABLE",
		"Codex install policy is missing",
	);
	invariant(
		codexEntry?.policy?.authentication === "ON_INSTALL",
		"Codex authentication policy is missing",
	);
	invariant(
		codexEntry?.category === "Productivity",
		"Codex category is missing",
	);

	const claudeEntry = claudeMarketplace.plugins?.find(
		(entry) => entry.name === "gredice",
	);
	invariant(
		claudeEntry?.source === "./plugins/gredice",
		"Claude marketplace path is invalid",
	);
	invariant(
		claudeEntry?.strict === true,
		"Claude marketplace must use strict mode",
	);

	invariant(
		evals.positive?.length === 5,
		"OpenAI submission needs five positive cases",
	);
	invariant(
		evals.negative?.length === 3,
		"OpenAI submission needs three negative cases",
	);
	const cases = [...evals.positive, ...evals.negative];
	invariant(
		new Set(cases.map((testCase) => testCase.id)).size === cases.length,
		"Plugin eval case IDs must be unique",
	);
	for (const testCase of cases) {
		for (const tool of [
			...(testCase.expectedTools ?? []),
			...(testCase.forbiddenTools ?? []),
		]) {
			invariant(
				knownTools.has(tool),
				`Eval ${testCase.id} references unknown tool ${tool}`,
			);
		}
	}

	for (const skillName of EXPECTED_SKILLS) {
		validateSkill(root, skillName, knownTools);
	}

	return {
		plugin: codexManifest.name,
		version: codexManifest.version,
		skills: EXPECTED_SKILLS.length,
		positiveCases: evals.positive.length,
		negativeCases: evals.negative.length,
	};
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const result = validatePluginPackage();
	console.log(
		`Plugin validation passed: ${result.plugin}@${result.version}, ${result.skills} skills, ${result.positiveCases} positive and ${result.negativeCases} negative cases.`,
	);
}
