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

The recommended next sequence is:

1. Refine the Early Learner lesson-room interaction model with two or three validated activities.
2. Replace speech-synthesis placeholders with an approved audio asset strategy.
3. Establish the reusable Early Learner visual and motion component set.
4. Build the Early Learner Home around a small number of clear lesson invitations.
5. Test with caregivers and children before expanding the curriculum.
6. Resolve offline, privacy, reward, and entitlement decisions before broadening the child product.
7. Template the approved child-safe interaction patterns for later age bands.

## 13. Architectural principle

> **Adult Lexora teaches through language and reflection. Early Learner Lexora teaches through listening, noticing, tapping, repeating, and celebrating.**

Both experiences belong to the same Lexora account architecture, but they must not share a single interface model merely for implementation convenience.
