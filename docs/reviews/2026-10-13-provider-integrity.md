# Provider integrity review - 2026-10-13

## Verified finding

At base `b39d30e`, `src/app/providers/page.tsx` used the result of
`getConsolidatedProviders()` whenever the database list was absent or empty.
The helper imported embedded records and supplemented them with a hard-coded
clinic list. It also supplied inferred locations, professions and five-star
assessments. Those entries could be displayed while loading, after an empty
response or without a successful database read, as if they were operational
provider records.

## Correction

The compatibility helper now returns a fresh empty list. Embedded provider
records, their identifiers and inferred defaults no longer replace database
results through this path. Existing Firestore records are not read, deleted,
rewritten or assessed by this change. The screen's database-backed list remains
the authoritative path.

The regression tests reject importing embedded operational records, verify an
empty fallback and ensure that mutations to a previous result cannot leak into
subsequent calls. Test fixtures are fictional and contain no real identifiers.

## Validation boundary

Run the existing formatting, lint, TypeScript, unit/coverage, rules, build and
security checks on the final PR head before merging. Runtime publication and an
authenticated UI smoke check are separate from a successful merge. No production
provider registration, financial transaction or account provisioning is claimed
by this patch.

## Additional findings still requiring a separate fix

The following paths were identified in the provider page during this review;
this focused patch does not mark them as corrected:

- Delete failures can leave the row hidden optimistically and show a removal
  success message. Failed persistence must roll back the UI and report failure.
- A selected company includes providers without an explicit association. Review
  this against the authorized scope; missing association is not a confirmed
  service relationship.
- CSV import merges provider and user documents and supplies default assessment
  values. A provider import must not silently provision user records, overwrite
  verified data or fabricate evaluations. Validate the input and report partial
  outcomes accurately.
- Form defaults and other legacy presentation paths still need a full audit for
  inferred professional specialties and assessments. Operational service roles
  must remain distinct from registered medical specialties and RQE.

The review is not a declaration that all product flows are homologated. Test
coverage is a code-coverage metric, not a percentage of end-to-end acceptance.
