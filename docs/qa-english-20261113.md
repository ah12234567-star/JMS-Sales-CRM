# English CRM audit — 13 November 2026

The historical PR #16 preview redirected to Vercel login. A signed-in administrator session was available on the current production deployment, so the live observations below concern production, not the historical preview. No quotation, customer, approval, archive, AI request or cost setting was submitted. The account language was restored to Arabic and the unsaved form closed.

## Observed in the browser

| Area | Result before this patch |
| --- | --- |
| Language switch | English saved and navigation captions changed; switching back restored Arabic and RTL. The open form's product value remained the Arabic business identifier. |
| Direction | `html.lang=en`, `html.dir=ltr`; computed modal and product-select direction were both LTR. |
| Quotation filters | Status, representative filter captions and main action translated. Real customer and representative names correctly retained their original text. |
| Quotation form | Product, printing, payment and dimension-unit choices translated. Bag handle choices remained تيشرت / بنانا / شريط; the strip-colour example was unmarked. |
| Validation | Adding an incomplete item displayed the English message “Complete the product, bag handle type, length, width, thickness, quantity and price before adding the item.” |
| Quotation cards | Return for review, convert, customer acceptance/cancellation, archive, manager approval and PDF buttons remained Arabic. Quotation number prefixes remained Arabic. |
| Dashboard | Greeting, date, task text, quick-action labels and visit-report activity labels were partly Arabic. |

## Changes

- Make the quotation assistant administrator-only. Guard mounting, dictation, analysis and asynchronous results, and remove the panel when the session loses administrator privileges. The quotation-parsing API rejects non-admin tokens before data/provider access and checks the current server account role/status for admin tokens.
- Retain existing administrator-only cost controls and pricing endpoint protection. Regression tests cover representative cost denial, server-side removal of private quote fields and representative saving at the agreed selling price.
- Translate bag-handle labels while preserving their stored Arabic values and handle-dependent form behaviour. Translate draft item captions/units and the strip-colour example.
- Translate quotation action buttons, PDF caption/tooltip and number prefixes, and dashboard greeting/date/task/quick-action/report labels. Use logical alignment for dashboard cards in LTR.
- Update asset URLs, including dynamically loaded assistant and visit-report scripts.

## Remaining audit items

These were observed but are not claimed fixed by this patch: Arabic product labels and stored weight/piece/currency suffixes on quotation cards; approval/rejection detail prefixes; older dashboard representative summaries and overdue-customer sentences. These need a typed display formatter so user-entered text is never changed by global replacements. A complete audit of other screens, mobile layout, an actual representative's signed-in session, and the final deployed build remains required. No external messages were sent.

## Automated validation

The suite includes a DOM test of English/Arabic handle options, preserved loop-handle selection, strip-colour visibility, draft-item captions, and LTR. Security tests cover representative/sales quotation-AI denial, a downgraded/disabled administrator token, and assistant removal on session downgrade. Run `npm test`, `npm run check:syntax`, and `npm run check:secrets`.
