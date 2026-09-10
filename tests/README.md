# Early Learner browser journey

This harness runs the real Lessons 1–15 flow in Chromium against either the local static server or the deployed GitHub Pages build. It uses a seeded random source, a fresh `Harness Child` profile, and a second profile for isolation checks.

```bash
npm install
python3 -m http.server 8000 --bind 0.0.0.0
node tests/early-learner-journey.spec.js
```

To audit the deployed build:

```bash
LEXORA_BASE_URL=https://michaelmade4more-oss.github.io/lexora node tests/early-learner-journey.spec.js
```

The run writes JSON and Markdown evidence to `tests/artifacts/`. A successful run must report **PASS**, with every step passing and progression eligibility remaining separate from completion.
