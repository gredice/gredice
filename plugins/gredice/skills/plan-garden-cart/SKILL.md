---
name: plan-garden-cart
description: Find Gredice plant products, review the authenticated cart, and make exact user-approved cart additions, quantity changes, or removals. Use when a user asks to shop for garden plants, compare available products, prepare a cart, add a selected item, or update an existing Gredice cart item.
---

# Plan Garden Cart

Use Gredice commerce tools to move from product research to a precise cart
change while keeping recommendations and writes visibly separate.

## Workflow

1. Use `commerce/search-products` for a query or `commerce/get-products` for a
   bounded browse. Call `commerce/get-product` before a write when the selected
   product's identity, price, or description needs confirmation.
2. Use `commerce/get-cart` to establish current state. Omit user identifiers;
   Gredice derives the user and account from authorization.
3. If placement matters, use the read-only garden workflow to resolve the
   garden, raised bed, and field position from server-returned identifiers.
4. Present the exact product, quantity, placement, scheduled date, and expected
   cart effect before any inferred or multi-item change.
5. Treat a direct, unambiguous request to add or change one exact item as
   approval for that recoverable write. Otherwise wait for explicit approval.
6. Use `commerce/add-to-cart` for approved additions and
   `commerce/update-cart-item` for approved quantity changes. A quantity of
   zero removes the item and requires explicit confirmation that identifies it.
7. Report only the cart returned by the server after the write. If the call
   fails, say the cart is unchanged and offer a bounded retry.

## Guardrails

- Research, recommendations, and “prepare a cart” requests are read-only until
  the user approves an exact change.
- Never add substitutes, extra quantities, placement, or dates that the user
  did not approve. Ask a short question when more than one product matches.
- Never ask for or pass a token, account ID, or user ID. Use only identifiers
  returned by Gredice tools within the current authorized session.
- Do not claim checkout, payment, delivery, or purchase completion. The exposed
  tools manage cart state only.
- Treat removal as destructive even though the user may be able to add the
  product again; require fresh confirmation for the exact cart item.
