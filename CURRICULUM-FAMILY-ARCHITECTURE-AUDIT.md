# Lexora Early Learner Curriculum-Family Architecture Audit

**Status:** Architecture review only. No curriculum implementation changes are authorised by this report.

## Executive conclusion

The current implementation does not yet represent three distinct five-lesson curriculum families. Lessons 1–5 are a coherent foundation family at the curriculum level and use a consistent visual-choice experience. Lessons 6–10 are not a coherent second family: Lessons 6–8 belong to sound attention, while Lessons 9–10 begin the next phonological-awareness unit. Lessons 11–15 are also not a single source-defined family: they combine the remainder of rhyming and syllables with oral blending.

The source curriculum map defines units as **1–5, 6–8, 9–11, 12–15, and 16+**, not as 5-lesson blocks after the first unit. Therefore, the requested windows **6–10** and **11–15** cross source-defined curriculum boundaries. They should be treated as review windows for architecture planning, not as permission to invent new categories. The immediate architectural decision is whether the product should preserve the source unit boundaries or introduce explicit five-lesson families as a revised curriculum decision. That decision is not present in the Truth Protocol and must remain open.

The current engine also forces multiple curriculum categories through one generic interaction shell. Changing titles, words, sounds, or answer choices will not correct this. The engine needs family-aware activity renderers while preserving shared progress, evidence, audio-provider, retry, and fallback services.

## Source-of-truth curriculum map

| Source-defined lesson range | Curriculum unit/category | Primary strands | Intended interaction character |
|---|---|---|---|
| 1–5 | Listening, objects, concepts, and counting | Listening, vocabulary, concept knowledge | Audio-led concrete visual choice, with filled and recognisable objects or concepts |
| 6–8 | Sound attention and sound matching | Listening and attention, auditory discrimination | Hear, replay, compare, and match non-linguistic sounds or sound sources |
| 9–11 | Rhyming and syllables | Phonological awareness, oral language | Hear familiar spoken words, identify rhyme, and make word parts physically visible through clapping or beat cues |
| 12–15 | Oral word blending | Phonological awareness, oral blending, vocabulary | Hear separated spoken sounds or word parts, show them joining, then select the blended familiar-word picture |
| 16+ | Initial sounds and early letter-sound work | Phonological awareness, early phonics, vocabulary | Introduce taught sound-to-picture and later sound-to-letter relationships only when readiness supports them |

This map is taken from the approved curriculum map sections on the deliberate lesson sequence and lesson family definitions. It is the governing structure for the audit.

## Requested five-lesson review windows

### Lessons 1–5

| Audit field | Finding |
|---|---|
| Curriculum family/category | Foundation: listening, objects, concepts, and counting. This is a genuine source-defined family. |
| Primary learning purpose | Establish that listening leads to an understandable visual action while developing early vocabulary, concepts, and simple counting. |
| Difference from the previous family | Not applicable. This is the first family. |
| Core interaction pattern | Short spoken cue, large filled visual choices, one clear tap target, calm retry, and brief celebration. |
| Progression across five lessons | Feelings and object recognition lead into size, quantity, and familiar-animal recognition. The child moves from matching a named or shown concept to applying simple concepts across choices. |
| Learning evidence | Attention to the cue, target recognition, incorrect-response repair, correctness, replay, support level, and completion. The Truth Protocol requires completion to remain separate from mastery or readiness. |
| Preparation for the next family | It establishes listening stamina, response confidence, and the expectation that a spoken cue can guide an action. It does not yet establish auditory discrimination between non-linguistic sounds. |
| Does current implementation match? | **Mostly yes at the curriculum level.** Lessons 1–5 are separate legacy pages but share the intended concrete visual-choice pattern. Their implementation is not a reusable family renderer; the family is represented by copied page logic rather than an explicit family architecture. |

### Lessons 6–10

