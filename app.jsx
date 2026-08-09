const { useState, useEffect, useRef, useMemo } = React;

/* Hand-rolled icon set — no external icon package, avoids any
   CDN/module duplication issues. Same names/props used below. */
function Icon({ children, size = 20, color = "currentColor", strokeWidth = 2, style }) {
  return React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", style,
  }, children);
}
const ChevronLeft = (p) => <Icon {...p}><polyline points="15 18 9 12 15 6" /></Icon>;
const ChevronRight = (p) => <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>;
const Bookmark = (p) => <Icon {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></Icon>;
const BookmarkCheck = (p) => <Icon {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /><polyline points="9 10 11 12 15 8" /></Icon>;
const Search = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
const User = (p) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
const HomeIcon = (p) => <Icon {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
const BarChart3 = (p) => <Icon {...p}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></Icon>;
const RotateCcw = (p) => <Icon {...p}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-9.36L1 10" /></Icon>;
const Volume2 = (p) => <Icon {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></Icon>;
const Check = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
const X = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const Mic = (p) => <Icon {...p}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></Icon>;

/* =========================================================
   DESIGN TOKENS
   Gold is now reserved for: primary CTAs, progress states,
   and the streak number. Everything else is black / charcoal
   / warm white, per review.
========================================================= */
const T = {
  bg: "#0A0A0C",
  surface: "#131317",
  card: "#1B1B20",
  cardAlt: "#201F24",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  text: "#F0EEE8",
  textDim: "#96949C",
  textFaint: "#59575F",
  accent: "#C6A165",       // champagne — used sparingly now
  accentSoft: "rgba(198,161,101,0.10)",
  accentLine: "rgba(198,161,101,0.30)",
  good: "#7DAD8C",
  goodSoft: "rgba(125,173,140,0.13)",
  bad: "#C2716B",
  badSoft: "rgba(194,113,107,0.12)",
};

/* =========================================================
   MOCK CONTENT / PERSISTENCE LAYER
   Shaped like the eventual DB access pattern so swapping in
   real queries later is a matter of replacing these functions:
   User → Lesson → LessonWord → Word → Examples/Audio →
   PracticeAttempt → WordProgress → ReviewSchedule
   Nothing above this layer should know it's mock data.
========================================================= */

const CATEGORY_POOL = [
  "Everyday Communication", "Business", "Leadership", "Writing",
  "Conversation", "Public Speaking", "Critical Thinking",
];

// Word bank deliberately spans registers so "corporate speak"
// doesn't dominate a week — content engine should rotate
// categories, not just difficulty.
const WORD_BANK = [
  {
    id: "w1", word: "Pragmatic", pos: "adjective", ipa: "/præɡˈmætɪk/",
    difficulty: "Intermediate", category: "Business",
    definition: "Dealing with things sensibly, based on practical considerations rather than theory or ideals.",
    useWhen: "You want to describe an approach chosen because it works, not because it's ideal.",
    avoidWhen: "You simply mean \u201cgood\u201d or \u201ceffective\u201d — pragmatic is about method, not quality.",
    professionalExample: "We need a pragmatic approach to the timeline \u2014 it's slipping.",
    conversationExample: "Let's be pragmatic about this and just pick one.",
    commonMistake: "Don't use it as a stand-in for \u201cgood\u201d.",
    synonyms: ["practical", "sensible", "realistic"],
    fillBlank: { text: "We need a ___ approach before Friday.", answer: "pragmatic" },
    question: { prompt: "Which sentence uses \u201cpragmatic\u201d correctly?", options: [
      "She gave a pragmatic performance that moved everyone.",
      "He took a pragmatic view and cut the feature to hit the deadline.",
    ], correct: 1 },
  },
  {
    id: "w2", word: "Candid", pos: "adjective", ipa: "/ˈkændɪd/",
    difficulty: "Foundation", category: "Leadership",
    definition: "Truthful and straightforward, especially about something difficult.",
    useWhen: "You want to signal that honest, direct feedback is coming.",
    avoidWhen: "The moment calls for tact more than bluntness \u2014 candid can read as blunt.",
    professionalExample: "I'll be candid with you \u2014 this draft isn't ready yet.",
    conversationExample: "Can I be candid? I don't think that's the right call.",
    commonMistake: "Don't confuse with \u201ccandidate\u201d.",
    synonyms: ["frank", "honest", "direct"],
    fillBlank: { text: "I'll be ___ with you \u2014 this needs more work.", answer: "candid" },
    question: { prompt: "Which sentence uses \u201ccandid\u201d correctly?", options: [
      "The report was candid about the missed targets.",
      "She candid the meeting for 3pm.",
    ], correct: 0 },
  },
  {
    id: "w3", word: "Nuance", pos: "noun", ipa: "/ˈnjuːɑːns/",
    difficulty: "Advanced", category: "Writing",
    definition: "A subtle difference in meaning, tone, or feeling.",
    useWhen: "You're pointing out a small but meaningful distinction others might miss.",
    avoidWhen: "The difference you mean is actually large \u2014 nuance implies subtlety, not a major gap.",
    professionalExample: "There's a nuance between \u201cdelayed\u201d and \u201ccancelled\u201d that the email missed.",
    conversationExample: "I think you're missing a bit of nuance there.",
    commonMistake: "It's a noun, not a verb \u2014 avoid \u201cto nuance something.\u201d",
    synonyms: ["subtlety", "shade", "distinction"],
    fillBlank: { text: "The translation lost some of the original's ___.", answer: "nuance" },
    question: { prompt: "Which sentence uses \u201cnuance\u201d correctly?", options: [
      "We need to nuance the report by Friday.",
      "The translation lost some of the original's nuance.",
    ], correct: 1 },
  },
  {
    id: "w4", word: "Articulate", pos: "adjective", ipa: "/ɑːrˈtɪkjəleɪt/",
    difficulty: "Intermediate", category: "Public Speaking",
    definition: "Able to express ideas clearly and effectively.",
    useWhen: "You're describing someone who explains complex ideas in a way others can follow.",
    avoidWhen: "You just mean someone talks a lot \u2014 articulate is about clarity, not volume.",
    professionalExample: "She was articulate under pressure, even with the panel pushing back.",
    conversationExample: "He's always so articulate when he explains things.",
    commonMistake: "Don't use it to mean \u201celoquent in writing only\u201d \u2014 it applies to speech too.",
    synonyms: ["eloquent", "clear", "coherent"],
    fillBlank: { text: "She stayed ___ even when the panel pushed back.", answer: "articulate" },
    question: { prompt: "Which sentence uses \u201carticulate\u201d correctly?", options: [
      "He articulated the report to his desk before leaving.",
      "She gave an articulate answer that settled the debate.",
    ], correct: 1 },
  },
  {
    id: "w5", word: "Concise", pos: "adjective", ipa: "/kənˈsaɪs/",
    difficulty: "Foundation", category: "Writing",
    definition: "Giving information clearly, in few words.",
    useWhen: "You want writing or speech that covers what matters without padding.",
    avoidWhen: "You mean \u201cvague\u201d or \u201cincomplete\u201d \u2014 concise still means clear, just brief.",
    professionalExample: "Keep the summary concise \u2014 one paragraph, no more.",
    conversationExample: "Can you give me the concise version?",
    commonMistake: "Concise isn't just \u201cshort\u201d \u2014 a concise answer still covers what matters.",
    synonyms: ["brief", "succinct", "compact"],
    fillBlank: { text: "Keep the summary ___ \u2014 one paragraph is enough.", answer: "concise" },
    question: { prompt: "Which sentence uses \u201cconcise\u201d correctly?", options: [
      "His concise reply left out three key details nobody needed.",
      "She gave a concise summary that covered everything in two lines.",
    ], correct: 1 },
  },
  {
    id: "w6", word: "Diplomatic", pos: "adjective", ipa: "/ˌdɪpləˈmætɪk/",
    difficulty: "Intermediate", category: "Everyday Communication",
    definition: "Handling disagreement or sensitive situations tactfully, without causing offence.",
    useWhen: "You're navigating a disagreement and want to preserve the relationship.",
    avoidWhen: "You mean someone avoided the issue entirely \u2014 diplomatic still addresses it, just carefully.",
    professionalExample: "She was diplomatic about the missed deadline, but the point still landed.",
    conversationExample: "Try to be a bit more diplomatic with him \u2014 he's had a hard week.",
    commonMistake: "Diplomatic isn't the same as evasive \u2014 the message still gets delivered.",
    synonyms: ["tactful", "considerate", "measured"],
    fillBlank: { text: "Try to be more ___ when you raise it with him.", answer: "diplomatic" },
    question: { prompt: "Which sentence uses \u201cdiplomatic\u201d correctly?", options: [
      "He was diplomatic \u2014 he never mentioned the problem at all.",
      "She raised the issue diplomatically, without putting anyone on the defensive.",
    ], correct: 1 },
  },
];

function buildWeekLessons() {
  // Deterministic mock: 5 words per weekday Mon–Sat, drawn round-robin
  // from the bank so categories don't repeat back to back.
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
  let cursor = 0;
  return days.map((d) => {
    const words = [];
    for (let i = 0; i < 5 && cursor < WORD_BANK.length; i++) words.push(WORD_BANK[cursor++]);
    while (words.length < 5) words.push(WORD_BANK[words.length % WORD_BANK.length]);
    return { day: d, words };
  });
}
const WEEK_LESSONS = buildWeekLessons();

// today's index into WEEK_LESSONS — mocked as Friday (index 4)
const TODAY_INDEX = 4;

function getWeekState() {
  return WEEK_LESSONS.map((l, i) => ({
    day: l.day,
    status: i < TODAY_INDEX ? "done" : i === TODAY_INDEX ? "today" : "pending",
  })).concat([{ day: "SUN", status: "review" }]);
}

function getTodayLesson() {
  return WEEK_LESSONS[TODAY_INDEX];
}

function getWeekWordsSoFar() {
  return WEEK_LESSONS.slice(0, TODAY_INDEX + 1).flatMap((l) => l.words);
}

/* Encouragement — rotating, non-repeating within a session */
const ENCOURAGEMENT = {
  wordLearned: ["Good start, Michael.", "That one will come in handy.", "Noted \u2014 moving on."],
  practiceCorrect: ["Well used.", "Exactly right.", "That's the natural usage."],
  practiceComplete: ["Well done, Michael.", "Solid round of practice.", "You used the words correctly."],
  lessonComplete: ["Today's lesson is complete, Michael.", "Another day of steady progress.", "Strong session today, Michael."],
  weekComplete: ["You completed another week of learning.", "A full week, well spent.", "Consistency is compounding, Michael."],
};
function useEncouragement() {
  const used = useRef({});
  return (key) => {
    const pool = ENCOURAGEMENT[key] || ["Nice work."];
    const seen = used.current[key] || new Set();
    let choice = pool.find((m) => !seen.has(m));
    if (!choice) { seen.clear(); choice = pool[0]; }
    seen.add(choice);
    used.current[key] = seen;
    return choice;
  };
}

/* =========================================================
   PROVIDER STUBS
   Real implementations swap in behind these exact call
   shapes — nothing else in the UI changes.
========================================================= */
const SpeechProvider = {
  async synthesize({ text, accent = "british", speed = "normal" }) {
    await wait(500);
    return { audioUrl: null }; // swap for a real TTS adapter later
  },
  async scorePronunciation({ word, audioBlob }) {
    await wait(900);
    return { score: 88, feedback: "Good pronunciation. Slightly stronger stress on the middle syllable." };
  },
};
const AIProvider = {
  async evaluateSentence({ word, sentence }) {
    await wait(700);
    const lower = sentence.toLowerCase();
    const usesWord = lower.includes(word.word.toLowerCase());
    const longEnough = sentence.trim().split(/\s+/).length >= 4;
    const startsCapital = /^[A-Z]/.test(sentence.trim());
    const endsPunctuated = /[.!?]$/.test(sentence.trim());
    if (!usesWord) {
      return { isCorrect: false, naturalness: "incorrect", feedback: `Try including "${word.word}" itself so the usage is clear.` };
    }
    if (!longEnough) {
      return { isCorrect: false, naturalness: "awkward", feedback: "Good word choice \u2014 add a little more context so the meaning is unambiguous." };
    }
    const polish = !startsCapital || !endsPunctuated ? " Minor polish: capitalise the start and close with punctuation." : "";
    return { isCorrect: true, naturalness: "natural", feedback: `Good use of "${word.word}" \u2014 grammatically sound and natural in a professional context.${polish}` };
  },
};
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* =========================================================
   FONTS
========================================================= */
function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

/* =========================================================
   SHELL — real viewport, not a simulated phone frame.
   Centers and caps width on tablet/desktop; full-bleed on mobile.
========================================================= */
function AppShell({ children }) {
  return (
    <div style={{ background: T.bg, minHeight: "100dvh", width: "100%", display: "flex", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 480, minHeight: "100dvh", display: "flex", flexDirection: "column", position: "relative", background: T.bg }}>
        {children}
      </div>
    </div>
  );
}
function TopLabel({ children }) {
  return <div style={{ fontSize: 12.5, letterSpacing: "0.1em", color: T.textFaint, fontWeight: 600, textTransform: "uppercase" }}>{children}</div>;
}
function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? T.cardAlt : T.accent, color: disabled ? T.textFaint : "#181209",
      border: "none", borderRadius: 16, padding: "15px", fontSize: 15, fontWeight: 600,
      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      ...style,
    }}>
      {children}
    </button>
  );
}

