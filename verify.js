var fs = require('fs');
var html = fs.readFileSync('/Users/abrahamchaibi/code/aeq_bio/anki_split/index.html', 'utf-8');

var jsonMatch = html.match(/<script id="wordData" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
var WORDS = JSON.parse(jsonMatch[1]);

console.log('Testing all ' + WORDS.length + ' words in both modes...\n');

function pickDistractors(correctWord, mode, count) {
  var correctAnswer = mode === 'ru' ? correctWord.en : correctWord.ru;
  var rank = correctWord.r;
  var pool = [];
  for (var i = 0; i < WORDS.length; i++) {
    var w = WORDS[i];
    if (w.r === rank) continue;
    var answer = mode === 'ru' ? w.en : w.ru;
    if (answer === correctAnswer) continue;
    var dist = Math.abs(w.r - rank);
    if (dist < 300) { pool.push(answer); pool.push(answer); }
    else { pool.push(answer); }
  }
  var seen = {};
  seen[correctAnswer.toLowerCase()] = true;
  var result = [];
  var attempts = 0;
  while (result.length < count && attempts < 500) {
    var idx = Math.floor(Math.random() * pool.length);
    var candidate = pool[idx];
    if (!seen[candidate.toLowerCase()]) {
      seen[candidate.toLowerCase()] = true;
      result.push(candidate);
    }
    attempts++;
  }
  return result;
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

var errors = [];
var warnings = [];
var modes = ['ru', 'en'];

for (var mi = 0; mi < modes.length; mi++) {
  var mode = modes[mi];
  for (var wi = 0; wi < WORDS.length; wi++) {
    var word = WORDS[wi];
    var correctAnswer = mode === 'ru' ? word.en : word.ru;
    var distractors = pickDistractors(word, mode, 3);
    var choices = shuffle([correctAnswer].concat(distractors));

    // Check 1: correct answer is in choices
    var found = false;
    for (var ci = 0; ci < choices.length; ci++) {
      if (choices[ci] === correctAnswer) { found = true; break; }
    }
    if (!found) {
      errors.push('MISSING CORRECT: rank=' + word.r + ' mode=' + mode +
        ' word=' + word.ru + ' correct="' + correctAnswer + '" choices=' + JSON.stringify(choices));
    }

    // Check 2: exactly 4 choices
    if (choices.length !== 4) {
      warnings.push('WRONG COUNT: rank=' + word.r + ' mode=' + mode +
        ' word=' + word.ru + ' got ' + choices.length + ' choices (need 4)');
    }

    // Check 3: no duplicate choices
    var choiceLower = choices.map(function(c) { return c.toLowerCase(); });
    var uniqueSet = {};
    for (var k = 0; k < choiceLower.length; k++) uniqueSet[choiceLower[k]] = true;
    if (Object.keys(uniqueSet).length !== choices.length) {
      errors.push('DUPLICATE: rank=' + word.r + ' mode=' + mode +
        ' word=' + word.ru + ' choices=' + JSON.stringify(choices));
    }

    // Check 4: correct answer appears exactly once
    var correctCount = 0;
    for (var ci2 = 0; ci2 < choices.length; ci2++) {
      if (choices[ci2] === correctAnswer) correctCount++;
    }
    if (correctCount !== 1) {
      errors.push('CORRECT COUNT=' + correctCount + ': rank=' + word.r + ' mode=' + mode +
        ' word=' + word.ru + ' correct="' + correctAnswer + '" choices=' + JSON.stringify(choices));
    }
  }
}

console.log('Tested: ' + (WORDS.length * 2) + ' cards (both modes)');
console.log('Errors: ' + errors.length);
console.log('Warnings: ' + warnings.length);

if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  for (var i = 0; i < Math.min(errors.length, 20); i++) {
    console.log(errors[i]);
  }
  if (errors.length > 20) console.log('... and ' + (errors.length - 20) + ' more');
}

if (warnings.length > 0) {
  console.log('\n=== WARNINGS ===');
  for (var i = 0; i < Math.min(warnings.length, 20); i++) {
    console.log(warnings[i]);
  }
  if (warnings.length > 20) console.log('... and ' + (warnings.length - 20) + ' more');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\nAll cards verified OK!');
}
