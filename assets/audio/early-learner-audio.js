/* Lexora Early Learner Audio Layer
   Shared provider with balanced loudness, replay, mute, and fallback signalling. */
window.LexoraEarlyAudio = (function () {
  var muted = false;
  var files = {
    welcome: 'assets/audio/home-welcome-chime.wav', start: 'assets/audio/lesson-start-cue.wav', instruction: 'assets/audio/early-instruction.wav',
    word: 'assets/audio/word-happy.wav', wordBall: 'assets/audio/word-ball.wav', wordSmall: 'assets/audio/word-small.wav', wordThree: 'assets/audio/count-three.wav', wordCat: 'assets/audio/word-cat.wav',
    retry: 'assets/audio/lesson-retry.wav', success: 'assets/audio/lesson-success.wav', successSting: 'assets/audio/lesson-success-sting.wav'
  };
  var cache = {}, context = null, compressor = null;
  var volume = { welcome:.58, start:.58, instruction:.82, word:.98, wordBall:.98, wordSmall:.98, wordThree:.98, wordCat:.98, retry:.82, success:.78, successSting:.52 };
  function audioFor(key) {
    if (!cache[key] && files[key]) { cache[key] = new Audio(files[key]); cache[key].preload='auto'; cache[key].volume=volume[key] == null ? .82 : volume[key]; }
    return cache[key];
  }
  function play(key) {
    if (muted) return Promise.resolve(false);
    var clip=audioFor(key); if(!clip) return Promise.resolve(false);
    try { clip.currentTime=0; clip.volume=volume[key] == null ? .82 : volume[key]; var result=clip.play(); var finished=new Promise(function(resolve){var done=function(v){clip.removeEventListener('ended',onEnded);clip.removeEventListener('error',onError);resolve(v);},onEnded=function(){done(true);},onError=function(){done(false);};clip.addEventListener('ended',onEnded,{once:true});clip.addEventListener('error',onError,{once:true});setTimeout(function(){done(true);},5000);});return result&&result.then?result.then(function(){return finished;}).catch(function(){return false;}):finished; } catch(e){return Promise.resolve(false);}
  }
  function ensureAudio() { if(!context){context=new (window.AudioContext||window.webkitAudioContext)();compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.006;compressor.release.value=.18;compressor.connect(context.destination);} if(context.state==='suspended') context.resume(); return context; }
  function playTap(){if(muted)return false;try{var c=ensureAudio(),o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(620,c.currentTime);o.frequency.exponentialRampToValueAtTime(840,c.currentTime+.07);g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.07,c.currentTime+.008);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.11);o.connect(g).connect(compressor);o.start();o.stop(c.currentTime+.12);return true;}catch(e){return false;}}
  function setMuted(value){muted=Boolean(value);Object.keys(cache).forEach(function(key){if(cache[key])cache[key].muted=muted;});}
  function stop(){Object.keys(cache).forEach(function(key){if(cache[key]){cache[key].pause();cache[key].currentTime=0;}});}
  function preload(keys){(keys||[]).forEach(audioFor);}
  return {play:play,playTap:playTap,setMuted:setMuted,stop:stop,preload:preload};
})();
