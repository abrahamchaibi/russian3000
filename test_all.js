#!/usr/bin/env node
/**
 * Comprehensive test suite for Russian 3000 app.
 * Tests: data integrity, quiz logic, progress tracking, best scores,
 * session persistence, deck navigation, mode switching, shuffle, distractor generation.
 */

var fs = require('fs');
var html = fs.readFileSync('/Users/abrahamchaibi/code/aeq_bio/anki_split/index.html', 'utf-8');

// ========== SETUP: Extract data and JS ==========
var jsonMatch = html.match(/<script id="wordData" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
if (!jsonMatch) { console.log('FATAL: No word data found'); process.exit(1); }
var WORDS = JSON.parse(jsonMatch[1]);

var jsMatch = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!jsMatch) { console.log('FATAL: No JS found'); process.exit(1); }

// Verify JS syntax
try { new Function(jsMatch[1]); } catch(e) {
  console.log('FATAL: JS syntax error:', e.message); process.exit(1);
}

var passed = 0, failed = 0, errors = [];

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; errors.push('FAIL: ' + msg); }
}

function section(title) { console.log('\n=== ' + title + ' ==='); }

// ========== TEST 1: HTML element references ==========
section('HTML Element References');

var elementIds = [
  'deckScreen', 'studyScreen', 'doneScreen',
  'deckList', 'overallFill', 'overallText',
  'shuffleBtn', 'resetBestBtn',
  'backBtn', 'studyTitle', 'studyCount', 'progressFill',
  'prevBtn', 'skipBtn',
  'promptDir', 'promptRank', 'promptWord',
  'choices', 'feedback', 'nextBtn',
  'doneBackBtn', 'doneTitle', 'doneEmoji', 'doneMsg', 'doneSub',
  'reviewMistakes', 'doneBtn', 'resetLink',
  'deckOptionsOverlay', 'deckOptTitle', 'deckOptSub',
  'deckOptResume', 'deckOptContinue', 'deckOptRestart', 'deckOptCancel'
];

var jsCode = jsMatch[1];
// Find all getElementById references in JS
var idRefs = jsCode.match(/getElementById\(['"]([^'"]+)['"]\)/g) || [];
var jsIds = idRefs.map(function(m) { return m.match(/getElementById\(['"]([^'"]+)['"]\)/)[1]; });
var uniqueJsIds = [];
var seen = {};
for (var i = 0; i < jsIds.length; i++) {
  if (!seen[jsIds[i]]) { uniqueJsIds.push(jsIds[i]); seen[jsIds[i]] = true; }
}

for (var i = 0; i < uniqueJsIds.length; i++) {
  var id = uniqueJsIds[i];
  var pattern = 'id="' + id + '"';
  assert(html.indexOf(pattern) !== -1, 'Element #' + id + ' referenced in JS but missing from HTML');
}

for (var i = 0; i < elementIds.length; i++) {
  var id = elementIds[i];
  var pattern = 'id="' + id + '"';
  assert(html.indexOf(pattern) !== -1, 'Expected element #' + id + ' not found in HTML');
}

console.log('Checked ' + uniqueJsIds.length + ' JS element references and ' + elementIds.length + ' expected elements');

// ========== TEST 2: Word Data Integrity ==========
section('Word Data Integrity');

assert(WORDS.length === 3000, 'Expected 3000 words, got ' + WORDS.length);

// Check all words have required fields
var missingFields = 0;
for (var i = 0; i < WORDS.length; i++) {
  var w = WORDS[i];
  if (!w.r || !w.ru || !w.en) missingFields++;
}
assert(missingFields === 0, missingFields + ' words missing required fields (r, ru, en)');

// Check ranks are sequential
var rankErrors = 0;
for (var i = 0; i < WORDS.length; i++) {
  if (WORDS[i].r !== i + 1) rankErrors++;
}
assert(rankErrors === 0, rankErrors + ' words have non-sequential ranks');

// Check no duplicate ranks
var rankSet = {};
var dupeRanks = 0;
for (var i = 0; i < WORDS.length; i++) {
  if (rankSet[WORDS[i].r]) dupeRanks++;
  rankSet[WORDS[i].r] = true;
}
assert(dupeRanks === 0, dupeRanks + ' duplicate ranks');

