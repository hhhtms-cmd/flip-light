# Flip Light · Flip 红绿灯 — Pre-Purchase Deal Check

Bilingual (中文 / English) static web tool that runs a flip underwriting check **before** signing:
ceiling ARV → itemised renovation → reverse max-bid price → stress tests → red/yellow/green verdict.

**Live case study preloaded:** 155 Lily Blossom Ct, San Jose, CA 95123.
Public record: purchased $1,160,000 (2026-04-29), sold $1,400,000 (2026-10-16, MLS #BE41146306).
Renovation and financing figures in the preset are estimates. The model projects **-$117,760**
at the actual purchase price — versus the ~$120K loss the investor reported.

## Use
- Open the page, edit any number, results update live.
- **Upload data**: a one-row CSV (see `sample-deal-lily-blossom.csv`) or a JSON object with the same keys fills the form.
- **Upload photos/files**: shown in the browser only. Nothing is uploaded to any server — this is a static site.
- **Download this deal CSV** saves your inputs so a deal file can be shared and re-loaded later.
- Language toggle (中文 / EN) in the top-right corner.

## Algorithm
1. ARV capped by renovated neighbourhood comps (never by hope).
2. Renovation priced line by line; invisible "system" items (roof, wiring, plumbing, HVAC) are flagged by market tier.
3. Max bid solved backwards: `ARV − renovation − transaction costs − holding interest − target profit`, grossed up for buy-side closing %.
4. Stress tests: sale price −5%, renovation +20%, hold +3 months, and all three combined.