| Audit field | Finding |
|---|---|
| Curriculum family/category | **No single source-defined family.** Lessons 6–8 are Sound attention and sound matching. Lesson 9 is Rhyming and syllables. Lesson 10 is currently a sound-pattern consolidation screen in the new implementation, but it is still not defined as a source-approved replacement for the 9–11 boundary. |
| Primary learning purpose | The intended purpose across this review window is mixed: auditory attention and matching first, then phonological awareness. These are different learning purposes and should not be represented as one family without an explicit curriculum decision. |
| Difference from the previous family | Lessons 6–8 should differ from Lessons 1–5 by making the auditory contrast itself the target, not the visual object meaning. The child should listen, replay, compare, and match a sound source. Lessons 9–10 should differ again by asking the child to notice relationships between spoken words or sound patterns. |
| Core interaction pattern | Intended: sound cue → replay or mute fallback → sound-source or pattern comparison → matching response. Current: one generic engine template with an ear visual, listen button, shuffled two-choice buttons, generic fallback, retry, continue, and completion overlay. |
| Progression across five lessons | Source progression is only defined for 6–8: same sound or simple contrast, then more deliberate auditory discrimination. Lessons 9–11 should then move into familiar rhyme and syllable relationships. There is no source-defined progression for a 6–10 block as a single family. |
| Learning evidence | For 6–8: attention to cue, replay use, sound-match correctness, support, and response to contrast. For 9–10: rhyme or sound-pattern evidence is different and must record the relevant spoken-pattern target, not merely a generic correct answer. |
| Preparation for the next family | Sound attention should prepare the child to attend to similarities and differences in spoken words. It should not silently become rhyme instruction. |
| Does current implementation match? | **No.** The current pages for Lessons 6–10 are rendered by the same `LexoraCurriculumEngine.mount` flow. The engine varies specification data, but not the learning experience. The window also mixes source curriculum units. Lessons 6–8 do not have a distinct family renderer, and Lessons 9–10 are not architecturally separated from them. |

### Lessons 11–15

| Audit field | Finding |
|---|---|
| Curriculum family/category | **No single source-defined family.** Source Lessons 9–11 are Rhyming and syllables; source Lessons 12–15 are Oral word blending. The requested 11–15 window contains the end of one unit and all of the next. |
| Primary learning purpose | Mixed: Lessons 11–14 currently target rhyme and syllable awareness; Lesson 15 targets oral blending. Oral blending is a distinct next unit, not a small increase in the same interaction family. |
| Difference from the previous family | Intended rhyme/syllable work should add spoken-word comparison, rhyme relationships, clapping, and visible beat units. Intended oral blending should add separated sound or word-part tokens that visibly join before the child selects the whole-word picture. These are materially different from both the visual-choice foundation and sound-source matching. |
| Core interaction pattern | Current: the same generic engine shell used for Lessons 6–10. The specifications change `activity.type`, prompt, visuals, and synthetic target sound, but the rendered interaction remains listen → reveal two buttons → choose → retry or continue. No sound bubbles, beat pulses, joining animation, or family-specific response state exists. |
| Progression across five lessons | The current sequence is rhyme matching, rhyme discrimination, two-part syllable awareness, three-part syllable discrimination, then oral blending. This is a plausible developmental sequence only if treated as a cross-unit bridge, not as one family. The transition into blending is too abrupt in the current renderer because no blending-specific interaction is present. |
| Learning evidence | Rhyme evidence should record the spoken target and rhyme/non-rhyme discrimination. Syllable evidence should record beat count, clapping or tapping participation, and support. Blending evidence should record whether separated sounds were joined and whether the child selected the whole-word picture. A generic correctness event is insufficient to audit these distinctions. |
| Preparation for the next family | Rhyming and syllable awareness can prepare the child for oral blending. Oral blending then prepares the child for initial-sound and early phonics work. The UI should make those transitions observable rather than present all tasks as interchangeable choice screens. |
| Does current implementation match? | **No.** Lessons 11–15 exist, but they are specification variations on the same generic engine renderer. The current implementation does not render the defining behaviours of rhyme/syllable work or oral blending. It therefore does not establish Family 3 as a distinct experience. |

## Actual implementation findings

### Engine architecture

The engine entry point is `engine/curriculum-engine.js`. It loads a specification and renders one fixed structure: an ear or hero visual, a listen button, a generic audio label, one generic fallback message, shuffled two-choice buttons, a generic feedback area, a generic retry button, a generic continue button, and a completion overlay. The specification controls text, visuals, answer IDs, and target-sound strings. It does not select a family renderer or change the interaction state machine.

This means `activity.type` is descriptive data rather than executable architecture. `sound-match`, `rhyme-choice`, `syllable-awareness`, `syllable-discrimination`, `sound-pattern-match`, and `oral-blending` all receive substantially the same child interaction. This is the central architectural gap.

### Family and registry model

