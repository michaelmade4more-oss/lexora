# Lexora Early Learner Architecture Addendum

**Status:** Approved direction for prototyping; final curriculum, audio scripts, illustration system, rewards, offline caching, and compliance policies remain open for review.

**Applies to:** Child Profiles in the proposed Early Learner band, currently ages 3–5.

## 1. Purpose

This addendum extends the locked Adult / Parent / Child / Teacher architecture with the product rules required for a genuinely child-specific Early Learner experience. It does not replace the account, identity, parental-gate, billing, or teacher relationship model. It defines how the first child learning experience must behave and why it must not be treated as a reduced Adult Lexora interface.

The current Early Learner lesson content is a vertical-slice prototype used to validate interaction structure. Words, scripts, sequence, voice direction, illustrations, and curriculum outcomes are not final curriculum approval.

## 2. Product position

The Early Learner experience is an **audio-led lesson room**, not a miniature Adult Home or dashboard. Its primary job is to help a young child listen, notice, respond, and feel successful with minimal reading.

The experience must be recognisably Lexora through its colour tokens, restraint, clarity, and quality of interaction, while being distinct from Adult Lexora through scale, character, motion, voice, and picture-led choices.

## 3. Child-facing language

Early Learner interface copy must be short, concrete, and speakable. The product should not use account-management language as the child’s main framing.

| Avoid as primary child framing | Use instead |
|---|---|
| My learning space | Let’s play |
| Today’s little lesson | Let’s discover |
| Choose a profile | Pick who is learning, in the profile picker only |
| Keep your rhythm | You’re doing great |
| Progress overview | What we did |
| Lesson complete | Yay, you found it |
| Retry | Listen again |

Caregiver and owner settings may use more precise adult language outside the child session.

## 4. Early Learner lesson-room structure

The first vertical slice uses the following structural sequence:

```text
Child Profile enters session
  → Early Learner Home
      → one clear lesson invitation
      → child-specific lesson room
          1. Listen
          2. Notice / identify
          3. Tap a picture choice
          4. Receive immediate feedback
          5. Listen again when incorrect
          6. Continue when correct
          7. Celebrate completion
```

The lesson room must present **one primary action at a time**. Secondary actions must not be visually hidden below, behind, or outside the active choice area.

## 5. Choice and action visibility rule

Picture choices must be self-describing. Each choice should combine a large visual with a short spoken-friendly label where the label improves clarity. The interface must not rely on the child discovering that actions exist below two visual cards.

The required state order is:

| State | Visible elements |
|---|---|
| Before listening | Large audio button, short instruction, no answer choices yet |
| After listening | Picture choices, “Choose one” prompt, audio replay available |
| Incorrect choice | Selected card shows gentle retry state, explicit “Let’s listen again” message and visible **Listen again** action |
| Correct choice | Selected card shows green success state, explicit praise and visible **Keep going** action |
| Completion | Full-screen celebration, spoken or readable praise, clear return action |

No important action may be communicated only through animation. Motion supports meaning; it does not replace labels, focus, or a visible control.

### Answer-position variation

Correct answers must not consistently appear on the same side, in the same visual position, or with the same ordering pattern. Lesson authors must deliberately vary answer placement across activities and validate the answer key independently from the presentation order. This prevents a child from succeeding through position memorisation rather than listening, noticing, or understanding. Lesson 3 therefore places the correct **Small star** choice on the left, while earlier lessons are not a template for future answer order.

### Structured lesson specification

Every new lesson must begin with a machine-readable specification before its HTML is generated. The specification must define the lesson ID, sequence, track, title, learning target, spoken instruction, activity type, ordered choices, correct answer ID, correct answer position, audio assets, feedback states, completion copy, and forbidden ambiguous phrases. The generated interface must be validated against that specification before deployment. Lesson 4 is the first implementation of this format in `lessons/lesson-04-counting-1-3.spec.json`.

The complete curriculum direction is defined in `LEXORA-EARLY-LEARNER-CURRICULUM-MAP.md`. The first five lessons are a foundation unit covering listening, objects, concepts, and counting. Future work must proceed through deliberate units: Lessons 6–8 for sound attention and matching, Lessons 9–11 for rhyming and syllables, Lessons 12–15 for oral word blending, and Lesson 16 onward for initial sounds and early letter-sound work. Individual lessons must not be added as disconnected vocabulary screens without a defined strand, stage, objective, and readiness rationale.

### Non-reader choice rule

For the 3–5 Early Learner band, a picture-choice activity must not require reading to succeed. The spoken instruction and visual objects carry the learning task. Visible text labels are optional and should be hidden when they add noise or turn the activity into a reading test. Accessibility names, caregiver-facing semantics, and internal answer IDs must remain present even when the child-facing label is visually hidden. Lesson 2 follows this rule by presenting a ball and a star as visual choices, with the audio prompt **“Find the ball.”**

### Feedback attention cues

Feedback must guide the child’s eye and ear to the next action. On an incorrect choice, the lesson must play a short gentle retry cue, visibly reveal **Listen again**, and apply a brief nudge or pulse without making the mistake feel alarming. On a correct choice, the lesson must play a short success cue, visibly reveal **Keep going**, and apply a bounded pulse or lift animation to that button. These cues support attention but never replace the visible labels. All feedback motion must respect `prefers-reduced-motion`.

## 6. Audio model

