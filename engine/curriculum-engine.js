/* Lexora Curriculum Engine v1
   Renders structured Early Learner lesson specifications without copying lesson HTML. */
window.LexoraCurriculumEngine = (function () {
  function qs(root, selector) { return root.querySelector(selector); }
  function escapeText(value) { return String(value).replace(/[&<>"']/g, function (char) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]; }); }

  function tone(kind) {
    try {
      var context = tone.context || (tone.context = new (window.AudioContext || window.webkitAudioContext)());
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      var now = context.currentTime;
      var frequency = kind === 'chime' ? 880 : 520;
      oscillator.type = kind === 'chime' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now);
      if (kind === 'chime') oscillator.frequency.exponentialRampToValueAtTime(1320, now + .18);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.12, now + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .32);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + .34);
    } catch (error) {}
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
      var width = Math.round(position / total * 100);
      var nextRoute = position < total ? 'early-lesson-' + String(position + 1).padStart(2, '0') + '.html' : 'child-home-early.html';
      var nextLabel = position < total ? 'Next little game' : 'Back to my space';
      root.innerHTML = '<div class="engine-room"><header class="engine-top"><button class="engine-back" id="engineBack" aria-label="Back to my learning space">‹</button><span class="engine-step">' + position + ' of ' + total + '</span><button class="engine-mute" id="engineMute" aria-label="Audio on">◖</button></header>' +
        '<div class="engine-progress" aria-label="Lesson ' + position + ' of ' + total + '"><i style="width:' + width + '%"></i></div>' +
        '<main class="engine-scene"><div class="engine-kicker">' + escapeText(spec.title) + '</div><h1>' + escapeText(spec.title) + '</h1><p class="engine-instruction">' + escapeText(spec.instruction) + '</p><div class="engine-guide" aria-hidden="true">' + escapeText(activity.choices[0].visual) + '<span>♪</span></div><div class="engine-word-card"><strong>Listen</strong><span>' + escapeText(activity.prompt) + '</span></div><button class="engine-listen" id="engineListen" aria-label="Listen">◖</button><div class="engine-audio-label" id="engineAudioLabel">Listen</div><div class="engine-choices hidden" id="engineChoices">' + activity.choices.map(function (choice) { return '<button class="engine-choice" data-answer="' + escapeText(choice.id) + '" aria-label="' + escapeText(choice.label) + '"><span class="engine-visual">' + escapeText(choice.visual) + '</span><span class="engine-choice-label">' + escapeText(choice.label) + '</span></button>'; }).join('') + '</div><div class="engine-choice-prompt hidden" id="enginePrompt">' + escapeText(activity.prompt) + '</div><div class="engine-feedback" id="engineFeedback"></div><button class="engine-retry hidden" id="engineRetry">Listen again</button><button class="engine-continue hidden" id="engineContinue">Keep going</button></main><section class="engine-complete" id="engineComplete"><div><div class="engine-check">✓</div><h2>' + escapeText(spec.feedback.complete) + '</h2><button class="engine-finish" id="engineFinish">' + nextLabel + '</button></div></section></div>';
      var listen = qs(root, '#engineListen'), choices = qs(root, '#engineChoices'), prompt = qs(root, '#enginePrompt'), feedback = qs(root, '#engineFeedback'), retry = qs(root, '#engineRetry'), cont = qs(root, '#engineContinue'), audioLabel = qs(root, '#engineAudioLabel'), complete = qs(root, '#engineComplete');
      var muted = false;
      preloadPath(spec.audio.instruction);
      preloadPath(spec.audio.retry);
      preloadPath(spec.audio.success);
      function playTarget() { if (muted) return; tone(activity.targetSound); audioLabel.textContent = 'Listening…'; listen.classList.add('playing'); setTimeout(function () { listen.classList.remove('playing'); audioLabel.textContent = 'Listen again'; choices.classList.remove('hidden'); prompt.classList.remove('hidden'); }, 360); }
      function playRetry() { if (muted) return; playPath(spec.audio.retry); tone('clap'); }
      listen.addEventListener('click', function () { playPath(spec.audio.instruction); playTarget(); });
      qs(root, '#engineMute').addEventListener('click', function (event) { muted = !muted; event.currentTarget.setAttribute('aria-label', muted ? 'Audio off' : 'Audio on'); audioLabel.textContent = muted ? 'Audio is off' : 'Listen'; });
      Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (choice) { choice.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (item) { item.disabled = true; }); if (choice.dataset.answer === activity.correctAnswerId) { choice.classList.add('correct'); feedback.textContent = spec.feedback.correct; feedback.classList.add('success'); cont.classList.remove('hidden'); cont.classList.add('attention'); playPath(spec.audio.success); } else { choice.classList.add('wrong'); feedback.textContent = spec.feedback.incorrect; feedback.classList.add('retry-state'); retry.classList.remove('hidden'); retry.classList.add('attention'); playRetry(); setTimeout(function () { choice.classList.remove('wrong'); Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (item) { item.disabled = false; }); }, 500); } }); });
      retry.addEventListener('click', function () { retry.classList.add('hidden'); retry.classList.remove('attention'); playTarget(); });
      cont.addEventListener('click', function () { cont.classList.remove('attention'); complete.classList.add('open'); });
      qs(root, '#engineBack').addEventListener('click', function () { location.href = 'child-home-early.html'; });
      qs(root, '#engineFinish').addEventListener('click', function () { location.href = nextRoute; });
      return spec;
    });
  }
  return { mount: mount };
})();
