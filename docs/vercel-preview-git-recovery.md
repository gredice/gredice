# Recover a Vercel preview Git retrieval failure

`git_info_fail` means Vercel could not retrieve Git information for the
deployment. When its build-event endpoint is empty, investigate source retrieval
before changing dependencies or application code. A successful older preview
does not validate a pull request's current head.

## Farm incident, 12 October 2026

[PR #5327](https://github.com/gredice/gredice/pull/5327) updates dotenv to 18.0.6.
The Farm preview
[`dpl_8yMh1SapdqWGTfUnkcyidKyz3eEG`](https://vercel.com/gredice/farm/8yMh1SapdqWGTfUnkcyidKyz3eEG)
failed at `2026-10-12T05:42:55.354Z` with `errorCode=git_info_fail` and no build
events. Its Git source and the PR head both identify
`e0fa8dcf5a3bde0b403f6c342ee61769154ced6e` on `renovate/dotenv-18.x`.
Seven sibling app previews reached READY on that SHA; Status was skipped.
These observations do not establish a dotenv or Farm source defect. Vercel did
not expose the underlying retrieval error.

Evidence comes from the deployment metadata, GitHub checks, and the saved
review at
`/Users/aleks/.codex/automations/gredice-vercel-review/runs/2026-10-12/report.json`.
The review found no production incident. Keep the independent storage CI failure
separate: `CI - test @gredice/storage` failed in
`[legacy] active run rejects source address and slot mutations while keeping snapshots`
with `DeliveryRunAssignmentError` (`active-delivery-assignment-exists`).
Recovering the Farm preview does not resolve that check or establish merge
readiness for the dependency PR.

Redeploying the original Git preview without changing its commit recovered
validation:

| Evidence | Recovered result |
| --- | --- |
| Replacement | [`dpl_BLodPMyeqch1obEcAJKGH3CsaRLe`](https://vercel.com/gredice/farm/BLodPMyeqch1obEcAJKGH3CsaRLe) |
| Git source | `e0fa8dcf5a3bde0b403f6c342ee61769154ced6e`, `renovate/dotenv-18.x` |
| Environment | Farm preview; original deployment settings inherited |
| Vercel | READY at `2026-10-12T11:16:44.750Z`, `aliasError=null` |
| GitHub | `Vercel – farm` SUCCESS, linked to the replacement |
| HTTP smoke | `/` returned 200 with `Gredice Farm`, welcome text, and Google/Facebook/email sign-in controls |

The unchanged source succeeding on retry supports a transient Vercel/Git
retrieval problem; the original underlying provider error remains unknown.
No dependency, application code, environment configuration, or production
deployment was changed to recover this preview.

## Inspect the current head and failed source

Use existing authenticated GitHub and Vercel sessions. These commands target
the Gredice team and Farm project explicitly; they do not need environment
files or credentials copied into the repository.

```sh
pr_number=5327
team_id=team_QBex7AXLs3YNeyYGdMEPim4S
project_id=prj_fbD4Gez7mfI7brm5QgzEjFY8idX4
deployment_id=dpl_8yMh1SapdqWGTfUnkcyidKyz3eEG

gh pr view "$pr_number" --json state,headRefName,headRefOid,statusCheckRollup

vercel api "/v13/deployments/${deployment_id}?teamId=${team_id}&withGitRepoInfo=true" \
  --method GET | jq '{id,name,projectId,target,readyState,errorCode,gitSource}'

vercel inspect "$deployment_id" --scope gredice --logs --non-interactive
```

Before retrying, confirm `name=farm`, the expected `projectId`, a preview target,
and `gitSource.sha` equal to the current PR head. The REST API represents the
default preview target as `null`. If the branch has advanced, find the Farm
preview for the new head; rebuilding the old deployment would validate stale
source. If a deployment already exists for the current head, inspect it before
creating another.

The raw deployment API exposes `errorCode` and `gitSource` when a summarized
inspection does not. Check build events through the dashboard or
`GET /v3/deployments/{id}/events` if CLI logs do not explain the failure.
An access error is not evidence that events are absent.

## Retry the verified preview with its original Git source

The tested recovery uses Vercel's
[deployment creation API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
with the failed preview's `deploymentId`. It inherits that deployment's source,
settings, and environment; `withLatestCommit=false` preserves the inspected
commit, and `forceNew=1` requests a replacement deployment.

Run only after confirming the preview source above:

```sh
jq -n --arg deployment "$deployment_id" --arg project "$project_id" \
  '{name:"farm",project:$project,deploymentId:$deployment,withLatestCommit:false}' \
  | vercel api "/v13/deployments?teamId=${team_id}&forceNew=1" \
      --method POST --input - \
  | jq '{id,url,target,readyState,gitSource}'
```

The request omits `target` to inherit the verified preview environment. The
REST API rejects the literal `target:"preview"`; the CLI accepts that spelling
for `vercel redeploy <deployment-id> --target preview`. Do not substitute a
production deployment, promote the result, or upload a local checkout as a
replacement for Git source validation.

## Verify recovery

Read the replacement deployment's metadata until it reaches READY or a terminal
failure. Verify Farm, preview target, and the full Git SHA again, then re-read
the PR head to detect branch movement during the build. Check that GitHub's
`Vercel – farm` status is successful and links to the replacement.

Use authenticated access for the protected preview from an already linked Farm
directory. Confirm `vercel project inspect --non-interactive` reports
`gredice/farm` before the request:

```sh
vercel curl / --deployment <replacement-url> \
  -- --silent --show-error --output /dev/null --write-out '%{http_code}\n'
```

Inspect the response to confirm Farm serves its expected sign-in UI or redirect,
and distinguish application authentication from Vercel deployment protection.
This smoke check does not establish authenticated farmer workflow acceptance.

If retrieval fails again before build events, retain the current head, failed
and replacement deployment IDs, timestamps, and safe error metadata for Vercel
support. If the retry reaches the build and fails there, investigate those new
logs as a separate build failure. Record other CI failures independently.