function BottomNav({ active, onNav }) {
  const items = [
    { id: "home", icon: HomeIcon, label: "Home" },
    { id: "learn", icon: Search, label: "Learn" },
    { id: "review", icon: RotateCcw, label: "Review" },
    { id: "progress", icon: BarChart3, label: "Progress" },
    { id: "profile", icon: User, label: "Profile" },
  ];
  return (
    <div style={{
      display: "flex", justifyContent: "space-around", alignItems: "center",
      padding: "12px 4px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`,
      background: T.surface, flexShrink: 0,
    }}>
      {items.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => onNav(id)} style={{ background: "none", border: "none", padding: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <Icon size={20} color={active === id ? T.accent : T.textFaint} strokeWidth={1.75} />
          <span style={{ fontSize: 9.5, color: active === id ? T.accent : T.textFaint, fontWeight: 600 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* =========================================================
   HOME
========================================================= */
function HomeScreen({ onStart, onNav, weekState, streak, missedYesterday, onOpenSundayReview }) {
  const lesson = getTodayLesson();
  const doneCount = weekState.filter((d) => d.status === "done").length;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 22 }} />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px 0" }}>
        <TopLabel>Today &middot; Friday, 14 August</TopLabel>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 25, color: T.text, fontWeight: 500, margin: "8px 0 2px" }}>
          {missedYesterday ? "Your next lesson is ready." : "Your lesson is ready."}
        </div>
        {missedYesterday && (
          <div style={{ fontSize: 12.5, color: T.textFaint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Missed yesterday</div>
        )}

        <div style={{
          marginTop: 20, borderRadius: 26, padding: 24,
          background: T.card, border: `1px solid ${T.border}`, position: "relative",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: T.textDim }}>5 words &middot; 10 minutes</span>
            <span style={{ fontSize: 12.5, color: T.accent, fontWeight: 600 }}>{lesson.words[0].category}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {lesson.words.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: T.border }} />
            ))}
          </div>
          <PrimaryButton onClick={onStart}>Start today's lesson <ChevronRight size={17} /></PrimaryButton>
        </div>

        <div style={{ margin: "24px 2px 12px" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: T.accent, letterSpacing: "0.02em" }}>{streak} DAY STREAK</span>
          <div style={{ fontSize: 13, color: T.textFaint, marginTop: 3 }}>Keep your rhythm.</div>
        </div>

        <TopLabel>This week</TopLabel>
        <div style={{
          marginTop: 12, display: "flex", justifyContent: "space-between",
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 22, padding: "16px 10px", marginBottom: 10,
        }}>
          {weekState.map((day) => (
            <div
              key={day.day}
              onClick={day.status === "review" ? onOpenSundayReview : undefined}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: day.status === "review" ? "pointer" : "default" }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.06em", color: T.textFaint, fontWeight: 600 }}>{day.day}</div>
              <DayMark status={day.status} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: T.textFaint, margin: "0 2px 24px" }}>{doneCount} of 6 lessons complete this week &middot; tap Sunday for the weekly review</div>
      </div>
      <BottomNav active="home" onNav={onNav} />
    </div>
  );
}
function DayMark({ status }) {
  if (status === "done") return (
    <div style={{ width: 24, height: 24, borderRadius: "50%", background: T.accentSoft, border: `1px solid ${T.accentLine}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Check size={12} color={T.accent} strokeWidth={2.5} />
    </div>
  );
  if (status === "today") return <div style={{ width: 24, height: 24, borderRadius: "50%", background: T.accent }} />;
  if (status === "review") return <div style={{ width: 24, height: 24, borderRadius: "50%", border: `1.5px dashed ${T.textFaint}` }} />;
  return <div style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${T.border}` }} />;
}

/* =========================================================
   WORD SCREEN
========================================================= */
function WordScreen({ word, index, total, onNext, onPrev, saved, onToggleSave, onWordLearned }) {
  const [playing, setPlaying] = useState(false);
  const play = async (speed) => {
    setPlaying(true);
    await SpeechProvider.synthesize({ text: word.word, speed });
    setPlaying(false);
  };
  useEffect(() => { onWordLearned(); /* eslint-disable-next-line */ }, [word.id]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 22 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 6px" }}>
        <button onClick={onPrev} style={{ background: "none", border: "none", padding: 6, opacity: index === 0 ? 0.3 : 1 }}>
          <ChevronLeft size={20} color={T.textDim} />
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, background: i === index ? T.accent : i < index ? T.textFaint : T.border, transition: "all 0.25s" }} />
          ))}
        </div>
        <button onClick={() => onToggleSave(word.id)} style={{ background: "none", border: "none", padding: 6 }}>
          {saved ? <BookmarkCheck size={19} color={T.accent} /> : <Bookmark size={19} color={T.textDim} />}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "6px 24px 24px" }}>
        <div style={{ borderRadius: 26, padding: "30px 24px 22px", textAlign: "center", marginBottom: 20, background: T.card, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11.5, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 9, textTransform: "uppercase" }}>{word.pos} &middot; {word.difficulty} &middot; {word.category}</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 40, color: T.text, fontWeight: 500, marginBottom: 8, lineHeight: 1.05 }}>{word.word}</div>
          <div style={{ fontSize: 13.5, color: T.textDim, marginBottom: 18 }}>{word.ipa}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button onClick={() => play("normal")} style={{ display: "flex", alignItems: "center", gap: 7, background: playing ? T.accent : T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 14, padding: "9px 16px", color: playing ? "#181209" : T.text, fontSize: 13, fontWeight: 500 }}>
              <Volume2 size={15} /> {playing ? "Playing" : "Listen"}
            </button>
            <button onClick={() => play("slow")} style={{ background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 14, padding: "9px 16px", color: T.textDim, fontSize: 13, fontWeight: 500 }}>Slow</button>
          </div>
        </div>

        <Section label="Meaning" text={word.definition} />

        <TopLabel>Use it when</TopLabel>
        <p style={{ color: T.text, fontSize: 14.5, lineHeight: 1.55, margin: "8px 0 16px" }}>{word.useWhen}</p>
        <TopLabel>Avoid it when</TopLabel>
        <p style={{ color: T.textDim, fontSize: 14.5, lineHeight: 1.55, margin: "8px 0 20px" }}>{word.avoidWhen}</p>

        <TopLabel>Professional</TopLabel>
        <Quote>{word.professionalExample}</Quote>
        <TopLabel>Conversational</TopLabel>
        <Quote>{word.conversationExample}</Quote>

        <TopLabel>Related</TopLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0 22px" }}>
          {word.synonyms.map((s) => (
            <span key={s} style={{ fontSize: 13, color: T.text, background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 20, padding: "6px 13px" }}>{s}</span>
          ))}
        </div>

        <YourTurn word={word} />
      </div>

      <div style={{ padding: "12px 24px calc(20px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}` }}>
        <PrimaryButton onClick={onNext}>{index === total - 1 ? "Continue to practice" : "Next word"} <ChevronRight size={17} /></PrimaryButton>
      </div>
    </div>
  );
}
function Section({ label, text }) {
  return <div style={{ marginBottom: 18 }}><TopLabel>{label}</TopLabel><p style={{ color: T.text, fontSize: 15.5, lineHeight: 1.55, margin: "8px 0 0" }}>{text}</p></div>;
}
function Quote({ children }) {
  return <div style={{ borderLeft: `2px solid ${T.accentLine}`, paddingLeft: 14, margin: "10px 0 18px", color: T.textDim, fontSize: 14.5, fontStyle: "italic", lineHeight: 1.5 }}>\u201c{children}\u201d</div>;
}