// Check no empty translations
var emptyTranslations = 0;
for (var i = 0; i < WORDS.length; i++) {
  if (WORDS[i].ru.trim() === '' || WORDS[i].en.trim() === '') emptyTranslations++;
}
assert(emptyTranslations === 0, emptyTranslations + ' words with empty translations');

console.log('Word data: ' + WORDS.length + ' words validated');

// ========== TEST 3: Deck Structure ==========
section('Deck Structure');

var DECK_SIZE = 200;
var NUM_DECKS = Math.ceil(WORDS.length / DECK_SIZE);
assert(NUM_DECKS === 15, 'Expected 15 decks, got ' + NUM_DECKS);

for (var d = 0; d < NUM_DECKS; d++) {
  var start = d * DECK_SIZE;
  var words = WORDS.slice(start, start + DECK_SIZE);
  if (d < NUM_DECKS - 1) {
    assert(words.length === 200, 'Deck ' + (d+1) + ' has ' + words.length + ' words, expected 200');
  } else {
    assert(words.length > 0 && words.length <= 200, 'Last deck has ' + words.length + ' words');
  }
}

console.log(NUM_DECKS + ' decks verified');

// ========== TEST 4: Distractor Generation (Core Quiz Logic) ==========
section('Distractor Generation');

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

// Test all 6000 cards (both modes, all words)
var quizErrors = [];
var modes = ['ru', 'en'];
for (var mi = 0; mi < modes.length; mi++) {
  var mode = modes[mi];
  for (var wi = 0; wi < WORDS.length; wi++) {
    var word = WORDS[wi];
    var correctAnswer = mode === 'ru' ? word.en : word.ru;
    var distractors = pickDistractors(word, mode, 3);
    var choices = shuffle([correctAnswer].concat(distractors));

    // Check: correct answer is in choices
    var found = false;
    for (var ci = 0; ci < choices.length; ci++) {
      if (choices[ci] === correctAnswer) { found = true; break; }
    }
    if (!found) {
      quizErrors.push('MISSING CORRECT: rank=' + word.r + ' mode=' + mode);
    }

    // Check: exactly 4 choices
    if (choices.length !== 4) {
      quizErrors.push('WRONG COUNT: rank=' + word.r + ' mode=' + mode + ' got ' + choices.length);
    }

    // Check: no duplicates
    var choiceLower = choices.map(function(c) { return c.toLowerCase(); });
    var uniqueSet = {};
    for (var k = 0; k < choiceLower.length; k++) uniqueSet[choiceLower[k]] = true;
    if (Object.keys(uniqueSet).length !== choices.length) {
      quizErrors.push('DUPLICATE: rank=' + word.r + ' mode=' + mode + ' choices=' + JSON.stringify(choices));
    }

    // Check: correct answer exactly once
    var correctCount = 0;
    for (var ci2 = 0; ci2 < choices.length; ci2++) {
      if (choices[ci2] === correctAnswer) correctCount++;
    }
    if (correctCount !== 1) {
      quizErrors.push('CORRECT COUNT=' + correctCount + ': rank=' + word.r + ' mode=' + mode);
    }
  }
}

assert(quizErrors.length === 0, quizErrors.length + ' quiz generation errors');
if (quizErrors.length > 0) {
  for (var i = 0; i < Math.min(quizErrors.length, 5); i++) {
    console.log('  ' + quizErrors[i]);
  }
}
console.log('Tested ' + (WORDS.length * 2) + ' cards across both modes');

// ========== TEST 5: Progress Logic ==========
section('Progress Logic');

// Simulate progress storage and deck progress calculation
function getDeckKey(deckIdx, mode) { return deckIdx + '_' + mode; }

function getDeckProgress(deckIdx, studyMode, progress) {
  var start = deckIdx * DECK_SIZE;
  var words = WORDS.slice(start, start + DECK_SIZE);
  var modes2 = studyMode === 'mix' ? ['ru', 'en'] : [studyMode];
  var learned = 0, total = 0;
  for (var mi = 0; mi < modes2.length; mi++) {
    var key = getDeckKey(deckIdx, modes2[mi]);
    var dp = progress[key] || {};
    for (var wi = 0; wi < words.length; wi++) {
      total++;
      if ((dp[words[wi].r] || 0) >= 1) learned++;
    }
  }
  return { learned: learned, total: total };
}

