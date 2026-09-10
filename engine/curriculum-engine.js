/* Lexora Curriculum Engine v2. Completion, evidence, readiness, and progression remain separate. */
window.LexoraCurriculumEngine = (function () {
  function qs(root, selector) { return root.querySelector(selector); }
  function esc(value) { return String(value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function tone(kind) {
    try {
      var context = tone.context || (tone.context = new (window.AudioContext || window.webkitAudioContext)());
      if (context.state === 'suspended') context.resume();
      var now = context.currentTime, osc = context.createOscillator(), gain = context.createGain();
      osc.type = kind === 'drum' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(kind === 'drum' ? 145 : (kind === 'clap' ? 620 : 880), now);
      osc.frequency.exponentialRampToValueAtTime(kind === 'drum' ? 58 : 1320, now + .18);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.34, now + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + .25);
      osc.connect(gain).connect(context.destination); osc.start(now); osc.stop(now + .28); return true;
    } catch (error) { return false; }
  }
  function duration(kind) { return kind === 'banana' ? 900 : (kind === 'drum' ? 420 : 650); }
  var cache = {};
  function preload(path) { if (!path || path.indexOf('synthetic:') === 0 || cache[path]) return; var a = new Audio(path); a.preload = 'auto'; cache[path] = a; }
  function play(path) { if (!path || path.indexOf('synthetic:') === 0) return Promise.resolve(false); preload(path); var a = cache[path]; a.currentTime = 0; try { var finished = new Promise(function (resolve) { var done=function(v){a.removeEventListener('ended',onEnded);a.removeEventListener('error',onError);resolve(v);}; var onEnded=function(){done(true);}; var onError=function(){done(false);}; a.addEventListener('ended',onEnded,{once:true}); a.addEventListener('error',onError,{once:true}); setTimeout(function(){done(true);},5000); }); return Promise.resolve(a.play()).then(function(){return finished;}).catch(function(){return false;}); } catch (error) { return Promise.resolve(false); } }
  function shuffle(choices) { var copy = choices.slice(); for (var i = copy.length - 1; i > 0; i -= 1) { var j = Math.floor(Math.random() * (i + 1)); var t = copy[i]; copy[i] = copy[j]; copy[j] = t; } return copy; }
  function mount(options) {
    var root = document.querySelector(options.root || '#lessonRoot');
    return fetch(options.specUrl).then(function (r) { return r.json(); }).then(function (spec) {
      var activity = spec.activity, total = spec.progress.totalLessons, position = spec.progress.position, progress = window.LexoraProgress;
      if (progress) progress.markIntroduced(position, { strand: spec.strand, stage: spec.stage });
      var choicesData = shuffle(activity.choices), width = Math.round(position / total * 100);
      root.innerHTML = '<div class="engine-room"><header class="engine-top"><button class="engine-back" id="engineBack" aria-label="Back to my learning space">‹</button><span class="engine-step">' + position + ' of ' + total + '</span><button class="engine-mute" id="engineMute" aria-label="Audio on">◖</button></header><div class="engine-progress" aria-label="Lesson ' + position + ' of ' + total + '"><i style="width:' + width + '%"></i></div><main class="engine-scene"><div class="engine-kicker">' + esc(spec.title) + '</div><h1>' + esc(spec.title) + '</h1><p class="engine-instruction">' + esc(spec.instruction) + '</p><div class="engine-guide" aria-hidden="true">' + esc(activity.heroVisual || '👂') + '</div><div class="engine-word-card"><strong>Listen</strong><span>' + esc(activity.prompt) + '</span></div><button class="engine-listen" id="engineListen" aria-label="Listen">◖</button><div class="engine-audio-label" id="engineAudioLabel">Listen</div><div class="engine-fallback hidden" id="engineFallback">Watch the pictures, then choose one.</div><div class="engine-choices hidden" id="engineChoices">' + choicesData.map(function (c) { return '<button class="engine-choice" data-answer="' + esc(c.id) + '" data-sound="' + esc(c.sound || c.id) + '" aria-label="' + esc(c.label) + '"><span class="engine-visual">' + esc(c.visual) + '</span><span class="engine-choice-label">' + esc(c.label) + '</span></button>'; }).join('') + '</div><div class="engine-choice-prompt hidden" id="enginePrompt">' + esc(activity.prompt) + '</div><div class="engine-feedback" id="engineFeedback"></div><button class="engine-retry hidden" id="engineRetry">Listen again</button><button class="engine-continue hidden" id="engineContinue">Keep going</button></main><section class="engine-complete" id="engineComplete"><div><div class="engine-check">✓</div><h2>' + esc(spec.feedback.complete) + '</h2><button class="engine-finish" id="engineFinish">Back to my space</button></div></section></div>';
      var listen=qs(root,'#engineListen'), choices=qs(root,'#engineChoices'), prompt=qs(root,'#enginePrompt'), feedback=qs(root,'#engineFeedback'), retry=qs(root,'#engineRetry'), cont=qs(root,'#engineContinue'), label=qs(root,'#engineAudioLabel'), fallback=qs(root,'#engineFallback'), complete=qs(root,'#engineComplete'), muted=false, revealed=false;
      preload(spec.audio.instruction); preload(spec.audio.retry); preload(spec.audio.success);
      function reveal() { revealed=true; listen.classList.remove('playing'); label.textContent=muted?'Audio is off':'Listen again'; choices.classList.remove('hidden'); prompt.classList.remove('hidden'); }
      function playTarget() { if (muted) { reveal(); return; } label.textContent='Listening…'; listen.classList.add('playing'); var ok=tone(activity.targetSound || activity.correctAnswerId); setTimeout(function () { if (!ok) fallback.classList.remove('hidden'); reveal(); }, duration(activity.targetSound || activity.correctAnswerId)); }
      function listenFlow() { fallback.classList.add('hidden'); label.textContent='Listening to the directions…'; play(spec.audio.instruction).then(function (ok) { if (!ok) fallback.classList.remove('hidden'); setTimeout(playTarget, ok ? 50 : 0); }); }
      listen.addEventListener('click', function () { if (!revealed) listenFlow(); else playTarget(); });
      qs(root,'#engineMute').addEventListener('click', function (e) { muted=!muted; e.currentTarget.setAttribute('aria-label',muted?'Audio off':'Audio on'); label.textContent=muted?'Audio is off':'Listen again'; if (muted) fallback.classList.remove('hidden'); if (!revealed) reveal(); });
      Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (choice) { choice.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (item) { item.disabled=true; }); var correct=choice.dataset.answer===activity.correctAnswerId; if (progress) progress.recordEvidence(position,{attempt:true,correct:correct,replay:!correct,supportLevel:correct?'independent':'supported'}); if (correct) { choice.classList.add('correct'); feedback.textContent=spec.feedback.correct; feedback.classList.add('success'); cont.classList.remove('hidden'); cont.classList.add('attention'); play(spec.audio.success); } else { choice.classList.add('wrong'); feedback.textContent=spec.feedback.incorrect; feedback.classList.add('retry-state'); retry.classList.remove('hidden'); retry.classList.add('attention'); setTimeout(function () { choice.classList.remove('wrong'); Array.prototype.forEach.call(root.querySelectorAll('.engine-choice'), function (item) { item.disabled=false; }); },500); } }); });
      retry.addEventListener('click', function () { retry.classList.add('hidden'); retry.classList.remove('attention'); playTarget(); });
      cont.addEventListener('click', function () { cont.classList.remove('attention'); complete.classList.add('open'); });
      qs(root,'#engineBack').addEventListener('click', function () { location.href='child-home-early.html'; });
      qs(root,'#engineFinish').addEventListener('click', function () { if (progress) { progress.markComplete(position); location.href=progress.nextLessonUrl(); } else location.href='child-home-early.html'; });
      return spec;
    });
  }
  return { mount: mount };
})();
