# SPC Enhanced+ Day Classification Schema

Scope: one record per SPC Day 1 convective day, where a convective day is
12Z-to-12Z and at least one Day 1 product carried ENH/MDT/HIGH or a
pre-Enhanced-era product met the later Enhanced-equivalent probability
threshold.

Use Day 1 outlook discussions for forecast intent and mesoscale discussions
for how the event evolved. Prefer the latest outlook when products conflict,
but preserve meaningful trend changes.

## Required JSONL Fields

- `convective_day`: `YYYY-MM-DD`.
- `max_risk`: `ENH_EQ`, `ENH`, `MDT`, or `HIGH`. `ENH_EQ` is used only for
  pre-Enhanced-era days whose Day 1 probabilities meet later Enhanced-equivalent
  thresholds while the official categorical product was still `SLGT`.
- `primary_class`: concise human-readable class.
- `secondary_classes`: 1-5 additional classes if needed.
- `tags`: 4-14 short tags from the taxonomy below or similarly specific tags.
- `boundary_drivers`: boundaries that focused convection or hazards.
- `storm_modes`: expected/observed storm modes.
- `dominant_hazards`: ordered list of main severe hazards.
- `ofb_mcs_boundary_regime`: one of `none`, `possible`, `likely`, `core`.
- `ofb_mcs_boundary_reason`: one sentence explaining the regime.
- `forecast_challenges`: list of uncertainty or failure-mode themes.
- `day_narrative`: 2-5 sentence synthesis of the day.
- `key_evidence`: 2-5 short evidence objects with `source`, `quote`, and `url`.
- `confidence`: `low`, `medium`, or `high`.

## OFB/MCS Boundary Regime

- `core`: prior/ongoing MCS, MCV, cold pool, outflow boundary, or effective
  boundary is central to the ENH+ risk placement, timing, mode, or hazard type.
- `likely`: outflow/MCS-modulated boundary clearly matters but shares control
  with synoptic/front/dryline forcing.
- `possible`: some outflow/MCS/boundary influence appears, but evidence is
  limited or secondary.
- `none`: no meaningful OFB/MCS-boundary control in the outlooks/MDs.

## Suggested Primary Classes

These are not exhaustive; make a new class if it better fits the evidence.

- `classic_discrete_tornadic_supercells`
- `high_end_tornado_outbreak`
- `mixed_discrete_to_qlcs_outbreak`
- `qlcs_bowing_wind_tornado`
- `forward_propagating_mcs_wind`
- `derecho_or_serial_mcs_wind`
- `mcv_mcs_outflow_reintensification`
- `ofb_differential_heating_supercells`
- `warm_front_baroclinic_tornado`
- `dryline_supercell_hail_tornado`
- `conditional_capped_supercells`
- `elevated_nocturnal_hail_mcs`
- `northwest_flow_mcs`
- `cold_core_low_cape`
- `high_plains_upslope_supercells`
- `southeast_multicell_or_clusters`
- `tropical_cyclone_tornado_rainbands`
- `multi_region_multi_mode`

## Tag Taxonomy

Boundary and mesoscale tags:

- `dryline`
- `cold_front`
- `pacific_front`
- `warm_front`
- `stationary_front`
- `prefrontal_trough`
- `outflow_boundary`
- `effective_boundary`
- `differential_heating_boundary`
- `remnant_mcv`
- `cold_pool`
- `sea_breeze`
- `upslope`
- `terrain_circulation`

Storm-mode tags:

- `discrete_supercells`
- `cyclic_supercells`
- `cluster_supercells`
- `mixed_mode`
- `qlcs`
- `bow_echo`
- `mcs`
- `derecho`
- `elevated_convection`
- `pulse_multicell`
- `training_convection`

Hazard tags:

- `strong_tornadoes`
- `violent_tornado_possible`
- `qlcs_tornadoes`
- `very_large_hail`
- `giant_hail`
- `significant_wind`
- `widespread_wind_damage`
- `flash_flood_overlap`

Forecast-challenge tags:

- `prior_convection`
- `ofb_placement`
- `instability_recovery`
- `cap_conditional`
- `mode_transition`
- `mcs_timing`
- `mcv_track`
- `boundary_interaction`
- `model_guidance_mismatch`
- `nocturnal_evolution`
- `moisture_quality`
- `storm_coverage_uncertain`

## Evidence Rules

Use short snippets only. Good evidence names the relevant boundary/mode/hazard,
for example: `D1 1630Z`, `D1 2000Z`, `MD 2024-0668`.

If Day 1 and MDs disagree, say so in `day_narrative` and lower confidence.