Audio is a first-class interaction, not decoration. Every audio-led activity must provide:

- A large, fixed-size circular play control.
- A visible state label such as **Listen**, **Listening**, or **Listen again**.
- Replay after an incorrect answer.
- A mute or audio-off control that remains discoverable.
- A non-audio fallback for environments where speech synthesis or recorded audio cannot play.
- A future path to approved recorded curriculum audio and low-data caching.

The browser speech-synthesis implementation is a prototype fallback only. It is not the final Lexora voice, accent, or curriculum audio strategy.

## 7. Visual and motion direction

The Early Learner interface must use the established colour system but change the composition and interaction language:

- Large illustrated guide or object instead of text-heavy dashboard cards.
- Soft character motion, floating details, and gentle feedback animation.
- Large touch targets with generous separation.
- Rounded forms and clear visual grouping.
- Gold for discovery, play, active audio, and primary action.
- Gold Pale for friendly highlights and small celebratory moments.
- Green for correct, complete, and “you found it” states.
- Green Deep for calm success backgrounds.
- Danger only for gentle retry feedback; never use alarming error treatment for normal learning mistakes.

Motion must respect `prefers-reduced-motion`. A child must still understand the lesson when motion is disabled.

## 8. Header and navigation rule

The child session should not repeat a large Lexora brand lockup after the profile picker. Repeating the logo competes with the child’s identity and adds unnecessary visual weight.

The preferred child-session header is:

```text
[Switch profile / back]     [Child name] [Curated avatar]
            Let’s play
```

The profile picker remains the place where Lexora branding is most prominent. The child session prioritises orientation, emotional safety, and the active learning task.

### Progress feedback

The top lesson-room progress indicator represents **curriculum position**, not interaction state. In the five-lesson foundation slice, Lesson 1 shows 1 of 5 and 20%, Lesson 2 shows 2 of 5 and 40%, Lesson 3 shows 3 of 5 and 60%, Lesson 4 shows 4 of 5 and 80%, and Lesson 5 shows 5 of 5 and 100%. The value remains stable while a child listens, retries, answers, and celebrates within that lesson. In-lesson state is communicated through the visible audio label, choice states, retry cue, success cue, and Keep going animation. Mixing curriculum position with interaction progress makes the bar move at a different pace from the lesson and is prohibited.

## 9. Parent and safety boundaries

The child experience remains subordinate to the Adult account and Child Profile model:

- A child can enter their own learning session after profile selection.
- A child cannot reach billing, profile management, subscription, account deletion, teacher invitations, or owner settings.
- Exiting to profile selection is allowed; owner actions remain behind the parental gate.
- No photo uploads are introduced; curated avatars remain the default.
- Sibling data and parent-account information remain invisible in the child session.

## 10. Rewards and progress

Rewards should be expressed primarily through immediate, understandable moments: praise, animation, a star, a completed step, or a short celebration. Streaks and broader progress should not dominate the Early Learner lesson room.

The exact reward mechanics remain open. Before treating rewards as final, Lexora must define what is earned, how often, what a caregiver can see, and whether rewards can create pressure or confusion for young children.

## 11. Open decisions carried forward

The following remain explicitly open and must be resolved before the Early Learner experience is treated as final:

- Final age bands and approved curriculum tracks.
- Early Learner vocabulary, sequence, learning outcomes, and assessment method.
- Recorded audio voice direction, pronunciation, and language variants.
- Offline and low-data caching strategy for audio and illustrations.
- Child data inventory, NDPR handling, and Apple / Google child-directed declarations.
- Final reward and progress mechanics.
- Whether caregiver co-use is required for any Early Learner lesson or setup step.
- Final illustration, character, and animation system.
- Subscription entitlement for Child Profiles.

## 12. Build order after this addendum

### Curriculum Engine v1

The Early Learner curriculum now has a reusable engine foundation. `curriculum/lesson-schema.json` defines the required lesson contract, `curriculum/registry.json` defines the ordered curriculum spine, and `engine/curriculum-engine.js` renders specification-driven lesson states. The engine owns the listen, reveal, choice, incorrect, retry, correct, continue, completion, mute, and synthetic sound behaviours. A lesson page must provide a specification and mount the engine rather than copy another lesson’s HTML when it belongs to the engine-rendered curriculum.

Sound Attention 1 is the first engine-rendered lesson. It is defined in `lessons/engine/sound-attention-01.spec.json` and is available at `sound-attention-01.html`. Its objective is to match a heard chime to the same visual sound source. It is deliberately audio-led and hides child-facing text labels while retaining semantic labels for accessibility.

The recommended next sequence is:

1. Validate Curriculum Engine v1 with Sound Attention 1 and its companion activities.
2. Replace prototype synthetic sounds with an approved audio asset strategy.
3. Establish the reusable Early Learner visual and motion component set.
4. Connect registry order and readiness signals to the Early Learner Home.
5. Test with caregivers and children before expanding the curriculum.
6. Resolve offline, privacy, reward, and entitlement decisions before broadening the child product.
7. Template the approved child-safe interaction patterns for later age bands.

## 13. Architectural principle

> **Adult Lexora teaches through language and reflection. Early Learner Lexora teaches through listening, noticing, tapping, repeating, and celebrating.**

Both experiences belong to the same Lexora account architecture, but they must not share a single interface model merely for implementation convenience.
