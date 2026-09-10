/* Lexora Curriculum Engine v1
   Renders structured Early Learner lesson specifications without copying lesson HTML. */
window.LexoraCurriculumEngine = (function () {
  function qs(root, selector) { return root.querySelector(selector); }
  function escapeText(value) { return String(value).replace(/[&<>"']/g, function (char) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]; }); }

  function speakWord(word) {
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = .78;
      utterance.pitch = 1.05;
      utterance.volume = .9;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) { return false; }
  }
  function clapPattern(count, spacing) {
    try {
      var context = tone.context || (tone.context = new (window.AudioContext || window.webkitAudioContext)());
      if (context.state === 'suspended') context.resume();
      var now = context.currentTime;
      for (var beat = 0; beat < count; beat += 1) {
        var offset = beat * spacing;
        var buffer = context.createBuffer(1, Math.floor(context.sampleRate * .12), context.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 5);
        var source = context.createBufferSource();
        var filter = context.createBiquadFilter();
        var gain = context.createGain();
        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, now + offset);
        filter.Q.setValueAtTime(.8, now + offset);
        gain.gain.setValueAtTime(.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(.22, now + offset + .004);
        gain.gain.exponentialRampToValueAtTime(.0001, now + offset + .12);
        source.connect(filter).connect(gain).connect(context.destination);
        source.start(now + offset);
      }
      return true;
    } catch (error) { return false; }
  }
  function tone(kind) {
    if (kind === 'word:cat') return speakWord('cat') || clapPattern(1, .1);
    if (kind === 'word:hat') return speakWord('hat') || clapPattern(2, .1);
    if (kind === 'word:sun') return speakWord('sun') || clapPattern(1, .1);
    if (kind === 'syllables:banana') return clapPattern(3, .24);
    if (kind === 'syllables:sun') return clapPattern(1, .1);
    if (kind === 'tap-tap') return clapPattern(2, .18);
    if (kind === 'tap-hold') return clapPattern(1, .1);
    try {
      var context = tone.context || (tone.context = new (window.AudioContext || window.webkitAudioContext)());
      if (context.state === 'suspended') context.resume();
      var now = context.currentTime;
      if (kind === 'drum') {
        var drumOsc = context.createOscillator();
        var drumGain = context.createGain();
        drumOsc.type = 'sine';
        drumOsc.frequency.setValueAtTime(145, now);
        drumOsc.frequency.exponentialRampToValueAtTime(58, now + .18);
        drumGain.gain.setValueAtTime(.0001, now);
        drumGain.gain.exponentialRampToValueAtTime(.34, now + .006);
        drumGain.gain.exponentialRampToValueAtTime(.0001, now + .24);
        drumOsc.connect(drumGain).connect(context.destination);
        drumOsc.start(now);
        drumOsc.stop(now + .25);
        return true;
      }
      if (kind === 'clap') return clapPattern(1, .1);
      var chimeGain = context.createGain();
      chimeGain.gain.setValueAtTime(.0001, now);
      chimeGain.gain.exponentialRampToValueAtTime(.13, now + .012);
      chimeGain.gain.exponentialRampToValueAtTime(.0001, now + .62);
      chimeGain.connect(context.destination);
      [880, 1320, 1760].forEach(function (frequency, index) {
        var oscillator = context.createOscillator();
        oscillator.type = index === 0 ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.connect(chimeGain);
        oscillator.start(now);
        oscillator.stop(now + .64);
      });
      return true;
    } catch (error) { return false; }
  }
  function soundDuration(kind) {
    if (kind === 'word:cat' || kind === 'word:hat' || kind === 'word:sun') return 900;
    if (kind === 'syllables:banana') return 900;
    if (kind === 'syllables:sun' || kind === 'tap-hold') return 420;
    if (kind === 'tap-tap') return 560;
    return kind === 'drum' ? 420 : (kind === 'chime' ? 700 : 360);
  }
  var pathCache = {};
  function preloadPath(path) {
    if (!path || path.indexOf('synthetic:') === 0 || pathCache[path]) return;
    var audio = new Audio(path);
    audio.preload = 'auto';
    audio.volume = .82;
    pathCache[path] = audio;
  }
  function playPath(path) {
    if (!path || path.indexOf('synthetic:') === 0) return Promise.resolve();
    preloadPath(path);
    var audio = pathCache[path];
    audio.currentTime = 0;
    var result = audio.play();
    return result && result.catch ? result.catch(function () {}) : Promise.resolve();
  }

  function mount(options) {
    var root = document.querySelector(options.root || '#lessonRoot');
    return fetch(options.specUrl).then(function (response) { return response.json(); }).then(function (spec) {
      var activity = spec.activity;
      var total = spec.progress.totalLessons;
      var position = spec.progress.position;
      var progress = window.LexoraProgress;
      var width = Math.round(position / total * 100);
      root.innerHTML = '<div class="engine-room"><header class="engine-top"><button class="engine-back" id="engineBack" aria-label="Back to my learning space">‹</button><span class="engine-step">' + position + ' of ' + total + '</span><button class="engine-mute" id="engineMute" aria-label="Audio on">◖</button></header>' +
        '<div class="engine-progress" aria-label="Lesson ' + position + ' of ' + total + '"><i style="width:' + width + '%"></i></div>' +
        '<main class="engine-scene"><div class="engine-kicker">' + escapeText(spec.title) + '</div><h1>' + escapeText(spec.title) + '</h1><p class="engine-instruction">' + escapeText(spec.instruction) + '</p><div class="engine-guide" aria-hidden="true">' + escapeText(activity.heroVisual || '👂') + '<span>♪</span></div><div class="engine-word-card"><strong>Listen</strong><span>' + escapeText(activity.prompt) + '</span></div><button class="engine-listen" id="engineListen" aria-label="Listen">◖</button><div class="engine-audio-label" id="engineAudioLabel">Listen</div><div class="engine-choices hidden" id="engineChoices">' + activity.choices.map(function (choice) { return '<button class="engine-choice" data-answer="' + escapeText(choice.id) + '" data-sound="' + escapeText(choice.sound || choice.id) + '" aria-label="' + escapeText(choice.label) + '"><span class="engine-visual">' + escapeText(choice.visual) + '</span><span class="engine-choice-label">' + escapeText(choice.label) + '</span></button>'; }).join('') + '</div><div class="engine-choice-prompt hidden" id="enginePrompt">' + escapeText(activity.prompt) + '</div><div class="engine-feedback" id="engineFeedback"></div><button class="engine-retry hidden" id="engineRetry">Listen again</button><button class="engine-continue hidden" id="engineContinue">Keep going</button></main><section class="engine-complete" id="engineComplete"><div><div class="engine-check">✓</div><h2>' + escapeText(spec.feedback.complete) + '</h2><button class="engine-finish" id="engineFinish">Back to my space</button></div></section></div>';
      var listen = qs(root, '#engineListen'), choices = qs(root, '#engineChoices'), prompt = qs(root, '#enginePrompt'), feedback = qs(root, '#engineFeedback'), retry = qs(root, '#engineRetry'), cont = qs(root, '#engineContinue'), audioLabel = qs(root, '#engineAudioLabel'), complete = qs(root, '#engineComplete');
      var muted = false;
      preloadPath(spec.audio.instruction);
      preloadPath(spec.audio.retry);
      preloadPath(spec.audio.success);
      function playTarget() { if (!muted) tone(activity.targetSound); audioLabel.textContent = 'Listening…'; listen.classList.add('playing'); setTimeout(function () { listen.classList.remove('playing'); audioLabel.textContent = 'Listen again'; choices.classList.remove('hidden'); prompt.classList.remove('hidden'); }, soundDuration(activity.targetSound)); }
      function playRetry() { if (muted) return; playPath(spec.audio.retry); tone('clap'); }
      listen.addEventListener('click', function () { if (!muted) playPath(spec.audio.instruction); playTarget(); });
      qs(root, '#engineMute').addEventListener('click', function (event) { muted = !muted; event.currentTarget.setAttribute('aria-label', muted ? 'Audio off' : 'Audio on'); audioLabel.textContent = muted ? 'Audio is off' : 'Listen'; });
      Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (choice) { choice.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (item) { item.disabled = true; }); if (!muted) tone(choice.dataset.sound || choice.dataset.answer); if (choice.dataset.answer === activity.correctAnswerId) { choice.classList.add('correct'); feedback.textContent = spec.feedback.correct; feedback.classList.add('success'); cont.classList.remove('hidden'); cont.classList.add('attention'); playPath(spec.audio.success); } else { choice.classList.add('wrong'); feedback.textContent = spec.feedback.incorrect; feedback.classList.add('retry-state'); retry.classList.remove('hidden'); retry.classList.add('attention'); playRetry(); setTimeout(function () { choice.classList.remove('wrong'); Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (item) { item.disabled = false; }); }, 500); } }); });
      retry.addEventListener('click', function () { retry.classList.add('hidden'); retry.classList.remove('attention'); playTarget(); });
      cont.addEventListener('click', function () { cont.classList.remove('attention'); complete.classList.add('open'); });
      qs(root, '#engineBack').addEventListener('click', function () { location.href = 'child-home-early.html'; });
      qs(root, '#engineFinish').addEventListener('click', function () {
        if (progress) { progress.markComplete(position); location.href = progress.nextLessonUrl(); }
        else { location.href = 'child-home-early.html'; }
      });
      return spec;
    });
  }
  return { mount: mount };
})();
