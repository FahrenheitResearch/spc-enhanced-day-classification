# SPC Enhanced+ Day Classification

Interactive GitHub Pages dashboard for a classification of SPC Day 1 convective days that reached Enhanced-equivalent, Enhanced, Moderate, or High risk from 2009 through the archive available on 2026-05-25.

The page lets people inspect:

- primary storm-day classes
- OFB/MCS boundary regime labels (`core`, `likely`, `possible`, `none`)
- boundary drivers, storm modes, dominant hazards, and forecast challenges
- short evidence snippets linked back to SPC Day 1 Outlooks and Mesoscale Discussions
- organized SPC mesoanalysis map links/previews for each day
- per-day source packets with all attached outlook and MD links for audit/review
- shareable day links like `#day=2024-05-06`
- downloadable CSV/JSONL data and the classification schema

## Dataset

- Classified days: 1450
- Enhanced-equivalent: 480
- Enhanced: 665
- Moderate: 274
- High: 31
- Core or likely OFB/MCS boundary regime: 899

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
