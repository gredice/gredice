# Gredice plugin

This shared package prepares Gredice for installation in Codex, ChatGPT,
Claude, and other compatible agents. It conforms to
[Agent Plugins 1.0.0](https://agent-plugins.org) with portable root
`plugin.json` and `mcp.json` manifests, connects to the production Streamable
HTTP MCP endpoint, and bundles three focused workflows for plant research,
read-only garden review, and confirmed cart planning.

The root manifests are the portable core. The client-specific files are still
current distribution adapters, not unpublished legacy formats:

- OpenAI currently requires `.codex-plugin/plugin.json` for every ChatGPT and
  Codex plugin. The repository `.agents/plugins/marketplace.json` is the local
  source used to install and test the complete package before submission.
- Claude currently reads `.claude-plugin/plugin.json` and `.mcp.json`, while
  the repository `.claude-plugin/marketplace.json` supports local installation.

Portable clients discover the same skills from `skills/` and the same server
from root `mcp.json`; all manifests share one version and canonical endpoint.
Remove a client adapter only after that client's published installation and
submission documentation accepts the portable root format directly.

The package does not publish either marketplace listing. MCP discovery, public
directory data, and the published product catalog are available without
sign-in. Garden state and cart workflows require a compatible host
authorization flow; never paste bearer tokens into a conversation.

## Validate

From the repository root:

```sh
pnpm plugins:check
python3 /path/to/plugin-creator/scripts/validate_plugin.py plugins/gredice
python3 /path/to/skill-creator/scripts/quick_validate.py plugins/gredice/skills/explore-plants
python3 /path/to/skill-creator/scripts/quick_validate.py plugins/gredice/skills/review-garden
python3 /path/to/skill-creator/scripts/quick_validate.py plugins/gredice/skills/plan-garden-cart
claude plugin validate plugins/gredice --strict
claude plugin validate .claude-plugin/marketplace.json --strict
```

`pnpm plugins:check` validates the closed Agent Plugins 1.0.0 manifest shapes,
schema identifiers, fixed component locations, Streamable HTTP transport, and
alignment with the current OpenAI and Claude distribution adapters.

## Test from this repository

```sh
codex plugin marketplace add "$PWD"
codex plugin add gredice@personal

claude plugin marketplace add . --scope project
claude plugin install gredice@gredice --scope project
```

Restart or reload the host and open a fresh conversation after installation or
an update. The official publication checklist is in
[`docs/plugin-marketplaces.md`](../../docs/plugin-marketplaces.md).