function YourTurn({ word }) {
  const [filled, setFilled] = useState("");
  const [checked, setChecked] = useState(false);
  const [own, setOwn] = useState("");
  const isRight = filled.trim().toLowerCase() === word.fillBlank.answer.toLowerCase();
  const [before, after] = word.fillBlank.text.split("___");
  return (
    <div style={{ background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 20, padding: 20, marginBottom: 8 }}>
      <TopLabel>Your turn</TopLabel>
      <div style={{ fontSize: 14.5, color: T.text, lineHeight: 1.6, margin: "10px 0 12px" }}>
        {before}
        <input
          value={filled}
          onChange={(e) => { setFilled(e.target.value); setChecked(false); }}
          style={{
            width: 110, background: "transparent", border: "none", borderBottom: `1.5px solid ${checked ? (isRight ? T.good : T.bad) : T.accentLine}`,
            color: T.accent, fontSize: 14.5, fontWeight: 600, textAlign: "center", outline: "none", fontFamily: "inherit",
          }}
        />
        {after}
      </div>
      {!checked ? (
        <button onClick={() => setChecked(true)} disabled={!filled.trim()} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 14px", color: filled.trim() ? T.text : T.textFaint, fontSize: 13 }}>Check</button>
      ) : (
        <div style={{ fontSize: 13, color: isRight ? T.good : T.bad, marginBottom: 14 }}>{isRight ? "Correct." : `Not quite \u2014 the word is \u201c${word.fillBlank.answer}.\u201d`}</div>
      )}

      <div style={{ marginTop: 16 }}>
        <TopLabel>Write your own sentence</TopLabel>
        <textarea
          value={own} onChange={(e) => setOwn(e.target.value)}
          placeholder={`Use "${word.word}" naturally...`}
          style={{ marginTop: 8, width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, color: T.text, fontSize: 14, minHeight: 60, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   PRACTICE — quiz round + AI sentence coach
========================================================= */
function PracticeScreen({ words, onDone }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [sentence, setSentence] = useState("");
  const [assessing, setAssessing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isLast = i === words.length;
  const encourage = useEncouragement();

  const pick = (idx) => {
    if (revealed) return;
    setPicked(idx);
    setRevealed(true);
    setTimeout(() => { setRevealed(false); setPicked(null); setI((v) => v + 1); }, 900);
  };

  const submitSentence = async () => {
    if (!sentence.trim()) return;
    setAssessing(true);
    const result = await AIProvider.evaluateSentence({ word: words[words.length - 1], sentence });
    setFeedback(result);
    setAssessing(false);
  };

  if (isLast) {
    const w = words[words.length - 1];
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 24px calc(24px + env(safe-area-inset-bottom))" }}>
        <TopLabel>Sentence coach</TopLabel>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 23, color: T.text, margin: "10px 0 6px" }}>Use \u201c{w.word}\u201d in a sentence</div>
        <div style={{ fontSize: 13.5, color: T.textFaint, marginBottom: 20 }}>Write something you might actually say this week.</div>
        <textarea value={sentence} onChange={(e) => setSentence(e.target.value)} placeholder="Type your sentence..."
          style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, color: T.text, fontSize: 15, minHeight: 100, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        {assessing && <div style={{ marginTop: 16, fontSize: 13.5, color: T.textFaint }}>Assessing meaning, grammar and naturalness&hellip;</div>}
        {feedback && (
          <div style={{ marginTop: 16, background: feedback.isCorrect ? T.goodSoft : T.badSoft, border: `1px solid ${feedback.isCorrect ? T.good : T.bad}`, borderRadius: 16, padding: 16, fontSize: 14, color: T.text, lineHeight: 1.5 }}>
            {feedback.feedback}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {!feedback ? (
          <PrimaryButton onClick={submitSentence} disabled={assessing || !sentence.trim()}>{assessing ? "Assessing\u2026" : "Get feedback"}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => { encourage("practiceComplete"); onDone(); }}>Finish lesson</PrimaryButton>
        )}
      </div>
    );
  }

  const w = words[i];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 24px 24px" }}>
      <TopLabel>Question {i + 1} of {words.length}</TopLabel>
      <div style={{ fontSize: 16, color: T.text, lineHeight: 1.5, margin: "14px 0 24px" }}>{w.question.prompt}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {w.question.options.map((opt, idx) => {
          const isCorrect = idx === w.question.correct, isPicked = idx === picked;
          let bg = T.card, border = T.border, color = T.text;
          if (revealed && isPicked) { bg = isCorrect ? T.goodSoft : T.badSoft; border = isCorrect ? T.good : T.bad; }
          else if (revealed && isCorrect) { bg = T.goodSoft; border = T.good; }
          return (
            <button key={idx} onClick={() => pick(idx)} style={{ textAlign: "left", background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: "15px 16px", color, fontSize: 14.5, lineHeight: 1.45, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span>{opt}</span>
              {revealed && isPicked && (isCorrect ? <Check size={16} color={T.good} /> : <X size={16} color={T.bad} />)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   COMPLETION
========================================================= */
function CompletionScreen({ onHome, streak }) {
  const encourage = useEncouragement();
  const msg = useMemo(() => encourage("lessonComplete"), []); // eslint-disable-line
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 30px", textAlign: "center" }}>
      <div style={{ width: 84, height: 84, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: T.accentSoft, border: `1px solid ${T.accentLine}`, marginBottom: 24 }}>
        <Check size={34} color={T.accent} strokeWidth={2} />
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: T.text, marginBottom: 10 }}>Lesson complete</div>
      <div style={{ fontSize: 14.5, color: T.textDim, marginBottom: 26, lineHeight: 1.5 }}>{msg}</div>
      <div style={{ display: "flex", gap: 22, marginBottom: 38 }}>
        <Stat value="5" label="words" />
        <Stat value={String(streak)} label="streak" />
        <Stat value="86%" label="week" />
      </div>
      <PrimaryButton onClick={onHome} style={{ width: "auto", padding: "14px 34px" }}>Done</PrimaryButton>
    </div>
  );
}
function Stat({ value, label }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontFamily: "'Fraunces', serif", fontSize: 21, color: T.text }}>{value}</div><div style={{ fontSize: 10.5, color: T.textFaint, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>{label}</div></div>;
}

/* =========================================================
   SUNDAY WEEKLY REVIEW
========================================================= */
function SundayReviewScreen({ onNav }) {
  const [stage, setStage] = useState("intro"); // intro -> quiz -> done
  const [qi, setQi] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState(null);
  const words = getWeekWordsSoFar();
  const encourage = useEncouragement();

  if (stage === "intro") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "60px 26px 30px", textAlign: "center", alignItems: "center", justifyContent: "center" }}>
        <TopLabel>Sunday</TopLabel>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: T.text, margin: "10px 0 14px" }}>Weekly Review</div>
        <div style={{ fontSize: 15, color: T.textDim, marginBottom: 34, lineHeight: 1.55 }}>You learned {words.length} words this week. Let's see what you remember.</div>
        <PrimaryButton onClick={() => setStage("quiz")} style={{ width: "auto", padding: "14px 32px" }}>Begin review</PrimaryButton>
      </div>
    );
  }
  if (stage === "quiz") {
    if (qi >= words.length) {
      const retained = Math.max(1, words.length - 2);
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "60px 26px 30px", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <TopLabel>Week complete</TopLabel>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: T.text, margin: "10px 0 22px" }}>{encourage("weekComplete")}</div>
          <div style={{ display: "flex", gap: 26, marginBottom: 34 }}>
            <Stat value={String(words.length)} label="studied" />
            <Stat value={String(retained)} label="retained" />
            <Stat value={String(words.length - retained)} label="to revisit" />
          </div>
          <PrimaryButton onClick={() => onNav("home")} style={{ width: "auto", padding: "14px 32px" }}>Start next week</PrimaryButton>
        </div>
      );
    }
    const w = words[qi];
    const isCorrect = picked === w.question.correct;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 24px 24px" }}>
        <TopLabel>Recall {qi + 1} of {words.length}</TopLabel>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: T.text, margin: "12px 0 16px" }}>{w.word}</div>
        <div style={{ fontSize: 15, color: T.text, lineHeight: 1.5, marginBottom: 22 }}>{w.question.prompt}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {w.question.options.map((opt, idx) => {
            const correct = idx === w.question.correct, isPicked = idx === picked;
            let bg = T.card, border = T.border;
            if (revealed && isPicked) { bg = correct ? T.goodSoft : T.badSoft; border = correct ? T.good : T.bad; }
            else if (revealed && correct) { bg = T.goodSoft; border = T.good; }
            return (
              <button key={idx} onClick={() => { if (revealed) return; setPicked(idx); setRevealed(true); setTimeout(() => { setRevealed(false); setPicked(null); setQi((v) => v + 1); }, 800); }}
                style={{ textAlign: "left", background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: "15px 16px", color: T.text, fontSize: 14.5, lineHeight: 1.45 }}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

/* =========================================================
   REVIEW (spaced repetition queue)
========================================================= */
function ReviewScreen({ onNav }) {
  const due = WORD_BANK.slice(0, 3);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 22 }} />
      <div style={{ padding: "8px 24px 0", flex: 1, overflowY: "auto" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: T.text, marginBottom: 4 }}>Review queue</div>
        <div style={{ fontSize: 13.5, color: T.textFaint, marginBottom: 22 }}>{due.length} words are due for spaced review</div>
        {due.map((w) => (
          <div key={w.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: T.text }}>{w.word}</div>
              <div style={{ fontSize: 12.5, color: T.textFaint, marginTop: 2 }}>{w.category}</div>
            </div>
            <ChevronRight size={17} color={T.textFaint} />
          </div>
        ))}
      </div>
      <BottomNav active="review" onNav={onNav} />
    </div>
  );
}

