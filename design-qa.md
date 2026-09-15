# Aquarise — Deep Flow design QA

final result: passed

## Visual truth and evidence

- Selected target: the second displayed Product Design concept, `exec-46377dfb-290e-47cc-a548-bab74ce2fd84.png`; archived at `../artifacts/aquarise-product-design-20260916/selected-reference.png`.
- Source pixels: 1488 × 1056. Implementation CSS viewport: 1488 × 1056 (1473px content width after the native scrollbar), USD sample, 20 years, base scenario, collapsed cash flow.
- Full comparison: `http://127.0.0.1:8766/artifacts/aquarise-product-design-20260916/comparison.html`. Reference and live iframe were captured together in one browser screenshot, each displayed at 40% scale. Browser devicePixelRatio was 3; the browser capture API returned a normalized 1280 × 720 board image. The comparison uses matching CSS dimensions, not unnormalized raw device pixels.
- Focused report comparison: the same URL with `?focus=report`, with both report regions at 1:1 CSS scale. This was inspected for heading, select, money, metrics and cash-flow control typography.
- Responsive evidence: `responsive.html?width=390`, `?width=768`, and `?width=900` in the same artifact directory. The browser viewport override did not reliably resize an existing tab, so measured iframe viewports were used. Actual content widths were 375, 753 and 900px respectively; all had equal document scroll/client widths.
- Screenshot artifacts are the browser tool captures in the workflow session, including “最終同尺寸設計對照”, “檢查報告區文字與數值排版”, “複查手機比例數值顯示”, and “確認平板情境卡已恢復橫向閱讀”. The browser API did not expose a screenshot file export path; the URLs above reproduce the captured views.

## Findings and iteration history

1. P1/P2 first pass: scenario comparison was confined to the left column, the hero was too tall, sliders were below their values, report numbers were undersized, and inactive plot lines were too faint. Corrected layout, spacing, type sizing and line opacity; the later combined capture confirms the intended hierarchy and proportions.
2. P2 responsive pass: native number-input spinners clipped the ratio decimal digits. Removed spinner chrome and reserved sufficient numeric width. The final 390px capture shows `70.00` in full with the slider accessible.
3. P2 tablet pass: long HKD values squeezed scenario captions into vertical columns. At 601–1100px, amounts now occupy a second row. Verified at 768 and 900px with HKD values; captions and numbers remain readable.
4. Final combined and focused comparisons: no remaining actionable P0/P1/P2 visual findings.

## Required fidelity surfaces

- **Fonts and typography:** local Noto Serif TC 600 loads successfully; Chinese editorial headings, serif financial values and compact UI text follow the reference hierarchy. Negative and positive values retain their signs. Long HKD report values fit without wrapping.
- **Spacing and layout:** dark left exploration area, ivory right report, inline assumptions and full-width scenario row follow the reference. Mobile stacks the report below the interactive chart and retains all primary controls. Legacy tables are below the main experience.
- **Colors and tokens:** deep teal, cyan, ivory and muted red reproduce the reference balance. Positive values use semantic positive styling. Focus indicators remain visible.
- **Image quality:** generated WebP water textures supply the real imagery; the main asset supports a bounded WebGL ripple. The pale report motif is a separate raster. The existing Aquarise logo is preserved. Phosphor icons and their full MIT license are local assets. No generated screenshot is used as a functional interface.
- **Copy and content:** headline and report narrative follow the selected design. “息率情境” accurately names the low/base/high selection; fixed/yearly rate modes remain under settings. Existing financial risk text is retained.

## Intentional differences and P3 follow-up

- Plot curves use the original calculator's real projections, so their shape differs from illustrative curves in the generated image. Financial parity takes precedence over invented chart points.
- Editable number fields keep the original raw numeric format, without thousands separators. This preserves the existing input handlers and storage contract.
- The original supplied brand logo replaces the concept's generated approximation.
- Minor water-light placement, serif stroke weight and footer-motif placement differ from the generated reference; these are P3 polish only.

## Interaction and verification

- Verified keyboard ratio/year sliders; selected-year inspection remains independent of the projection term.
- Verified low/base/high selection and card synchronization, USD/HKD conversion, IRR visibility, advanced settings focus restoration, sample/clear actions and reload persistence.
- Expanded original detail section contains four tables and 80 sample rows. Water ripple is observable and stops after its bounded response.
- Console errors/warnings after the corrected fresh load: none observed.
- Independent financial, adapter, source-contract and snapshot results are recorded in the task artifact QA directory.
- Browser CSV click produced no console error; this browser did not expose the download event. CSV serialization/download behavior is covered by the unchanged-core regression harness. Actual printed PDF output and OS-level reduced-motion changes were not exercised; their guards and print lifecycle were source reviewed.

## Implementation checklist

- [x] Exact selected reference resolved and compared with rendered app.
- [x] Main and report image assets installed; local font and icon licenses retained.
- [x] Core interaction connected to original financial functions.
- [x] Responsive P2 issues corrected and recaptured.
- [x] No remaining actionable P0/P1/P2 visual findings.
