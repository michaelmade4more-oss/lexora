/* Lexora Early Learner Audio Layer
   Reusable, optional audio cues for child-safe lesson interactions. */
window.LexoraEarlyAudio = (function () {
  var muted = false;
  var files = {
    welcome: 'assets/audio/home-welcome-chime.wav',
    start: 'assets/audio/lesson-start-cue.wav',
    instruction: 'assets/audio/early-instruction.wav',
    word: 'assets/audio/word-happy.wav',
    wordBall: 'assets/audio/word-ball.wav',
    wordSmall: 'assets/audio/word-small.wav',
    wordThree: 'assets/audio/count-three.wav',
    wordCat: 'assets/audio/word-cat.wav',
    retry: 'assets/audio/lesson-retry.wav',
    success: 'assets/audio/lesson-success.wav',
    successSting: 'assets/audio/lesson-success-sting.wav'
  };
  var cache = {};
  var context = null;

  function audioFor(key) {
    if (!cache[key] && files[key]) {
      cache[key] = new Audio(files[key]);
      cache[key].preload = 'auto';
      cache[key].volume = key === 'successSting' ? 0.52 : (key === 'welcome' || key === 'start' ? 0.58 : 0.82);
    }
    return cache[key];
  }

  function play(key) {
    if (muted) return Promise.resolve();
    var clip = audioFor(key);
    if (!clip) return Promise.resolve();
    try {
      clip.currentTime = 0;
      var result = clip.play();
      return result && result.catch ? result.catch(function () {}) : Promise.resolve();
    } catch (error) {
      return Promise.resolve();
    }
  }

  function playTap() {
    if (muted) return;
    try {
      context = context || new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(620, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(840, context.currentTime + 0.07);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch (error) {}
  }

  function setMuted(value) {
    muted = Boolean(value);
    Object.keys(cache).forEach(function (key) {
      if (cache[key]) cache[key].muted = muted;
    });
  }

  function stop() {
    Object.keys(cache).forEach(function (key) {
      if (cache[key]) { cache[key].pause(); cache[key].currentTime = 0; }
    });
  }

  function preload(keys) {
    (keys || []).forEach(function (key) { audioFor(key); });
  }

  return { play: play, playTap: playTap, setMuted: setMuted, stop: stop, preload: preload };
})();