/* =========================================================
   LEARN (search folds in here)
========================================================= */
function LearnScreen({ onNav }) {
  const [q, setQ] = useState("");
  const results = q.trim() ? WORD_BANK.filter((w) => w.word.toLowerCase().includes(q.toLowerCase())) : WORD_BANK;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 22 }} />
      <div style={{ padding: "8px 24px 0", flex: 1, overflowY: "auto" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: T.text, marginBottom: 16 }}>Learn</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 14px", marginBottom: 20 }}>
          <Search size={16} color={T.textFaint} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search words, meanings, categories"
            style={{ background: "none", border: "none", outline: "none", color: T.text, fontSize: 14, flex: 1, fontFamily: "inherit" }} />
        </div>
        {results.map((w) => (
          <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 4px", borderBottom: `1px solid ${T.border}` }}>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: T.text }}>{w.word}</div>
              <div style={{ fontSize: 12.5, color: T.textFaint, marginTop: 2 }}>{w.pos} &middot; {w.category}</div>
            </div>
            <span style={{ fontSize: 11.5, color: T.accent, border: `1px solid ${T.accentLine}`, borderRadius: 20, padding: "3px 9px" }}>{w.difficulty}</span>
          </div>
        ))}
      </div>
      <BottomNav active="learn" onNav={onNav} />
    </div>
  );
}