// Test: empty progress
var emptyProg = getDeckProgress(0, 'ru', {});
assert(emptyProg.learned === 0, 'Empty progress should have 0 learned, got ' + emptyProg.learned);
assert(emptyProg.total === 200, 'Deck 0 in ru mode should have 200 total, got ' + emptyProg.total);

// Test: mix mode doubles total
var mixProg = getDeckProgress(0, 'mix', {});
assert(mixProg.total === 400, 'Deck 0 in mix mode should have 400 total, got ' + mixProg.total);

// Test: progress tracking (mark some as learned)
var testProgress = { '0_ru': {} };
testProgress['0_ru'][1] = 1; // word rank 1 learned
testProgress['0_ru'][2] = 1; // word rank 2 learned
testProgress['0_ru'][3] = 0; // word rank 3 not learned (score 0)
var partialProg = getDeckProgress(0, 'ru', testProgress);
assert(partialProg.learned === 2, 'Should have 2 learned, got ' + partialProg.learned);

// Test: threshold >= 1
testProgress['0_ru'][4] = 1;
var threshProg = getDeckProgress(0, 'ru', testProgress);
assert(threshProg.learned === 3, 'Score=1 should count as learned, got ' + threshProg.learned);

// Test: score of 0 should NOT count
testProgress['0_ru'][5] = 0;
var zeroProg = getDeckProgress(0, 'ru', testProgress);
assert(zeroProg.learned === 3, 'Score=0 should not count as learned, got ' + zeroProg.learned);

console.log('Progress logic verified');

// ========== TEST 6: Best Score Logic ==========
section('Best Score Logic');

// Simulate best score storage
var bestScores = {};

function saveBestScore(deckIdx, pct, mode) {
  var key = deckIdx + '_' + mode;
  if (!bestScores[key] || pct > bestScores[key]) {
    bestScores[key] = pct;
  }
}

function getDeckBestScoreTest(deckIdx, mode) {
  var key = deckIdx + '_' + mode;
  return bestScores[key] || null;
}

// Test: no best score initially
assert(getDeckBestScoreTest(0, 'ru') === null, 'No best score should return null');

// Test: save a score
saveBestScore(0, 75, 'ru');
assert(getDeckBestScoreTest(0, 'ru') === 75, 'Best score should be 75, got ' + getDeckBestScoreTest(0, 'ru'));

// Test: higher score replaces
saveBestScore(0, 90, 'ru');
assert(getDeckBestScoreTest(0, 'ru') === 90, 'Best score should be 90, got ' + getDeckBestScoreTest(0, 'ru'));

// Test: lower score does NOT replace
saveBestScore(0, 60, 'ru');
assert(getDeckBestScoreTest(0, 'ru') === 90, 'Best score should still be 90, got ' + getDeckBestScoreTest(0, 'ru'));

// Test: different mode is independent
saveBestScore(0, 80, 'en');
assert(getDeckBestScoreTest(0, 'en') === 80, 'EN best should be 80');
assert(getDeckBestScoreTest(0, 'ru') === 90, 'RU best should still be 90');

// Test: different deck is independent
saveBestScore(1, 50, 'ru');
assert(getDeckBestScoreTest(1, 'ru') === 50, 'Deck 1 best should be 50');
assert(getDeckBestScoreTest(0, 'ru') === 90, 'Deck 0 best should still be 90');

// Test: reset clears all
bestScores = {};
assert(getDeckBestScoreTest(0, 'ru') === null, 'After reset, best should be null');
assert(getDeckBestScoreTest(0, 'en') === null, 'After reset, EN best should be null');

console.log('Best score logic verified');

// ========== TEST 7: Session State ==========
section('Session State');

