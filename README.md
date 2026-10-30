# Flip Light · Flip 红绿灯 — Pre-Purchase Deal Check (v2.0)

**v2.0 — Market Profiles:** the formula is universal; each market ships its own parameters.
Profiles: Palo Alto / Peninsula Luxury (reno ×1.40, sell-side 5%, systems warning line 40%, ARV stress −8%, +4 months, target = 9% of ARV),
San Jose Mid-Market (×1.00, 4%, 25%, −5%, +3, fixed $ target), East Bay Volume (×0.95, 4%, 25%, −5%, +3, fixed $),
US Generic (×0.80, 5%, 30%, −5%, +3, target = 8% of ARV). Switching a profile rescales renovation unit prices;
every field remains editable, and the agent's own historical numbers should override the pack.
ARV can be entered as conservative / base / optimistic — all three scenario profits are shown.

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
