# Printing payment slips (A5 · Epson LQ-310)

Every receipt (cash counter, invoice detail, public link `/r/<token>`) can be printed three ways.
All three render the same receipt snapshot as the PDF, SMS and app, so every copy shows identical figures.

| Option | Paper | Use with |
|---|---|---|
| **Print slip** (default) | **A5 portrait** (148 × 210 mm), one slip | any laser / inkjet printer |
| 2 copies on A4 | A4, office copy + parent copy with a cut line | laser / inkjet |
| **Dot-matrix (LQ-310)** | A5, 66 columns at 12 cpi, 49 lines | Epson LQ-310 driver or Windows *Generic / Text Only* |
| **Download .prn (ESC/P)** | A5, raw printer commands | Epson LQ-310 (fastest, printer fonts) |
| Download PDF | A5 | e-mail / WhatsApp / archive |

The cashier picks the counter's printer once in **ERP → Fees → Receive payment** (remembered in that browser).

## Epson LQ-310 setup

1. Install the Epson LQ-310 driver (or add a printer with the **Generic / Text Only** driver on the same port).
2. Paper: A5 cut sheets (or continuous form set to 8.27" page length). In *Printing Preferences* choose A5 / 148 × 210 mm, portrait.
3. **Browser printing:** click **Dot-matrix (LQ-310)** → choose the LQ-310 → margins *None/Minimum*, scale 100 %, headers & footers off.
4. **Raw ESC/P (recommended for speed):** click **Download .prn (ESC/P)**, then send it unchanged to the printer:
   - Windows (share the printer as `LQ310`): `copy /b receipt-KH-RCP-2026-000123.prn \\localhost\LQ310`
   - Linux / CUPS: `lp -d LQ310 -o raw receipt-KH-RCP-2026-000123.prn`

   The job resets the printer (`ESC @`), selects letter quality (`ESC x 1`), 12 cpi elite (`ESC M`),
   1/6" line spacing (`ESC 2`), a 49-line A5 page (`ESC C 49`), prints bold headings (`ESC E/F`) and ends with a form feed.

Impact printers in text mode cannot print Arabic or Tamil script, so the dot-matrix slip uses the
English names stored for the student and college. The A5 laser slip and the PDF show the Arabic college name.

Code: `src/lib/receiptText.js` (text + ESC/P), `src/lib/receiptPrint.js` (A5/A4 slip),
`supabase/functions/_shared/receiptPdf.ts` (PDF). Tests: `src/test/receiptDotMatrix.test.js`.