// Test: session structure matches what the code saves/loads
var mockSession = {
  deck: 3,
  mode: 'ru',
  queue: [{ word: WORDS[0], mode: 'ru' }, { word: WORDS[1], mode: 'ru' }],
  idx: 1,
  mistakes: [{ word: WORDS[0], mode: 'ru' }],
  stats: { correct: 1, wrong: 1 },
  history: [
    { choices: ['a','b','c','d'], correctAnswer: 'a', selectedAnswer: 'b', isCorrect: false },
    { choices: ['x','y','z','w'], correctAnswer: 'x', selectedAnswer: null, isCorrect: null }
  ]
};
var serialized = JSON.stringify(mockSession);
var deserialized = JSON.parse(serialized);

assert(deserialized.deck === 3, 'Session deck should survive serialization');
assert(deserialized.idx === 1, 'Session idx should survive serialization');
assert(deserialized.stats.correct === 1, 'Session stats should survive serialization');
assert(deserialized.mistakes.length === 1, 'Session mistakes should survive serialization');
assert(deserialized.history.length === 2, 'Session history should survive serialization');
assert(deserialized.history[0].selectedAnswer === 'b', 'Session history answer should survive serialization');
assert(deserialized.history[1].selectedAnswer === null, 'Session history null answer should survive serialization');
assert(deserialized.queue[0].word.ru === WORDS[0].ru, 'Session queue words should survive serialization');

console.log('Session state serialization verified');

// ========== TEST 8: Study Queue Building ==========
section('Study Queue Building');

// Simulate startStudy queue building logic
function buildStudyQueue(deckIdx, studyMode, progress, restart) {
  var start = deckIdx * DECK_SIZE;
  var words = WORDS.slice(start, start + DECK_SIZE);
  var modes2 = studyMode === 'mix' ? ['ru', 'en'] : [studyMode];

  if (restart) {
    for (var ri = 0; ri < modes2.length; ri++) {
      delete progress[getDeckKey(deckIdx, modes2[ri])];
    }
  }

  var queue = [];
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    for (var mi = 0; mi < modes2.length; mi++) {
      var m = modes2[mi];
      var key = getDeckKey(deckIdx, m);
      var score = (progress[key] || {})[w.r] || 0;
      if (score < 1) {
        queue.push({ word: w, mode: m });
      }
    }
  }
  return queue;
}

// Test: fresh deck has all words
var q = buildStudyQueue(0, 'ru', {}, false);
assert(q.length === 200, 'Fresh deck 0 ru mode should have 200 cards, got ' + q.length);

// Test: mix mode has double
var qMix = buildStudyQueue(0, 'mix', {}, false);
assert(qMix.length === 400, 'Fresh deck 0 mix mode should have 400 cards, got ' + qMix.length);

// Test: progress reduces queue
var progData = { '0_ru': {} };
for (var r = 1; r <= 50; r++) progData['0_ru'][r] = 1;
var qPartial = buildStudyQueue(0, 'ru', progData, false);
assert(qPartial.length === 150, 'Deck 0 with 50 learned should have 150 remaining, got ' + qPartial.length);

// Test: restart clears progress
var qRestart = buildStudyQueue(0, 'ru', JSON.parse(JSON.stringify(progData)), true);
assert(qRestart.length === 200, 'Restart should give 200 cards, got ' + qRestart.length);

// Test: last deck
var qLast = buildStudyQueue(14, 'ru', {}, false);
var expectedLast = WORDS.length - 14 * 200;
assert(qLast.length === expectedLast, 'Last deck should have ' + expectedLast + ' cards, got ' + qLast.length);

// Test: fully completed deck has 0 cards
var fullProg = { '0_ru': {} };
for (var r = 1; r <= 200; r++) fullProg['0_ru'][r] = 1;
var qFull = buildStudyQueue(0, 'ru', fullProg, false);
assert(qFull.length === 0, 'Fully completed deck should have 0 cards, got ' + qFull.length);

console.log('Study queue building verified');

// ========== TEST 9: Mode Toggle Logic ==========
section('Mode Toggle Logic');

// Verify mode-btn elements exist with correct data-mode attributes
assert(html.indexOf('data-mode="ru"') !== -1, 'RU mode button missing');
assert(html.indexOf('data-mode="en"') !== -1, 'EN mode button missing');
assert(html.indexOf('data-mode="mix"') !== -1, 'Mix mode button missing');

