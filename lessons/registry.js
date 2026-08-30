/*
  Lexora Lesson Registry
  -----------------------
  Aggregates every day-NN.js file into one lookup table the engine
  reads from. To add real curriculum: create day-NN.js following
  the same shape as day-01.js, include it in the HTML before this file,
  and add one line below. Nothing else in the app needs to change.
*/

window.LexoraLessons = window.LexoraLessons || {};
window.LexoraLessons.registry = {
  'day-01': LEXORA_DAY_01,
  'day-02': LEXORA_DAY_02,
  'day-03': LEXORA_DAY_03,
  'day-04': LEXORA_DAY_04,
  'day-05': LEXORA_DAY_05,
  'day-06': LEXORA_DAY_06,
  'day-07': LEXORA_DAY_07,
  'day-08': LEXORA_DAY_08,
  'day-09': LEXORA_DAY_09,
  'day-10': LEXORA_DAY_10
};