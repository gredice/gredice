---
description: "Find and link related open issues on new pull requests"
engine: copilot

on:
  pull_request_target:
    types:
      - opened
      - reopened
      - synchronize
      - edited

if: >
  github.event.pull_request.user.login != 'copilot-swe-agent' &&
  needs.detect_linked_issues.outputs.has_linked_issues == 'false' &&
  needs.detect_linked_issues.outputs.already_processed == 'false'

checkout: false

permissions:
  contents: read
  issues: read
  pull-requests: read

concurrency:
  group: gh-aw-copilot-pr-issue-linker-${{ github.event.pull_request.number }}
  cancel-in-progress: true

tools:
  github:
    toolsets: [issues, pull_requests, search]

safe-outputs:
  report-failure-as-issue: false

  update-pull-request:
    title: false
    body: true
    footer: false
    max: 1
    target: "triggering"

  add-comment:
    discussions: false
    footer: false
    hide-older-comments: true
    max: 1
    target: "triggering"

jobs:
  detect_linked_issues:
    name: "Detect linked issues"
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: read
      pull-requests: read
    outputs:
      already_processed: ${{ steps.linked.outputs.already_processed }}
      has_linked_issues: ${{ steps.linked.outputs.has_linked_issues }}
    steps:
      - name: "Check linked issues"
        id: linked
        env:
          GH_TOKEN: ${{ github.token }}
          MARKER: "gh-aw-workflow-id: copilot-link-pr-issues"
          PR_NUMBER: ${{ github.event.pull_request.number }}
          REPOSITORY: ${{ github.repository }}
        run: |
          set -euo pipefail

          owner="${REPOSITORY%%/*}"
          repo="${REPOSITORY#*/}"

          pr="$(
            gh api graphql \
              -F owner="$owner" \
              -F repo="$repo" \
              -F number="$PR_NUMBER" \
              -f query='
                query ($owner: String!, $repo: String!, $number: Int!) {
                  repository(owner: $owner, name: $repo) {
                    pullRequest(number: $number) {
                      body
                      closingIssuesReferences(first: 1) {
                        totalCount
                      }
                    }
                  }
                }
              ' \
              --jq '.data.repository.pullRequest'
          )"
          linked_count="$(jq -r '.closingIssuesReferences.totalCount' <<< "$pr")"
          body_marker_count="$(jq --arg marker "$MARKER" -r 'if (.body // "") | contains($marker) then 1 else 0 end' <<< "$pr")"
          comment_marker_count="$(
            gh api --paginate "repos/$REPOSITORY/issues/$PR_NUMBER/comments?per_page=100" \
              --jq "[.[] | select(.body | contains(\"$MARKER\"))] | length" \
              | awk '{ total += $1 } END { print total + 0 }'
          )"

          if [ "$linked_count" -gt 0 ]; then
            echo "has_linked_issues=true" >> "$GITHUB_OUTPUT"
            echo "PR #$PR_NUMBER already has $linked_count linked issue(s)." >> "$GITHUB_STEP_SUMMARY"
          else
            echo "has_linked_issues=false" >> "$GITHUB_OUTPUT"
            echo "PR #$PR_NUMBER has no linked issues." >> "$GITHUB_STEP_SUMMARY"
          fi

          if [ "$body_marker_count" -gt 0 ] || [ "$comment_marker_count" -gt 0 ]; then
            echo "already_processed=true" >> "$GITHUB_OUTPUT"
            echo "PR #$PR_NUMBER already has output from this workflow." >> "$GITHUB_STEP_SUMMARY"
          else
            echo "already_processed=false" >> "$GITHUB_OUTPUT"
          fi
---

# Pull Request Issue Linker

You are checking pull request #${{ github.event.pull_request.number }} in `${{ github.repository }}`.

The deterministic pre-check has already confirmed that this pull request has no GitHub closing issue references. Your job is limited to pull request metadata.

Read the pull request title, body, changed files, and any available commit context. Search open issues in this repository for issues that clearly match the pull request's intent.

If one or more open issues clearly match:

- Use the `update_pull_request` safe-output tool exactly once.
- Append a short section to the pull request body.
- Use `Closes #123` only when the pull request fully resolves the issue.
- Use `Refs #123` when the issue is related but should not close when this pull request merges.

If there is no clear matching open issue:

- Use the `add_comment` safe-output tool exactly once.
- Leave one short comment saying no matching open issue was found.

Do not edit source files, push commits, create branches, assign agents, request reviews, or start another workflow.