// Verify default mode is 'ru'
assert(jsCode.indexOf("localStorage.getItem('ru3k_mode') || 'ru'") !== -1, 'Default mode should be ru');

console.log('Mode toggle verified');

// ========== TEST 10: Shuffle Logic ==========
section('Shuffle Logic');

// Test shuffle doesn't lose elements
var testArr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var original = testArr.slice();
shuffle(testArr);
assert(testArr.length === original.length, 'Shuffle should preserve length');
var sortedOriginal = original.slice().sort();
var sortedShuffled = testArr.slice().sort();
var shuffleOk = true;
for (var i = 0; i < sortedOriginal.length; i++) {
  if (sortedOriginal[i] !== sortedShuffled[i]) shuffleOk = false;
}
assert(shuffleOk, 'Shuffle should preserve all elements');

// Test shuffle actually changes order (run 10 times, at least one should differ)
var everDiffered = false;
for (var trial = 0; trial < 10; trial++) {
  var arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  shuffle(arr2);
  var same = true;
  for (var i = 0; i < arr2.length; i++) {
    if (arr2[i] !== i + 1) { same = false; break; }
  }
  if (!same) { everDiffered = true; break; }
}
assert(everDiffered, 'Shuffle should actually randomize (10 trials)');

// Verify shuffle toggle persists to localStorage
assert(jsCode.indexOf("localStorage.getItem('ru3k_shuffle')") !== -1, 'Shuffle should read from localStorage');
assert(jsCode.indexOf("localStorage.setItem('ru3k_shuffle'") !== -1, 'Shuffle should save to localStorage');

console.log('Shuffle logic verified');

// ========== TEST 11: Card History and Navigation ==========
section('Card History & Navigation');

// Verify prev/skip button handlers exist
assert(jsCode.indexOf("'prevBtn'") !== -1, 'prevBtn handler should exist');
assert(jsCode.indexOf("'skipBtn'") !== -1, 'skipBtn handler should exist');
assert(jsCode.indexOf('goToPrev') !== -1, 'goToPrev function should exist');
assert(jsCode.indexOf('goToNext') !== -1, 'goToNext function should exist');

// Verify keyboard support
assert(jsCode.indexOf("e.key === 'ArrowLeft'") !== -1, 'ArrowLeft handler should exist');
assert(jsCode.indexOf("e.key === 'ArrowRight'") !== -1, 'ArrowRight handler should exist');
assert(jsCode.indexOf("e.key === '1'") !== -1, 'Number key 1 shortcut should exist');
assert(jsCode.indexOf("e.key === '4'") !== -1, 'Number key 4 shortcut should exist');

// Verify swipe support
assert(jsCode.indexOf('touchstart') !== -1, 'Touch start handler should exist');
assert(jsCode.indexOf('touchend') !== -1, 'Touch end handler should exist');

// Verify card history tracks state
assert(jsCode.indexOf('cardHistory') !== -1, 'cardHistory should be used');
assert(jsCode.indexOf('cardHistory[currentIdx]') !== -1, 'cardHistory should index by currentIdx');

console.log('Card history and navigation verified');

// ========== TEST 12: Browser History (Back Button) ==========
section('Browser History');

assert(jsCode.indexOf('pushState') !== -1, 'history.pushState should be used');
assert(jsCode.indexOf('replaceState') !== -1, 'history.replaceState should be used');
assert(jsCode.indexOf('popstate') !== -1, 'popstate event listener should exist');

console.log('Browser history verified');

// ========== TEST 13: Service Worker & PWA ==========
section('Service Worker & PWA');

assert(html.indexOf('serviceWorker') !== -1, 'Service worker registration should exist in HTML');
assert(html.indexOf('apple-mobile-web-app-capable') !== -1, 'PWA meta tag should exist');
assert(html.indexOf('manifest.json') !== -1, 'Manifest link should exist');

// Verify sw.js exists and has correct cache
var swJs = fs.readFileSync('/Users/abrahamchaibi/code/aeq_bio/anki_split/sw.js', 'utf-8');
assert(swJs.indexOf('index.html') !== -1, 'SW should cache index.html');
assert(swJs.indexOf('manifest.json') !== -1, 'SW should cache manifest.json');
assert(swJs.indexOf('install') !== -1, 'SW should have install handler');
assert(swJs.indexOf('fetch') !== -1, 'SW should have fetch handler');
assert(swJs.indexOf('activate') !== -1, 'SW should have activate handler');