/* =========================================================
   PROGRESS
========================================================= */
function ProgressScreen({ onNav }) {
  const rows = [
    { l: "Words learned", v: "142" }, { l: "Words mastered", v: "97" },
    { l: "Longest streak", v: "23 days" }, { l: "Weekly consistency", v: "86%" },
    { l: "Pronunciation score", v: "91 / 100" },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 22 }} />
      <div style={{ padding: "8px 24px 0", flex: 1, overflowY: "auto" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: T.text, marginBottom: 22 }}>Your progress</div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 22, overflow: "hidden", marginBottom: 24 }}>
          {rows.map((r, idx) => (
            <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "16px 18px", borderBottom: idx < rows.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <span style={{ fontSize: 14, color: T.textDim }}>{r.l}</span>
              <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{r.v}</span>
            </div>
          ))}
        </div>
        <TopLabel>Strongest category</TopLabel>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: T.accent, margin: "10px 0 24px" }}>Business Communication</div>
      </div>
      <BottomNav active="progress" onNav={onNav} />
    </div>
  );
}

/* =========================================================
   PROFILE
========================================================= */
function ProfileScreen({ onNav }) {
  const rows = ["Preferred accent \u2014 British English", "Daily goal \u2014 10 minutes", "Notifications \u2014 On", "Notification time \u2014 08:00"];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 22 }} />
      <div style={{ padding: "8px 24px 0", flex: 1, overflowY: "auto" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: T.text, marginBottom: 4 }}>Michael</div>
        <div style={{ fontSize: 13.5, color: T.textFaint, marginBottom: 22 }}>Member since January</div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 22, overflow: "hidden" }}>
          {rows.map((r, idx) => (
            <div key={r} style={{ padding: "16px 18px", fontSize: 14, color: T.textDim, borderBottom: idx < rows.length - 1 ? `1px solid ${T.border}` : "none" }}>{r}</div>
          ))}
        </div>
      </div>
      <BottomNav active="profile" onNav={onNav} />
    </div>
  );
}

