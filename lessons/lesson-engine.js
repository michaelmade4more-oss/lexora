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
  // Curriculum start date used by the current Lexora lesson sequence.
  // This is kept separate from the device's current date so lesson-day
  // selection remains deterministic in Africa/Lagos time.
  var LESSON_EPOCH = '2026-08-25';

  function lagosDateString(date) {
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

  var ACCESS_LEVELS = { core: 5, extended: 10, full: 15 };
  var currentAccessLevel = 'core';

  function setAccessLevel(level) {
    if (ACCESS_LEVELS.hasOwnProperty(level)) currentAccessLevel = level;
  }

  function applyAccessLevel(lesson) {
    if (!lesson.words) return lesson;
    var limit = ACCESS_LEVELS[currentAccessLevel] || ACCESS_LEVELS.core;
    return Object.assign({}, lesson, { words: lesson.words.slice(0, limit) });
  }

  var CURRICULUM_LENGTH = 30;

  function elapsedDays(date) {
    date = date || new Date();
    var todayStr = lagosDateString(date);
    var elapsed = daysBetween(LESSON_EPOCH, todayStr);
    return elapsed < 0 ? 0 : elapsed;
  }

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

  function getLatestAvailableLesson() {
    var reg = window.LexoraLessons.registry || {};
    var latestDay = 0;
    var latestLesson = null;

    Object.keys(reg).forEach(function (key) {
      var match = /^day-(\d+)$/.exec(key);
      if (!match) return;
      var n = parseInt(match[1], 10);
      var lesson = reg[key];
      if (n > latestDay && lesson && lesson.words && lesson.words.length) {
        latestDay = n;
        latestLesson = lesson;
      }
    });

    return latestLesson ? applyAccessLevel(latestLesson) : null;
  }

  function getTodayLesson() {
    if (isCurriculumComplete()) return completionState();

    var dayNum = getDayNumber();
    var lesson = getLessonByDay(dayNum);

    // The repository currently contains only the uploaded lesson days.
    // If the calendar has advanced beyond the latest uploaded lesson,
    // keep the lesson CTA usable rather than rendering "Unavailable".
    // Once the next approved day file is uploaded and registered, it is
    // automatically selected without changing this engine again.
    if (lesson.isFallback) {
      var latest = getLatestAvailableLesson();
      if (latest) return latest;
    }

    return lesson;
  }

  function getLessonByDay(dayNum) {
    if (!dayNum || dayNum > CURRICULUM_LENGTH) return completionState();
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