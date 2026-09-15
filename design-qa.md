# Aquarise — layered bars and fluid motion QA

final result: passed

## Visual truth and evidence

The third displayed concept is the selected target: three horizontal scenario lanes on ivory, shared timeline, synchronized inspection and pale-water footer. `selected-reference.png` is1488×1056 pixels. `comparison-final.jpg` contains source and live1488×1056 CSS iframe together at40% scale; actual content width is1473px after its scrollbar. `report-final.jpg` compares report typography at1:1 scale. Evidence files are in `../artifacts/aquarise-bar-charts-20260916/` relative to the project.

Existing local serif headings, signed readouts, teal/amber chart components, fine separators and a genuine raster-water footer follow the selected direction. Original Deep Flow imagery, logo, fonts and icons remain. The previous accepted upper-layout QA is archived as `baseline/design-qa.md`.

## Corrected findings

1. Removed inherited three-column chart layout/card borders; increased desktop readout typography.
2. Corrected phone/tablet HKD overflow with full-width reports and full-width phone plots.
3. Preserved negative axis signs and measured tick widths for a safe gutter.
4. Kept inspected years local; corrected metric observer assignment, timer/frame cleanup and reduced-motion cancellation.
5. Corrected an existing wide-HKD upper-report overflow using a currency-specific stacked layout. USD remains unchanged.

No actionable P0/P1/P2 visual issue remained in the accepted checks.

## Verification

- HKD scroll/client widths matched at375,635,753,885 and1473px (390/650/768/900/1488px iframe targets); no report/summary overflow remained.
- Phone/tablet captures: `mobile-390-hkd.jpg`, `mobile-selection.jpg`, `tablet-900-hkd.jpg`.
- Native Home/End scrubber, chart ArrowRight and pointer selection synchronize all three reports while preserving upper report year and projection term. Shared-range Enter commits update all six existing range fields. Single-year and40-year bounds work; sample restoration works.
- Observed hero parallax, dialog/disclosure entrances and fully visible resting states. Escape restores settings-button focus; six metric targets track current values. Standalone local page console is clean.
- Independent `qa/final-qa-report.md`:8/8 financial/storage/CSV cases match;26/26 core functions unchanged; real chart/motion modules pass deterministic runtime checks;33/33 frozen hashes verified before and after. All production JS syntax passes. CRLF-aware Git whitespace check passes.

## Intentional differences and limits

Actual financial data determine geometry. The reference's illustrative fee110,258 is replaced by actual sample fee0, and input-based prose replaces market-average claims. The selected-year context adds modest vertical space; water placement and serif stroke weight differ slightly (P3 polish).

OS reduced-motion changes, physical touch hardware, printed PDF output and real browser bfcache timing were not exercised; source/lifecycle checks and stubs cover their guards. CSV serialization passes; no new file-download observation is claimed.

Scaled comparison fixtures emitted a browser-level MutationObserver message. Neither the outer page nor an instrumented iframe captured an application error; unscaled diagnostics and the standalone app remained functional, and the standalone console was clean. Its exact source remains unresolved and is recorded as a fixture limitation.

## Astra review

Selected reference, real diff, financial adapter, signed chart geometry, motion lifecycle, responsive captures and independent snapshot evidence reviewed. No auth, database, API, payment or customer-data changes. Only sample inputs used. Documentation is the only post-QA edit; runtime hashes remain the tested versions. Final acceptance and publication evidence are recorded in the local workflow artifacts.
