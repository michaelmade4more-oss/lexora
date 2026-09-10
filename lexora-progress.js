/* Lexora Progress v2 — completion, evidence, revisit, and progression stay separate. */
window.LexoraProgress = (function () {
  var TOTAL = 15;
  function profile() { return sessionStorage.getItem('lexoraSelectedProfile') || 'Gracefilled'; }
  function key() { return 'lexora_progress_v2_' + profile(); }
  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(key()) || 'null');
      if (saved) return saved;
      var legacy = parseInt(localStorage.getItem('lexora_progress_' + profile()) || '1', 10);
      return { nextLesson: isNaN(legacy) ? 1 : legacy, lessons: {} };
    } catch (error) { return {}; }
  }
  function write(value) { localStorage.setItem(key(), JSON.stringify(value)); }
  function get() {
    var value = read();
    return Number.isInteger(value.nextLesson) && value.nextLesson > 0 ? value.nextLesson : 1;
  }
  function record(lessonNumber, patch) {
    var value = read();
    var id = 'early-lesson-' + (lessonNumber < 10 ? '0' + lessonNumber : lessonNumber);
    var current = value.lessons && value.lessons[id] ? value.lessons[id] : {
      lessonId: id, completed: false, introduced: false, attempts: 0, correct: 0,
      replayCount: 0, supportLevel: 'independent', evidence: [], revisit: { recommended: false, reasons: [] },
      progression: { eligible: false, reasons: [], ruleVersion: 'configurable-v1' }
    };
    value.lessons = value.lessons || {};
    value.lessons[id] = Object.assign(current, patch || {});
    write(value);
    return value.lessons[id];
  }
  function markIntroduced(lessonNumber, meta) {
    return record(lessonNumber, { introduced: true, strand: meta && meta.strand, stage: meta && meta.stage, introducedAt: new Date().toISOString() });
  }
  function recordEvidence(lessonNumber, evidence) {
    var current = record(lessonNumber);
    var next = Object.assign({}, current, {
      attempts: (current.attempts || 0) + (evidence && evidence.attempt ? 1 : 0),
      correct: (current.correct || 0) + (evidence && evidence.correct ? 1 : 0),
      replayCount: (current.replayCount || 0) + (evidence && evidence.replay ? 1 : 0),
      supportLevel: (evidence && evidence.supportLevel) || current.supportLevel,
      evidence: (current.evidence || []).concat([Object.assign({ at: new Date().toISOString() }, evidence || {})])
    });
    return record(lessonNumber, next);
  }
  function markComplete(lessonNumber) {
    var value = read();
    var next = Math.max(get(), lessonNumber + 1);
    value.nextLesson = next;
    value.lessons = value.lessons || {};
    var id = 'early-lesson-' + (lessonNumber < 10 ? '0' + lessonNumber : lessonNumber);
    var current = value.lessons[id] || {};
    value.lessons[id] = Object.assign(current, { lessonId: id, completed: true, completedAt: new Date().toISOString() });
    write(value);
    return value.lessons[id];
  }
  function getLesson(lessonNumber) {
    var value = read();
    var id = 'early-lesson-' + (lessonNumber < 10 ? '0' + lessonNumber : lessonNumber);
    return value.lessons && value.lessons[id] ? value.lessons[id] : null;
  }
  function setReadiness(lessonNumber, revisit, progression) {
    return record(lessonNumber, { revisit: revisit || { recommended: false, reasons: [] }, progression: progression || { eligible: false, reasons: [], ruleVersion: 'configurable-v1' } });
  }
  function nextLessonUrl() {
    var n = get();
    return n > TOTAL ? 'child-home-early.html' : ('early-lesson-' + (n < 10 ? '0' + n : n) + '.html');
  }
  return { get: get, read: read, record: record, markIntroduced: markIntroduced, recordEvidence: recordEvidence, markComplete: markComplete, getLesson: getLesson, setReadiness: setReadiness, nextLessonUrl: nextLessonUrl, total: TOTAL, profile: profile };
})();
