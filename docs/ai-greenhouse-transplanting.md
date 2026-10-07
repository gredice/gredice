# AI greenhouse transplanting advice

Suncokret chat reads greenhouse seedlings through `getRaisedBedFields`. Each
seedling remains associated with its destination raised bed and field while
growing in the greenhouse. The tool already returns `active`, `sowingLocation`,
`plantStatus`, sowing and sprouting dates, and removal flags. Photo analysis
receives the same lifecycle context with `currentLocation` and elapsed days
relative to the image analysis date.

Both system prompts explicitly consider greenhouse transplanting during care
advice and planning. Chat fetches relevant beds and fields, current weather,
forecast, existing operations, and available plant/sort guidance. Advice uses
development stage, sowing and sprouting dates, gardener notes, night
temperatures, and frost risk. Elapsed days or `sprouted` alone do not establish
readiness, and `ready` means harvest readiness. A raised-bed photo cannot
establish greenhouse seedling development; missing evidence leads to a
gardener check instead of an invented transplant date.

When the available evidence supports transplanting, chat offers the verified
catalog operation through `presentRecommendations` for the existing destination
bed and field. Photo analysis links the corresponding public operation and
uses an eligible scheduling date. Existing transplant work is considered to
avoid duplicate recommendations; photo context includes the internal field ID
to match operations to fields. Cart additions still require user approval.

This is advice during chat or photo analysis. It does not add a scheduled
readiness monitor or automatically order transplanting.
