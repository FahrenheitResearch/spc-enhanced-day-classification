# SPC Enhanced+ Day Classification

Interactive GitHub Pages dashboard for a classification of SPC Day 1 convective days that reached Enhanced-equivalent, Enhanced, Moderate, or High risk from 2009 through the archive available on 2026-05-25.

The page lets people inspect:

- primary storm-day classes
- OFB/MCS boundary regime labels (`core`, `likely`, `possible`, `none`)
- boundary drivers, storm modes, dominant hazards, and forecast challenges
- short evidence snippets linked back to SPC Day 1 Outlooks and Mesoscale Discussions
- organized SPC mesoanalysis map links/previews for each day
- observed tornado rows with UTC timing, +/-30 minute VWP windows, and the closest three current NEXRAD sites
- Meowdar archive links for observed tornado targets, using centered 3-frame loops at the target time
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
- Classified days with observed tornado radar targets: 1281
- Observed tornado target rows: 16227

## Files

- `data/all_classifications.csv`
- `data/all_classifications.jsonl`
- `data/classifications.json`
- `data/packets/YYYY-MM-DD.json`
- `data/ofb_mcs_boundary_cases.csv`
- `data/tornado_radar_summary.json`
- `data/tornado_radar_targets.csv`
- `data/tornado_targets/YYYY-MM-DD.json`
- `data/radar_sites.json`
- `data/CLASSIFICATION_SCHEMA.md`
- `data/validation_summary.json`

## Meowdar Links

Observed tornado targets launch Meowdar with a stable archive URL:

```text
https://fahrenheitresearch.github.io/meowdar-95/?site=KPAH&mode=archive&time=2021-12-11T02%3A54%3A00Z&frames=3&center=1&autoload=1&polar=1
```

The first radar chip opens the nearest current NEXRAD site, while the other
chips provide alternates. The day-level launch chooses the highest-impact
target by rating, casualties, and path length.

## Method Note

This classifies the evidence in SPC forecast/outlook text and MDs. Tornado/radar target rows are derived from SPC WCM actual tornado tracks for 2009-2024, latest NCEI Storm Events detail files plus SPC preliminary reports for recent 2026 days, and current NEXRAD site metadata. It does not verify whether model guidance handled each boundary correctly. The natural next step is comparing the `core` and `likely` OFB/MCS cases against radar and surface observations versus HRRR/RAP/HREF forecasts.
