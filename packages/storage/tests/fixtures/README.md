# Local CI catalogue

`ci-catalogue.json` is a bounded fixture derived on 2026-10-03 from published,
public directory attributes: 30 plants, 25 sorts and up to three entities from
the other public route families, plus their published references (138 entities
in total). It contains no accounts, gardens, orders,
credentials or private CMS drafts. Long prose is replaced with test copy where
possible; names, relationships, prices and calendar shapes exercise the normal
storage read model. Blob URLs deliberately exercise the local image guard.

`scripts/seedCiCatalogue.ts` seeds only a fresh loopback `gredice_ci` database
after migrations. Two synthetic news pages exercise production metadata and
revalidation tests. CI never exports or refreshes this fixture from a live
service. Extend it locally when a test needs another route or data shape.

These tests cover the bounded fixture catalogue, static hubs and route-family
unit checks. A changing live catalogue inventory requires separate, explicitly
bounded operational verification.
