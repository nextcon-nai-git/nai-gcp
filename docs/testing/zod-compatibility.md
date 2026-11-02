# Zod distribution upgrade and compatibility boundaries

The root dependency is Zod 4.6.7. Existing application contracts deliberately
continue to use the supported `zod/v3` entry point. This preserves their current
optional fields, defaults, record validation, inferred form values and error
classes while upgrading the installed distribution.

Schemas owned by Genkit flows and tools import `z` from `genkit`. Genkit 1.x
still uses Zod 3 internally and inspects schema classes with `instanceof` when
applying annotations. Using the SDK's own instance keeps those annotations and
optional wrappers intact. PGR and production contracts shared with client code
stay on the application instance and reach Genkit through the official
`zod-to-json-schema` converter, using the same strict conversion options as
Genkit. Their complete Zod validation remains in place locally after generation.
This boundary preserves JSON Schema constraints and avoids comparing recursive
schema class types from different installations. Genkit-specific annotations
belong to SDK-owned schemas; shared contracts carry explicit JSON Schema instead.

The form resolver is pinned to the Zod 3/4 compatible 5.9.2 release. Both trimmed
valid values and field-specific rejection paths are tested with the real nursing
attendance schema and resolver. Forms whose schemas supply defaults declare
separate input and output types. The shared field component forwards the
transformed output type to React Hook Form, preserving the distinction between
editable values and validated submission values.

## Security verification

Zod 4 still includes a Zod 3 compatibility implementation. Genkit also requires
three nested Zod 3 installations. Upgrading the root version alone does not
establish that these implementations are patched.

The version 2 dependency security manifest identifies all four reviewed Zod
installation paths, versions and exact source hashes, alongside the existing
extract-zip backport. Installation applies the reviewed backports;
the security check verifies them before the audit gate can recognize a reviewed
advisory. An unlisted nested installation, changed source, unexpected version or
new advisory must fail validation. Symlinked installations are rejected. The
fixed root Zod 4 implementation provides the reviewed v4 source for compatibility
distributions; both v4 source trees have fixed digests, and a separate auxiliary
Zod alias is no longer needed.

The audit report remains available with its original version-based findings.
Accepted backported findings must have matching, verified patch evidence; they
are not removed from the report.

## Regression coverage

`src/lib/zod-compatibility.test.ts` exercises:

- Existing application defaults and absent optional fields.
- The identity of the clinical tool's Genkit schema classes.
- Nested Genkit annotations through optional wrappers.
- Shared PGR evidence bounds in the emitted JSON Schema.
- Valid nursing form values and invalid field errors through the real resolver.

`src/lib/genkit-shared-contracts.test.ts` compares six complete PGR and production
JSON Schema contracts with fixtures captured from the original Zod 3.25.76
baseline. It exercises the real PGR and production boundaries, local refinements,
and Genkit action validation without a model request.

The dependency security tests separately cover the v3 and v4 entry points,
reviewed nested installations and rejection of unverified audit evidence.
