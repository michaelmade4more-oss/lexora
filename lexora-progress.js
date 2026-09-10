/* Lexora Progress v1 — per-profile lesson progress, shared by all pages */
window.LexoraProgress = (function () {
  var TOTAL = 10;
  function profile() { return sessionStorage.getItem('lexoraSelectedProfile') || 'Gracefilled'; }
  function key() { return 'lexora_progress_' + profile(); }
  function get() {
    var value = parseInt(localStorage.getItem(key()) || '1', 10);
    return isNaN(value) ? 1 : value;
  }
  function markComplete(lessonNumber) {
    var next = lessonNumber + 1;
    if (next > get()) localStorage.setItem(key(), String(next));
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function nextLessonUrl() {
    var n = get();
    return n > TOTAL ? 'child-home-early.html' : ('early-lesson-' + pad(n) + '.html');
  }
  return { get: get, markComplete: markComplete, nextLessonUrl: nextLessonUrl, total: TOTAL };
})();
