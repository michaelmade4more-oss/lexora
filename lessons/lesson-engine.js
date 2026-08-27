/*
  Lexora Lesson Engine
  --------------------
  Determines which lesson-day a user should see, based purely on the
  real calendar date (Africa/Lagos). No hardcoded weekdays, no cached
  "last shown lesson" state — every call recomputes fresh from the
  actual current date, so the same date always returns the same
  lesson and yesterday's lesson can never leak into today.

  This file knows NOTHING about lesson content. It only knows how to
  turn "today's date" into "which day number" and hand back whatever
  the content registry has for that day, with a safe fallback if
  content is missing. Swapping in the real 30-day curriculum later
  means adding day-04.js ... day-30.js and updating registry.js —
  this file does not change.
*/

window.LexoraLessons = window.LexoraLessons || {};

(function () {
  // Placeholder curriculum start date — arbitrary, and deliberately NOT
  // "today" (set a few days in the past so the current Day 1-3 test
  // window lines up near the present for easy testing, without ever
  // hardcoding "today = Day 1"). Replace with the real, approved
  // curriculum launch date before production.
  var LESSON_EPOCH = '2026-08-20';

  function lagosDateString(date) {
    // Returns "YYYY-MM-DD" for the given moment, in Africa/Lagos time.
    var fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return fmt.format(date);
  }

  function daysBetween(dateStrA, dateStrB) {
    var a = new Date(dateStrA + 'T00:00:00Z');
    var b = new Date(dateStrB + 'T00:00:00Z');
    return Math.round((b - a) / 86400000);
  }

  // Daily access levels: how many of a lesson's main words are shown.
  // This must come from the subscription/referral entitlement system,
  // not be invented here. No real entitlement source exists yet, so
  // this defaults to Core as a technical fallback only — NOT final
  // subscription logic. Once the commercial system exists, it must set
  // this based on the user's actual plan/referral status.
  var ACCESS_LEVELS = { core: 5, extended: 10, full: 15 };
  var currentAccessLevel = 'core'; // technical fallback only, pending real entitlement wiring

  function setAccessLevel(level) {
    if (ACCESS_LEVELS.hasOwnProperty(level)) currentAccessLevel = level;
  }

  function applyAccessLevel(lesson) {
    if (!lesson.words) return lesson;
    var limit = ACCESS_LEVELS[currentAccessLevel] || ACCESS_LEVELS.core;
    return Object.assign({}, lesson, { words: lesson.words.slice(0, limit) });
  }

  // Production curriculum length. Day 30 is the final curriculum day —
  // this is a deliberate decision, not a placeholder. Extending beyond
  // Day 30 requires a future curriculum being explicitly added, not an
  // automatic wrap-around.
  var CURRICULUM_LENGTH = 30;

  function elapsedDays(date) {
    date = date || new Date();
    var todayStr = lagosDateString(date);
    var elapsed = daysBetween(LESSON_EPOCH, todayStr);
    return elapsed < 0 ? 0 : elapsed; // before epoch — clamp to Day 1
  }

  // Returns a 1-indexed day number (1..30), or null once the curriculum
  // window has passed — callers must check isCurriculumComplete() to
  // distinguish "day not reached yet" from "curriculum finished".
  function getDayNumber(date) {
    var elapsed = elapsedDays(date);
    if (elapsed >= CURRICULUM_LENGTH) return null;
    return elapsed + 1;
  }

  function isCurriculumComplete(date) {
    return elapsedDays(date) >= CURRICULUM_LENGTH;
  }

  function dayKey(n) {
    return 'day-' + (n < 10 ? '0' + n : '' + n);
  }

  function completionState() {
    return {
      day: null,
      theme: 'Curriculum complete',
      isComplete: true,
      words: []
    };
  }

  function unavailableState(dayNum) {
    return {
      day: dayNum,
      theme: 'Lesson unavailable',
      isFallback: true,
      words: []
    };
  }

  // Always returns a usable lesson object — never undefined, never null,
  // never a half-filled object that could leak "undefined" into the UI.
  function getTodayLesson() {
    if (isCurriculumComplete()) return completionState();
    var dayNum = getDayNumber();
    return getLessonByDay(dayNum);
  }

  function getLessonByDay(dayNum) {
    if (dayNum > CURRICULUM_LENGTH) return completionState();
    var key = dayKey(dayNum);
    var reg = window.LexoraLessons.registry || {};
    var lesson = reg[key];
    if (!lesson || !lesson.words || lesson.words.length === 0) {
      return unavailableState(dayNum);
    }
    return applyAccessLevel(lesson);
  }

  window.LexoraLessons.getDayNumber = getDayNumber;
  window.LexoraLessons.isCurriculumComplete = isCurriculumComplete;
  window.LexoraLessons.getTodayLesson = getTodayLesson;
  window.LexoraLessons.getLessonByDay = getLessonByDay;
  window.LexoraLessons.setAccessLevel = setAccessLevel;
  window.LexoraLessons.ACCESS_LEVELS = ACCESS_LEVELS;
})();