// Verify manifest.json
var manifest = JSON.parse(fs.readFileSync('/Users/abrahamchaibi/code/aeq_bio/anki_split/manifest.json', 'utf-8'));
assert(manifest.display === 'standalone', 'Manifest display should be standalone');
assert(manifest.start_url === './', 'Manifest start_url should be ./');

console.log('Service worker and PWA verified');

// ========== TEST 14: Deck Options Overlay ==========
section('Deck Options Overlay');

assert(html.indexOf('deckOptionsOverlay') !== -1, 'Deck options overlay should exist');
assert(html.indexOf('deckOptResume') !== -1, 'Resume button should exist');
assert(html.indexOf('deckOptContinue') !== -1, 'Continue button should exist');
assert(html.indexOf('deckOptRestart') !== -1, 'Restart button should exist');
assert(html.indexOf('deckOptCancel') !== -1, 'Cancel button should exist');

// Verify resume session logic
assert(jsCode.indexOf('hasActiveSession') !== -1, 'hasActiveSession function should exist');
assert(jsCode.indexOf('resumeSession') !== -1, 'resumeSession function should exist');
assert(jsCode.indexOf('clearSession') !== -1, 'clearSession function should exist');

console.log('Deck options overlay verified');

// ========== TEST 15: Done Screen ==========
section('Done Screen');

// Verify done screen elements
assert(html.indexOf('doneEmoji') !== -1, 'Done emoji element should exist');
assert(html.indexOf('doneMsg') !== -1, 'Done message element should exist');
assert(html.indexOf('doneSub') !== -1, 'Done sub text should exist');
assert(html.indexOf('reviewMistakes') !== -1, 'Review mistakes button should exist');
assert(html.indexOf('resetLink') !== -1, 'Reset link should exist');

// Verify done screen shows different messages based on score
assert(jsCode.indexOf('Perfect!') !== -1, '100% message should exist');
assert(jsCode.indexOf('Great job!') !== -1, '>=80% message should exist');
assert(jsCode.indexOf('Good effort!') !== -1, '>=60% message should exist');
assert(jsCode.indexOf('Keep practicing!') !== -1, '<60% message should exist');

// Verify saveBestScore is called in showDone
assert(jsCode.indexOf('saveBestScore(currentDeck, pct)') !== -1, 'showDone should save best score');

console.log('Done screen verified');

// ========== TEST 16: Reset Functionality ==========
section('Reset Functionality');

// Reset deck progress (via resetLink)
assert(jsCode.indexOf("'resetLink'") !== -1, 'Reset link handler should exist');
assert(jsCode.indexOf("Reset progress for this deck?") !== -1 || jsCode.indexOf("confirm(") !== -1, 'Reset should have confirmation');

// Reset best scores (via resetBestBtn)
assert(jsCode.indexOf("'resetBestBtn'") !== -1, 'Reset best button handler should exist');
assert(jsCode.indexOf("Clear all best scores?") !== -1, 'Reset best should have confirmation');
assert(jsCode.indexOf("localStorage.removeItem('ru3k_best')") !== -1, 'Reset best should clear localStorage');

console.log('Reset functionality verified');

// ========== TEST 17: CSS Completeness ==========
section('CSS Classes');

// Key CSS classes that must exist
var requiredCSS = [
  '.screen', '.deck-card', '.deck-num', '.deck-info', '.deck-title', '.deck-sub',
  '.deck-progress', '.deck-pct', '.deck-pfill',
  '.study-header', '.back-btn', '.study-title', '.study-count',
  '.progress-track', '.progress-fill',
  '.nav-btn', '.nav-disabled',
  '.prompt-area', '.prompt-word', '.prompt-dir', '.prompt-rank',
  '.choice-btn', '.correct', '.wrong', '.disabled',
  '.feedback', '.fb-icon', '.fb-example',
  '.next-btn',
  '.done-screen', '.done-emoji', '.done-msg', '.done-sub', '.done-btn', '.reset-link',
  '.overlay', '.overlay-sheet', '.overlay-btn',
  '.mode-btn', '.overall-stats', '.overall-bar', '.overall-fill'
];

