# Lexora Architecture Correction Report

## Status

The reusable lesson infrastructure has been corrected without authoring new lesson content. The current implementation now supports curriculum-aware renderers and source-aligned curriculum units. Existing content mismatches remain explicitly recorded and are not being hidden by metadata changes.

## Corrected architecture

Shared infrastructure remains responsible for progress persistence, profile isolation, lesson introduction and completion, learning evidence, replay and mute, audio fallback, retry feedback, accessibility, answer randomisation, and validation.

Curriculum units now select the child experience through an explicit `rendererId` contract:

| Unit | Approved range | Renderer | Defining child experience |
|---|---:|---|---|
| Foundation | 1–5 | `foundation` | Concrete spoken instruction and visual concept choice |
| Sound Attention | 6–8 | `sound-attention` | Hear, replay, compare, and identify sound sources or patterns |
| Rhyming and Syllables | 9–11 | `rhyming-syllables` | Spoken-word relationship or visible beat-unit interaction |
| Oral Blending | 12–15 | `oral-blending` | Separated sound or word-part bubbles visibly join before picture choice |
| Early Phonics | 16+ | `early-phonics` | Reserved contract for later sound-to-letter work |

The engine no longer treats `activity.type` as decorative metadata only. It loads the specification's curriculum renderer contract and produces unit-specific visual states while retaining common choice, retry, feedback, completion, and evidence services.

## Child Home data flow

Child Home now loads `lessons/engine/registry.json` and derives the next lesson title, lesson number, unit title, lesson count, and target route from the selected registry entry. It no longer maintains a separate lesson-title array.

When Child Home opens a lesson, it stores the expected lesson ID and renderer in session state. The lesson engine validates those values against the loaded specification and stops with an accessible alert if they disagree. This prevents Child Home from displaying one lesson while another lesson or renderer loads.

## Files changed

| File | Change |
|---|---|
| `engine/curriculum-engine.js` | Added curriculum-aware renderer branches, family-specific visual states, shared audio/fallback/retry/evidence behaviour, and identity validation. |
| `lessons/engine/registry.json` | Restored approved source boundaries 1–5, 6–8, 9–11, and 12–15; added unit and renderer contracts. |
| `lessons/engine/early-lesson-06..15.spec.json` | Added unit title, unit ID, renderer ID, and unit-specific metadata without inventing new lesson content. |
| `child-home-early.html` | Replaced duplicated lesson-title and route data with registry-driven metadata and expected-lesson identity state. |
| `tests/early-learner-journey.spec.js` | Updated asynchronous Child Home assertions for registry loading. |
| `tests/curriculum-renderer-audit.js` | Added browser checks for distinct renderer output and identity protection. |
| `validate_p0.py` | Added approved-unit and family-renderer validation. |

## Browser evidence

The local renderer audit passed:

```json
{"status":"PASS","evidence":[{"lesson":6,"unit":"sound-attention","renderer":"sound-attention","marker":1},{"lesson":9,"unit":"rhyming-and-syllables","renderer":"rhyming-syllables","marker":1},{"lesson":12,"unit":"oral-blending","renderer":"oral-blending","marker":1}],"identityGuard":"PASS"}
```

The full local persistence and interaction regression also passed:

```text
182 passed
0 failed
```

The checks covered Lesson 1–15 routing, positions, retry, replay, fallback, completion, learning evidence, profile isolation, and separate progression eligibility.

## Explicit interaction-contract correction

The renderer contract now contains both `rendererId` and an executable `interactionContract`. The engine uses `rendererId` as the authoritative renderer selector and rejects a specification that lacks an interaction contract. `activity.type` remains curriculum metadata and no longer selects the child interaction.

The approved contracts are:

| Renderer | Contract sequence | Response model |
|---|---|---|
| `sound-attention` | listen → replay/compare → identify sound source or pattern → feedback | sound identification |
| `rhyming-syllables` | hear spoken words → identify rhyme or show beat units → feedback | spoken-word or beat-unit response |
| `oral-blending` | hear separated parts → show parts joining → hear whole word → identify whole-word picture → feedback | whole-word picture |

The deployed browser audit passed after this correction. Renderer evidence passed for Lessons 6, 9, and 12, the identity guard passed, and the full Lessons 1–15 regression passed with **182 passed and 0 failed**.

## Remaining content blockers

Architecture correction does not make existing lesson content curriculum-correct. The following existing specifications require a later content-authoring decision:

| Lesson | Current content | Approved source unit | Issue |
|---:|---|---|---|
| 10 | Sound-pattern matching | Rhyming and Syllables | The current target is still sound attention rather than rhyme or syllable awareness. |
| 12 | Rhyme discrimination | Oral Blending | The current target is rhyme rather than separated sounds joining into a word. |
| 13 | Two-part syllable awareness | Oral Blending | The current target is syllable awareness rather than oral blending. |
| 14 | Three-part syllable discrimination | Oral Blending | The current target is syllable discrimination rather than oral blending. |

These are **content gaps**, not renderer or persistence failures. They should be resolved by rebuilding the affected lesson specifications and child experiences in a separately approved content phase. No new lesson content was invented in this architecture pass.

## Current conclusion

The technical foundation is now suitable for rebuilding content by approved curriculum unit. The next safe development sequence is:

1. Approve the corrected registry and renderer architecture.
2. Author or approve the correct content sequence for Lessons 9–11.
3. Rebuild and validate Lessons 9–11 using the Rhyming/Syllables renderer.
4. Author or approve the correct content sequence for Lessons 12–15.
5. Rebuild and validate Lessons 12–15 using the Oral Blending renderer.
6. Run the full Lessons 1–15 browser audit again.

No additional lessons should be added until the existing unit/content mismatches are resolved.
