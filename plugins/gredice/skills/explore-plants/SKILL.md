---
name: explore-plants
description: Research, compare, and choose plants using the Gredice Croatian plant directory and growing-calendar data. Use when a user asks about plants, varieties, sowing or harvest timing, plant choices, or garden-compatible options and wants evidence from Gredice.
---

# Explore Plants

Use Gredice directory tools to ground plant advice in the current catalog.

## Workflow

1. Identify the requested plant, category, comparison, or growing constraint.
   Ask only for missing information that would materially change the answer.
2. Start with `directories/get-plants`. Paginate when the requested comparison
   is broader than one response page and use the category filter when known.
3. When authorization is available, use `directories/search-entities` to find
   a named plant, then `directories/get-plant` for details and optional sorts.
   Use `directories/get-plant-sorts`, `directories/get-operations`, or
   `directories/get-seeds` only when that detail is relevant to the request.
4. Distinguish catalog facts from recommendations. State which constraints or
   tradeoffs produced a recommendation instead of presenting it as a fact.
5. Answer in the user's language. Preserve Croatian plant names from Gredice
   and add a translated or Latin name only when the tools return one.

## Guardrails

- Keep plant research read-only. Do not inspect a private garden or change a
  cart unless the user asks for that separate workflow.
- Do not invent planting dates, availability, prices, varieties, or tool
  results. Explain when the catalog lacks the requested detail.
- If authorization is unavailable, continue with `directories/get-plants`
  where possible. Ask the user to connect Gredice through the host for
  protected directory tools; never ask them to paste credentials into chat.
- Avoid treating general gardening guidance as a guarantee. Note material
  local conditions such as climate, soil, and exposure when they matter.