/* =========================================================
   ROOT
========================================================= */
function LexoraPrototype() {
  useFonts();
  const [screen, setScreen] = useState("home");
  const [wordIndex, setWordIndex] = useState(0);
  const [saved, setSaved] = useState({});
  const [streak, setStreak] = useState(6);
  const lesson = getTodayLesson();
  const weekState = getWeekState();
  const missedYesterday = false; // toggle to demo the no-guilt missed-day state

  const goLesson = () => { setWordIndex(0); setScreen("lesson"); };
  const nextWord = () => { if (wordIndex < lesson.words.length - 1) setWordIndex((v) => v + 1); else setScreen("practice"); };
  const prevWord = () => setWordIndex((v) => Math.max(0, v - 1));
  const toggleSave = (id) => setSaved((s) => ({ ...s, [id]: !s[id] }));
  const nav = (id) => {
    if (id === "home") setScreen("home");
    if (id === "learn") setScreen("learn");
    if (id === "review") setScreen("review");
    if (id === "progress") setScreen("progress");
    if (id === "profile") setScreen("profile");
  };
  const finishLesson = () => { setStreak((s) => s + 1); setScreen("completion"); };

  return (
    <AppShell>
      {screen === "home" && <HomeScreen onStart={goLesson} onNav={nav} weekState={weekState} streak={streak} missedYesterday={missedYesterday} onOpenSundayReview={() => setScreen("review-sunday")} />}
      {screen === "lesson" && (
        <WordScreen
          word={lesson.words[wordIndex]} index={wordIndex} total={lesson.words.length}
          onNext={nextWord} onPrev={prevWord}
          saved={!!saved[lesson.words[wordIndex].id]} onToggleSave={toggleSave}
          onWordLearned={() => {}}
        />
      )}
      {screen === "practice" && <PracticeScreen words={lesson.words} onDone={finishLesson} />}
      {screen === "completion" && <CompletionScreen onHome={() => setScreen("home")} streak={streak} />}
      {screen === "review-sunday" && <SundayReviewScreen onNav={nav} />}
      {screen === "review" && <ReviewScreen onNav={nav} />}
      {screen === "learn" && <LearnScreen onNav={nav} />}
      {screen === "progress" && <ProgressScreen onNav={nav} />}
      {screen === "profile" && <ProfileScreen onNav={nav} />}
    </AppShell>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(<LexoraPrototype />);
