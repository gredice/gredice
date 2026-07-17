---
name: gredice-review-changelog-post
description: "Review and prepare individual Gredice CMS changelog posts through the admin UI: simplify Croatian public copy, add relevant inline links, create and attach sharp privacy-safe screenshots or visuals, validate metadata and cover rendering, and move drafts to review without publishing. Use when given a Gredice /admin/cms/pages/PAGE_ID/edit URL or asked to polish, illustrate, link, or mark a changelog post ready for review."
---

# Gredice Changelog Post Review

## Overview

Prepare one existing changelog post for editorial review. Work from the exact CMS page and the real user-facing feature, keep the copy public and non-technical, attach a meaningful sharp cover, and stop before publication.

Use this together with `gredice-changelog-publishing` for general changelog conventions and an authenticated browser-control skill for CMS and live-page interactions.

## Workflow

### 1. Inspect the exact post

- Open the supplied `/admin/cms/pages/<id>/edit` URL; do not substitute another post.
- Confirm `Vrsta sadržaja` is `Changelog zapis`.
- Record the title, slug, state, publication date, tags, body, meta description, cover, and readiness result.
- Treat the CMS UI as the current source of truth. Preserve unrelated fields and existing user edits.
- Do not edit an already published post unless the user explicitly requests it.

### 2. Review the public copy

- Write Croatian unless the user requests another language.
- Explain the visible change and its user benefit in one or two short paragraphs.
- Remove PR numbers, package or branch names, implementation details, internal terminology, and administration-only context.
- Replace technical phrases with ordinary customer language while preserving factual constraints.
- Keep the title concise and the meta description specific, human-readable, and at most 160 characters.
- Do not add `Što je novo`, `Kome je namijenjeno`, or `Datum izdanja` sections. Avoid bullets unless requested.

### 3. Add relevant links

- Scan the title, body, and meta context for named public pages, features, guides, or products.
- Link the first meaningful mention with descriptive anchor text. Prefer the authoritative public URL and verify it resolves before saving.
- Do not link generic words, admin routes, PRs, or the same destination repeatedly.
- For a `MarkdownBlock`, use normal Markdown syntax, for example:

```markdown
Na stranici [Dostava](https://www.gredice.com/dostava) možete pregledati područje dostave.
```

- Use `JSON fallback` when precise Markdown editing is safer. Preserve the existing section shape and change only the intended `markdown` value. Return to the visual editor and verify the anchor text and `href` are rendered correctly.

### 4. Create a meaningful cover

- Capture the live user-facing feature or page described by the post, not the admin editor.
- Protect privacy before composition. Prefer public pages, public demo content, mock data, or a neutral empty state over authenticated live account, farm, garden, delivery, or admin data.
- Inspect the entire intended frame for names, initials, avatars, email addresses, phone numbers, delivery addresses, order or customer identifiers, exact locations, private garden state, internal notes, and operational details. Reframe or choose another source if any appear.
- Do not attach a screenshot while personal or sensitive information is visible. Prefer a clean source or crop over post-capture blurring; if neither is possible, omit the screenshot and report the blocker.
- Wait for maps, canvases, data, and other interactive content to finish loading.
- Frame the changed UI and enough context to understand it. Keep legends and meaningful labels; exclude clipped captions, browser chrome, and unrelated page content.
- Prefer a landscape image suitable for changelog cards. Capture at least 1200 pixels wide when the source supports it.
- For a high-density browser capture, use a wide desktop viewport and a 2x screenshot scale when supported. Reset temporary viewport overrides afterward.
- Prefer PNG for crisp UI. If transfer size is unreliable, use JPEG quality 90-92 while retaining the high pixel dimensions.
- Reuse an existing accurate asset when it is stronger than a screenshot. Do not invent a generic illustration when the real feature can be shown.

Attach the result as `Naslovna slika`, not `SEO slika`, unless the user explicitly asks for a custom SEO image. If direct Chrome file upload is unavailable, use the CMS image dialog's clipboard-paste path.

### 5. Save and validate

- Wait until `Nespremljene promjene` disappears after every content or image mutation.
- Confirm the body, meta description, tags, slug, publication date, and cover remain correct.
- Visually recheck the final uploaded cover for personal or sensitive information, including content that may have appeared after loading.
- Verify the cover URL changed and inspect its natural dimensions; reject a blurry or unexpectedly small result.
- Verify each Markdown link in the visual editor by its anchor text and destination.
- Confirm the readiness checklist remains complete, normally `9/9`.

### 6. Move to review

- Mark the post for review only when the user requests it and all prior checks pass.
- Click `Označi za pregled`, wait for the transition to finish, and verify `Vrati u izradu` appears. This is the authoritative UI signal that the post is in review.
- If the post is already in review, keep it there after edits and do not repeat the transition.
- Never click `Objavi` unless the user explicitly requests publication.

## Completion report

Report the CMS page ID or edit URL, the copy or metadata changed, links added, cover dimensions when applicable, and the final state. State explicitly that the post remains unpublished unless publication was requested and verified.