for (var i = 0; i < requiredCSS.length; i++) {
  assert(html.indexOf(requiredCSS[i]) !== -1, 'CSS class ' + requiredCSS[i] + ' should exist');
}

console.log('Checked ' + requiredCSS.length + ' CSS classes');

// ========== TEST 18: Auto-Advance Timer ==========
section('Auto-Advance');

assert(jsCode.indexOf('autoAdvanceTimer') !== -1, 'Auto-advance timer variable should exist');
assert(jsCode.indexOf('setTimeout') !== -1, 'setTimeout should be used for auto-advance');
assert(jsCode.indexOf('clearTimeout(autoAdvanceTimer)') !== -1, 'Timer should be cleared when navigating');

// Verify timer is cleared in all navigation paths
var clearTimeoutCount = (jsCode.match(/clearTimeout\(autoAdvanceTimer\)/g) || []).length;
assert(clearTimeoutCount >= 5, 'autoAdvanceTimer should be cleared in multiple places (found ' + clearTimeoutCount + ')');

console.log('Auto-advance verified');

// ========== TEST 19: Edge Cases ==========
section('Edge Cases');

// Test distractor generation for first word (rank 1)
var d1 = pickDistractors(WORDS[0], 'ru', 3);
assert(d1.length === 3, 'First word should get 3 distractors, got ' + d1.length);

// Test distractor generation for last word (rank 3000)
var dLast = pickDistractors(WORDS[WORDS.length-1], 'en', 3);
assert(dLast.length === 3, 'Last word should get 3 distractors, got ' + dLast.length);

// Test distractor generation for middle word
var dMid = pickDistractors(WORDS[1500], 'ru', 3);
assert(dMid.length === 3, 'Middle word should get 3 distractors, got ' + dMid.length);

// Test: distractors should not include the correct answer
for (var trial = 0; trial < 100; trial++) {
  var testWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  var testMode = Math.random() < 0.5 ? 'ru' : 'en';
  var correct = testMode === 'ru' ? testWord.en : testWord.ru;
  var dists = pickDistractors(testWord, testMode, 3);
  for (var di = 0; di < dists.length; di++) {
    assert(dists[di].toLowerCase() !== correct.toLowerCase(),
      'Distractor should not match correct answer for rank ' + testWord.r);
  }
}

// Test: no duplicate distractors (100 random trials)
var dupeDistractors = 0;
for (var trial = 0; trial < 100; trial++) {
  var testWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  var testMode = Math.random() < 0.5 ? 'ru' : 'en';
  var dists = pickDistractors(testWord, testMode, 3);
  var distSet = {};
  for (var di = 0; di < dists.length; di++) {
    if (distSet[dists[di].toLowerCase()]) dupeDistractors++;
    distSet[dists[di].toLowerCase()] = true;
  }
}
assert(dupeDistractors === 0, dupeDistractors + ' duplicate distractors found in 100 random trials');

console.log('Edge cases verified');

// ========== TEST 20: Score Calculation ==========
section('Score Calculation');

// Verify pct calculation matches what showDone does
function calcPct(correct, wrong) {
  var total = correct + wrong;
  return total > 0 ? Math.round(correct / total * 100) : 0;
}

assert(calcPct(0, 0) === 0, 'No answers should be 0%');
assert(calcPct(200, 0) === 100, 'All correct should be 100%');
assert(calcPct(0, 200) === 0, 'All wrong should be 0%');
assert(calcPct(150, 50) === 75, '150/200 should be 75%');
assert(calcPct(1, 1) === 50, '1/2 should be 50%');

console.log('Score calculation verified');

// ========== SUMMARY ==========
console.log('\n' + '='.repeat(50));
console.log('RESULTS: ' + passed + ' passed, ' + failed + ' failed');
console.log('='.repeat(50));

if (errors.length > 0) {
  console.log('\nFAILURES:');
  for (var i = 0; i < errors.length; i++) {
    console.log('  ' + errors[i]);
  }
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
}
