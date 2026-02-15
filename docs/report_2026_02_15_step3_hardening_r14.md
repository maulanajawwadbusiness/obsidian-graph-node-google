# Step 3 Hardening Run 14: parsedDocument.text Weight Policy Decision

Date: 2026-02-15
Scope: Evaluate whether preview adapter should trim parsedDocument.text.

## Evaluation

1. Current sample payload includes long `parsedDocument.text` and metadata.
2. Preview path uses canonical restore payload contract; preserving full parsed document keeps parity with saved-interface restore behavior.
3. Step 13 dynamic import already moved sample payload out of eager prompt bundle path into a separate chunk.

## Decision

- Keep full `parsedDocument.text` unchanged in adapter preview mode.
- Do not truncate or strip text in this hardening pass.

## Reason

- Preserves strict 1:1 restore semantics and avoids hidden divergence between preview and graph restore paths.
- Bundle concern is already mitigated by lazy chunk loading introduced in run 13.