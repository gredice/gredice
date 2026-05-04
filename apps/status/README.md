# Gredice Status

Public status page for Gredice services. The app reads current monitor state from the Checkly Public API on the server side so the Checkly API key is never sent to the browser.

## Runtime environment

```bash
CHECKLY_API_KEY=
CHECKLY_ACCOUNT_ID=
CHECKLY_STATUS_TAG=gredice-status
```

`CHECKLY_ACCOUNT_ID` is optional when the API key only has one Checkly account. Set it explicitly if the key can access multiple accounts.

## Checkly checks

The Checkly account has API checks tagged with `gredice-status` for:

- `https://www.gredice.com/`
- `https://vrt.gredice.com/`
- `https://farma.gredice.com/`
- `https://app.gredice.com/`
- `https://storybook.gredice.com/`
- `https://api.gredice.com/`

Keep these as API checks on a 30-minute schedule. With 6 API checks this uses about 8,640 runs per 30-day month, which stays below the 10,000 included API checks. Browser checks are not used, so the status page uses 0 of the 1,000 included browser checks.

The public JSON feed is available at `/api/status`.