`lessons/engine/registry.json` now lists a 15-lesson spine, but its units are currently represented as foundation 1–5, sound attention 6–10, and rhyming/syllables 11–15. That grouping was introduced to satisfy the requested five-lesson windows, but it does not match the source map, which defines 6–8, 9–11, and 12–15. The registry therefore contains a curriculum decision that has not been approved by the Truth Protocol.

The registry also lacks a family-level renderer contract. It should not only list lesson IDs; it must identify the approved curriculum unit and the interaction renderer required by that unit.

### Child Home synchronisation

Child Home now displays a manually maintained `lessonTitles` array and a 15-lesson count. This is a synchronisation risk because the titles are duplicated in page code rather than derived from the authoritative registry or loaded lesson metadata. A title can therefore disagree with the lesson specification while the route and progress number remain correct.

The page also uses the progress number to select the next route, while the displayed title is selected from a separate array. The current implementation has no assertion that the selected title, route, registry entry, and loaded specification all refer to the same lesson.

### Legacy versus engine-rendered pages

Lessons 1–5 remain copied legacy pages with their own visual and audio event logic. Lessons 6–15 are engine-rendered pages that use one shared renderer. The product therefore has two implementation modes but no explicit family abstraction. This is why the first five lessons look like one interaction family while later curriculum categories collapse into one generic engine pattern.

### Audio and visual meaning

The audio-provider interface, mute behaviour, and visual fallback are present. Synthetic target sounds remain prototype audio, as required. However, an audio-provider success or failure result does not by itself establish that the correct curriculum interaction occurred. A rhyme lesson, syllable lesson, and blending lesson need distinct audio sequencing and visual state contracts even when they share the same provider.

## Required architecture change before rebuilding Lessons 6–10

The next implementation should not add more specification variants to the current renderer. It should introduce a family-aware activity architecture with shared services and distinct child experiences.

| Layer | Required change |
|---|---|
| Curriculum registry | Represent source-approved units separately: 1–5 foundation, 6–8 sound attention, 9–11 rhyming and syllables, 12–15 oral blending. Do not collapse these into five-lesson families without approval. |
| Family contract | Add an explicit family or unit contract containing the renderer ID, target evidence schema, required audio sequence, fallback behaviour, and child response type. |
| Renderer selection | Select a renderer from the approved family/unit contract, not only from free-form `activity.type` text. |
| Shared state services | Keep progress, completion, evidence, revisit, progression, profile isolation, randomisation, audio-provider, mute, and fallback services shared across renderers. |
| Sound-attention renderer | Implement replayable non-linguistic sound cues, source or pattern comparison, clear sound-specific feedback, and evidence for auditory discrimination. |
| Rhyme/syllable renderer | Implement familiar-picture rhyme comparison and visible beat or clap units. Rhyme and syllable tasks may share supporting primitives but must have distinct target contracts. |
| Oral-blending renderer | Implement separated sound or word-part tokens, a visible joining sequence, blended audio, and picture selection after the join. No letters are required. |
| Child Home metadata | Derive displayed title, lesson number, family label, and route from one authoritative lesson registry or metadata payload. Add a consistency check between Child Home and the lesson page. |
| Browser audit | Add family-specific assertions. A generic “two choices appeared” test is not enough to prove sound matching, syllable beats, or oral blending. |

## Decisions that remain open

The Truth Protocol does not currently define a five-lesson family boundary for 6–10 or 11–15. It defines curriculum units that cross those windows. Before implementation resumes, approve one of these directions:

| Decision | Consequence |
|---|---|
| Preserve source unit boundaries | Rebuild 6–8, then 9–11, then 12–15 as distinct units. This is the option most faithful to the current curriculum map. |
| Adopt five-lesson families | Define and approve the missing family boundaries and learning purposes explicitly before coding. Do not infer them from lesson numbers alone. |

Until this decision is made, Lessons 10–15 should not be treated as validated curriculum families. The existing implementation can be retained as a prototype reference, but it should not be extended.

## References

[1]: /home/ubuntu/upload/Lexora_Early_Learner_Curriculum_Map(1).md "Lexora Early Learner Curriculum Map"

[2]: /home/ubuntu/lexora_repo/lessons/engine/registry.json "Current Lexora lesson registry"

[3]: /home/ubuntu/lexora_repo/engine/curriculum-engine.js "Current Lexora curriculum engine"

[4]: /home/ubuntu/lexora_repo/child-home-early.html "Current Lexora Early Learner Child Home"
