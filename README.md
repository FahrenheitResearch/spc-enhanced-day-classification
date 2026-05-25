# SPC Enhanced+ Day Classification

Interactive GitHub Pages dashboard for a classification of SPC Day 1 convective days that reached Enhanced, Moderate, or High risk from the Enhanced-category start in late 2014 through the archive available on 2026-05-25.

The page lets people inspect:

- primary storm-day classes
- OFB/MCS boundary regime labels (`core`, `likely`, `possible`, `none`)
- boundary drivers, storm modes, dominant hazards, and forecast challenges
- short evidence snippets linked back to SPC Day 1 Outlooks and Mesoscale Discussions
- per-day source packets with all attached outlook and MD links for audit/review
- shareable day links like `#day=2024-05-06`
- downloadable CSV/JSONL data and the classification schema

## Dataset

- Classified days: 809
- Enhanced: 665
- Moderate: 133
- High: 11
- Core or likely OFB/MCS boundary regime: 419

## Files

- `data/all_classifications.csv`
- `data/all_classifications.jsonl`
- `data/classifications.json`
- `data/packets/YYYY-MM-DD.json`
- `data/ofb_mcs_boundary_cases.csv`
- `data/CLASSIFICATION_SCHEMA.md`
- `data/validation_summary.json`

## Method Note

This classifies the evidence in SPC forecast/outlook text and MDs. It does not verify whether model guidance handled each boundary correctly. The natural next step is comparing the `core` and `likely` OFB/MCS cases against radar and surface observations versus HRRR/RAP/HREF forecasts.
