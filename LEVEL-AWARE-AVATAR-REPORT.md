# Learning-Level-Aware Avatar Report

## Status

The existing three-step Add Child Profile flow remains intact. The avatar relationship is now data-driven: **learning level selects the character collection, and the parent selects an actual character from that collection**.

## Data structure

`assets/avatars/collections.json` defines the collection registry:

| Learning level | Collection ID | Current availability |
|---|---|---|
| Early Learner | `early-learner` | Available; eight supplied characters |
| Foundation | `foundation` | Reserved for future collection |
| Developing Reader | `developing-reader` | Reserved for future collection |
| Teen | `teen` | Reserved for future collection |

Each available collection points to its own manifest. The Early Learner manifest remains at `assets/avatars/early-learner/manifest.json`; future collections can be added without changing the profile data model.

## User flow

Step 1 retains the child name and explains that the learning level will determine the available characters. Step 2 retains the four existing learning-level cards. When a level is selected, the matching collection gently reveals below it. Early Learner displays the eight supplied characters. Future unavailable collections display an availability message and expose no Early Learner avatars. Step 3 previews the selected character and selected learning level before creation.

The selected avatar ID is stored with the profile as `avatar`, together with `ageBand`. A profile cannot be reviewed or created without a character belonging to the selected available collection. Existing profile-picker and Child Home display logic continues to use the stored avatar ID, preserving persistence and profile isolation.

## Validation

| Check | Result |
|---|---|
| Existing three-step structure preserved | PASS |
| Early Learner collection reveals after level selection | PASS |
| All eight Early Learner avatars selectable | PASS |
| Foundation does not expose Early Learner avatars | PASS |
| Developing Reader and Teen reserved cleanly | PASS |
| Review previews selected character | PASS |
| Mobile layout at 390px | PASS |
| Tablet layout at 768px | PASS |
| Existing Lessons 1–15 regression | PASS — 182 passed, 0 failed |
| Curriculum content and renderer architecture changed | NO |

## Deployment

Commit: `8448eca` — `Make profile avatars learning-level aware`

Live site: https://michaelmade4more-oss.github.io/lexora

The Lessons 9–15 content rebuild has not been started.
