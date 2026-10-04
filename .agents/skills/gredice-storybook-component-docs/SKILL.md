---
name: gredice-storybook-component-docs
description: "Use for Gredice Storybook docs: stories, MDX, autodocs, @gredice/ui/shared components, states, accessibility, and reusable UI docs."
---

# Gredice Storybook Component Docs

## Overview

Make Storybook a useful component reference for contributors. Stories should show real Gredice usage, stable mock data, meaningful states, and clear source ownership.

## Current Storybook Shape

Primary files:

- App: `apps/storybook`.
- Story config: `apps/storybook/.storybook/main.ts`, `apps/storybook/.storybook/preview.tsx`, `apps/storybook/.storybook/themes.ts`.
- Intro MDX: `apps/storybook/stories/Introduction.mdx`.
- Story globs: `apps/storybook/stories/**/*.mdx` and `apps/storybook/stories/**/*.stories.@(ts|tsx)`.
- Public local domain: `https://storybook.dev.gredice.test`.

The project uses Storybook 10 with `@storybook/nextjs-vite`, addon docs, addon a11y, and addon MCP. `next/image` is mocked in Storybook.

## Story Placement

Place stories by source ownership:

- `packages/ui/...`: shared reusable components.
- `apps/www/...`: public site and content components.
- `apps/garden/...`: customer garden experience components.
- `apps/farm/...`: farm back-office components.
- `apps/app/...`: internal admin and operations components.

Use grouped titles such as:

```ts
title: 'packages/ui/Media/ImageGallery'
title: 'apps/www/Layout/PageHeader'
```

When changing a reusable UI component, add or update a Storybook story in the same change.

## Story Pattern

Prefer the existing TypeScript pattern:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Category/ComponentName',
    component: ComponentName,
    tags: ['autodocs'],
    args: {},
    parameters: {
        docs: {
            description: {
                component: 'One concrete sentence about product usage.',
            },
        },
    },
} satisfies Meta<typeof ComponentName>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

Use `render` only when the component needs surrounding layout, providers, or child composition. Keep mock data deterministic and local to the story file.

## Coverage Expectations

Cover states that matter for the component:

- Default.
- Loading.
- Empty or no data.
- Disabled.
- Error.
- Long content.
- Small viewport or constrained container when layout can break.
- Important variants and modes.
- Realistic visual media when the component displays products, plants, operations, gardens, or user avatars.

Do not make stories depend on live services, authentication, database state, real secrets, or current production data.

## Design And Accessibility

Follow `FRONTEND.md` and `DESIGN.md`:

- Reuse `@gredice/ui`, `@signalco/ui`, `@signalco/ui-primitives`, and established app components first.
- Keep examples close to real product usage rather than decoration.
- Include accessible labels and keyboard-reachable interactions.
- Avoid nested cards, oversized hero typography inside component examples, and one-note palettes.
- Keep text inside controls from overflowing at mobile and desktop widths.
- Use `layout: 'fullscreen'` only when the component naturally needs page width.

## Validation

Run targeted Storybook lint/build checks. If the story documents changed source from another workspace, also run that workspace's smallest relevant check. For visual confidence, start Storybook, inspect the changed story, and use screenshots when layout, responsive behavior, or visual state changed.
