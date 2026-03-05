var WORDS = JSON.parse(document.getElementById("wordData").textContent);

var DECK_SIZE = 200;
var NUM_DECKS = Math.ceil(WORDS.length / DECK_SIZE);
var studyMode = localStorage.getItem('ru3k_mode') || 'ru';
var shuffleOn = localStorage.getItem('ru3k_shuffle') === '1';
var currentDeck = -1;
var studyQueue = [];
var currentIdx = 0;
var mistakes = [];
var sessionStats = { correct: 0, wrong: 0 };
var answered = false;
var autoAdvanceTimer = null;
var cardHistory = []; // stores { choices, correctAnswer, selectedAnswer, isCorrect } per index
var isReviewSession = false;

function getProgress() {
  try { return JSON.parse(localStorage.getItem('ru3k_progress') || '{}'); }
  catch(e) { return {}; }
}
function saveProgress(p) { localStorage.setItem('ru3k_progress', JSON.stringify(p)); }
function getDeckKey(deckIdx, mode) { return deckIdx + '_' + mode; }

// Best scores: { "0_ru": 85, "0_en": 90, ... }
function getBestScores() {
  try { return JSON.parse(localStorage.getItem('ru3k_best') || '{}'); }
  catch(e) { return {}; }
}
function saveBestScore(deckIdx, pct) {
  var best = getBestScores();
  var key = deckIdx + '_' + studyMode;
  if (!best[key] || pct > best[key]) {
    best[key] = pct;
    localStorage.setItem('ru3k_best', JSON.stringify(best));
  }
}
function getDeckBestScore(deckIdx) {
  var best = getBestScores();
  var key = deckIdx + '_' + studyMode;
  return best[key] || null;
}

// Session state persistence (survives going back to deck list)
function saveSession() {
  var session = {
    deck: currentDeck,
    mode: studyMode,
    queue: studyQueue,
    idx: currentIdx,
    mistakes: mistakes,
    stats: sessionStats,
    history: cardHistory,
    review: isReviewSession
  };
  localStorage.setItem('ru3k_session', JSON.stringify(session));
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem('ru3k_session')); }
  catch(e) { return null; }
}
function clearSession() {
  localStorage.removeItem('ru3k_session');
}

function getDeckWords(deckIdx) {
  var start = deckIdx * DECK_SIZE;
  return WORDS.slice(start, start + DECK_SIZE);
}

function getDeckProgress(deckIdx) {
  var progress = getProgress();
  var words = getDeckWords(deckIdx);
  var modes = studyMode === 'mix' ? ['ru', 'en'] : [studyMode];
  var learned = 0, total = 0;
  for (var mi = 0; mi < modes.length; mi++) {
    var key = getDeckKey(deckIdx, modes[mi]);
    var dp = progress[key] || {};
    for (var wi = 0; wi < words.length; wi++) {
      total++;
      if ((dp[words[wi].r] || 0) >= 1) learned++;
    }
  }
  return { learned: learned, total: total };
}

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

// ===== DECK LIST =====
function renderDeckList() {
  var list = document.getElementById('deckList');
  list.innerHTML = '';
  var totalLearned = 0, totalCards = 0;

  for (var i = 0; i < NUM_DECKS; i++) {
    var words = getDeckWords(i);
    var first = words[0].r, last = words[words.length - 1].r;
    var prog = getDeckProgress(i);
    totalLearned += prog.learned;
    totalCards += prog.total;
    var pct = prog.total > 0 ? Math.round(prog.learned / prog.total * 100) : 0;

    var best = getDeckBestScore(i);
    var bestStr = best !== null ? 'Best: ' + best + '%' : '';

    var el = document.createElement('div');
    el.className = 'deck-card';
    el.innerHTML =
      '<div class="deck-num">' + (i + 1) + '</div>' +
      '<div class="deck-info">' +
        '<div class="deck-title">Words ' + first + '\u2013' + last + '</div>' +
        '<div class="deck-sub">' + (prog.total - prog.learned) + ' remaining' + (bestStr ? ' \u00b7 ' + bestStr : '') + '</div>' +
      '</div>' +
      '<div class="deck-progress">' +
        '<div class="deck-pct" style="color:' + (pct===100?'var(--green)':pct>0?'var(--accent)':'var(--text2)') + '">' + pct + '%</div>' +
        '<div class="deck-pbar"><div class="deck-pfill" style="width:' + pct + '%;' + (pct===100?'background:var(--green)':'') + '"></div></div>' +
      '</div>';
    el.addEventListener('click', (function(idx, hasProg) { return function() {
      if (hasProg || hasActiveSession(idx)) { showDeckOptions(idx); } else { startStudy(idx, false); }
    }; })(i, prog.learned > 0));
    list.appendChild(el);
  }

  var overallPct = totalCards > 0 ? Math.round(totalLearned / totalCards * 100) : 0;
  document.getElementById('overallFill').style.width = overallPct + '%';
  document.getElementById('overallText').textContent = totalLearned + ' / ' + totalCards + ' learned (' + overallPct + '%)';
}

// Mode toggle
document.querySelectorAll('.mode-btn').forEach(function(btn) {
  if (btn.dataset.mode === studyMode) btn.classList.add('active');
  else btn.classList.remove('active');
  btn.addEventListener('click', function() {
    studyMode = btn.dataset.mode;
    localStorage.setItem('ru3k_mode', studyMode);
    document.querySelectorAll('.mode-btn').forEach(function(b) {
      if (b.dataset.mode === studyMode) b.classList.add('active');
      else b.classList.remove('active');
    });
    renderDeckList();
  });
});

// Reset best scores
document.getElementById('resetBestBtn').addEventListener('click', function() {
  if (!confirm('Clear all best scores?')) return;
  localStorage.removeItem('ru3k_best');
  renderDeckList();
});

// Shuffle toggle
var shuffleBtn = document.getElementById('shuffleBtn');
function updateShuffleBtn() {
  if (shuffleOn) {
    shuffleBtn.classList.add('active');
    shuffleBtn.textContent = 'Shuffle: On';
  } else {
    shuffleBtn.classList.remove('active');
    shuffleBtn.textContent = 'Shuffle: Off';
  }
}
updateShuffleBtn();
shuffleBtn.addEventListener('click', function() {
  shuffleOn = !shuffleOn;
  localStorage.setItem('ru3k_shuffle', shuffleOn ? '1' : '0');
  updateShuffleBtn();
});

// ===== DECK OPTIONS =====
function hasActiveSession(deckIdx) {
  var session = loadSession();
  if (!session) return false;
  return session.deck === deckIdx && session.mode === studyMode && session.idx < session.queue.length;
}

function resumeSession() {
  var session = loadSession();
  if (!session) return false;
  currentDeck = session.deck;
  studyQueue = session.queue;
  currentIdx = session.idx;
  mistakes = session.mistakes;
  sessionStats = session.stats;
  cardHistory = session.history || [];
  isReviewSession = session.review || false;

  var words = getDeckWords(currentDeck);
  var first = words[0].r, last = words[words.length - 1].r;
  document.getElementById('studyTitle').textContent = 'Words ' + first + '\u2013' + last;

  showScreen('studyScreen');
  renderQuestion();
  return true;
}

function showDeckOptions(deckIdx) {
  var overlay = document.getElementById('deckOptionsOverlay');
  var words = getDeckWords(deckIdx);
  var first = words[0].r, last = words[words.length - 1].r;
  var prog = getDeckProgress(deckIdx);
  var remaining = prog.total - prog.learned;
  var hasSession = hasActiveSession(deckIdx);

  document.getElementById('deckOptTitle').textContent = 'Words ' + first + '\u2013' + last;

  var resumeBtn = document.getElementById('deckOptResume');
  var continueBtn = document.getElementById('deckOptContinue');

  if (hasSession) {
    var session = loadSession();
    var answered = session.stats.correct + session.stats.wrong;
    document.getElementById('deckOptSub').textContent = 'Session in progress: ' + answered + '/' + session.queue.length + ' answered';
    resumeBtn.style.display = '';
    resumeBtn.textContent = 'Resume Session';
  } else {
    document.getElementById('deckOptSub').textContent = prog.learned + ' learned, ' + remaining + ' remaining';
    resumeBtn.style.display = 'none';
  }

  if (remaining > 0 && !hasSession) {
    continueBtn.style.display = '';
    continueBtn.textContent = 'Continue (' + remaining + ' cards)';
  } else if (!hasSession) {
    continueBtn.style.display = 'none';
  } else {
    continueBtn.style.display = '';
    continueBtn.textContent = 'New Session (' + remaining + ' cards)';
  }

  resumeBtn.onclick = function() { overlay.classList.remove('active'); resumeSession(); };
  continueBtn.onclick = function() { overlay.classList.remove('active'); clearSession(); startStudy(deckIdx, false); };
  document.getElementById('deckOptRestart').onclick = function() { overlay.classList.remove('active'); clearSession(); startStudy(deckIdx, true); };
  document.getElementById('deckOptCancel').onclick = function() { overlay.classList.remove('active'); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.classList.remove('active'); };

  overlay.classList.add('active');
}

// ===== STUDY =====
function startStudy(deckIdx, restart) {
  currentDeck = deckIdx;
  var words = getDeckWords(deckIdx);
  var progress = getProgress();
  var modes = studyMode === 'mix' ? ['ru', 'en'] : [studyMode];

  if (restart) {
    for (var ri = 0; ri < modes.length; ri++) {
      delete progress[getDeckKey(deckIdx, modes[ri])];
    }
    saveProgress(progress);
  }

  studyQueue = [];
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    for (var mi = 0; mi < modes.length; mi++) {
      var m = modes[mi];
      var key = getDeckKey(deckIdx, m);
      var score = (progress[key] || {})[w.r] || 0;
      if (score < 1) {
        studyQueue.push({ word: w, mode: m });
      }
    }
  }

  if (shuffleOn) shuffle(studyQueue);

  currentIdx = 0;
  answered = false;
  mistakes = [];
  sessionStats = { correct: 0, wrong: 0 };
  cardHistory = [];
  isReviewSession = false;

  var first = words[0].r, last = words[words.length - 1].r;
  document.getElementById('studyTitle').textContent = 'Words ' + first + '\u2013' + last;

  showScreen('studyScreen');
  renderQuestion();
  saveSession();
}

function updateNavButtons() {
  var prevBtn = document.getElementById('prevBtn');
  var skipBtn = document.getElementById('skipBtn');
  prevBtn.classList.toggle('nav-disabled', currentIdx <= 0);
  skipBtn.classList.toggle('nav-disabled', currentIdx >= studyQueue.length - 1);
}

function renderQuestion() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }

  if (currentIdx >= studyQueue.length) {
    showDone();
    return;
  }

  var item = studyQueue[currentIdx];
  var word = item.word;
  var mode = item.mode;

  document.getElementById('studyCount').textContent = (currentIdx + 1) + '/' + studyQueue.length;
  document.getElementById('progressFill').style.width = (currentIdx / studyQueue.length * 100) + '%';

  var isFrontRu = mode === 'ru';
  var promptWord = isFrontRu ? word.ru : word.en;
  var correctAnswer = isFrontRu ? word.en : word.ru;
  var dirLabel = isFrontRu ? 'RU \u2192 EN' : 'EN \u2192 RU';

  document.getElementById('promptDir').textContent = dirLabel;
  document.getElementById('promptRank').textContent = '#' + word.r;
  document.getElementById('promptWord').textContent = promptWord;

  // Check if we have history for this card (going back)
  var hist = cardHistory[currentIdx];

  if (hist) {
    // Replay from history
    answered = hist.selectedAnswer !== null;
    renderChoiceButtons(hist.choices, correctAnswer, hist.selectedAnswer);
    if (hist.selectedAnswer !== null) {
      renderFeedbackState(hist.isCorrect, word);
    } else {
      document.getElementById('feedback').style.display = 'none';
      document.getElementById('nextBtn').style.display = 'none';
    }
  } else {
    // New card
    answered = false;
    var distractors = pickDistractors(word, mode, 3);
    var choices = shuffle([correctAnswer].concat(distractors));

    // Store in history (unanswered)
    cardHistory[currentIdx] = {
      choices: choices,
      correctAnswer: correctAnswer,
      selectedAnswer: null,
      isCorrect: null
    };

    renderChoiceButtons(choices, correctAnswer, null);
    document.getElementById('feedback').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'none';
  }

  updateNavButtons();
}

function renderChoiceButtons(choices, correctAnswer, selectedAnswer) {
  var choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  for (var i = 0; i < choices.length; i++) {
    var btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choices[i];
    btn.dataset.answer = choices[i];
    btn.dataset.correct = (choices[i] === correctAnswer) ? '1' : '0';

    if (selectedAnswer !== null) {
      // Already answered — show result state
      btn.classList.add('disabled');
      if (choices[i] === correctAnswer) btn.classList.add('correct');
      if (choices[i] === selectedAnswer && selectedAnswer !== correctAnswer) btn.classList.add('wrong');
    } else {
      btn.addEventListener('click', handleChoice);
    }

    choicesEl.appendChild(btn);
  }
}

function renderFeedbackState(isCorrect, word) {
  var feedbackEl = document.getElementById('feedback');
  feedbackEl.style.display = 'block';

  if (isCorrect) {
    feedbackEl.className = 'feedback correct';
    feedbackEl.innerHTML = '<span class="fb-icon">\u2713</span> Correct!';
    document.getElementById('nextBtn').style.display = 'none';
  } else {
    var feedbackHTML = '<span class="fb-icon">\u2717</span> ';
    feedbackHTML += '<strong>' + word.ru + '</strong> = <strong>' + word.en + '</strong>';
    if (word.ex && word.ex.length > 0) {
      feedbackHTML += '<div class="fb-example"><span class="fb-ex-ru">' + word.ex[0][0] + '</span><br><span class="fb-ex-en">' + word.ex[0][1] + '</span></div>';
    }
    feedbackEl.className = 'feedback wrong';
    feedbackEl.innerHTML = feedbackHTML;
    document.getElementById('nextBtn').style.display = 'block';
  }
}

function handleChoice(e) {
  if (answered) return;
  answered = true;

  var btn = e.currentTarget;
  var selectedAnswer = btn.dataset.answer;
  var isCorrect = btn.dataset.correct === '1';
  var item = studyQueue[currentIdx];
  var word = item.word;
  var mode = item.mode;

  // Save to history
  cardHistory[currentIdx].selectedAnswer = selectedAnswer;
  cardHistory[currentIdx].isCorrect = isCorrect;

  // Highlight buttons
  var allBtns = document.querySelectorAll('.choice-btn');
  for (var i = 0; i < allBtns.length; i++) {
    allBtns[i].classList.add('disabled');
    if (allBtns[i].dataset.correct === '1') allBtns[i].classList.add('correct');
  }

  // Update progress
  var progress = getProgress();
  var key = getDeckKey(currentDeck, mode);
  if (!progress[key]) progress[key] = {};

  if (isCorrect) {
    btn.classList.add('correct');
    sessionStats.correct++;
    progress[key][word.r] = Math.min((progress[key][word.r] || 0) + 1, 3);
    renderFeedbackState(true, word);

    autoAdvanceTimer = setTimeout(function() {
      currentIdx++;
      renderQuestion();
    }, 800);
  } else {
    btn.classList.add('wrong');
    sessionStats.wrong++;
    progress[key][word.r] = 0;
    mistakes.push(item);
    renderFeedbackState(false, word);
  }

  saveProgress(progress);
  updateNavButtons();
  saveSession();
}

// ===== NAV: PREV / SKIP =====
function goToPrev() {
  if (currentIdx <= 0) return;
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  currentIdx--;
  renderQuestion();
  saveSession();
}

function goToNext() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  currentIdx++;
  renderQuestion();
  saveSession();
}

document.getElementById('prevBtn').addEventListener('click', goToPrev);
document.getElementById('skipBtn').addEventListener('click', goToNext);

document.getElementById('nextBtn').addEventListener('click', function() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  currentIdx++;
  renderQuestion();
  saveSession();
});

// Keyboard support
document.addEventListener('keydown', function(e) {
  if (!document.getElementById('studyScreen').classList.contains('active')) return;

  if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); goToNext(); return; }

  if (!answered) {
    var btns = document.querySelectorAll('.choice-btn');
    if (e.key === '1' && btns.length >= 1) btns[0].click();
    else if (e.key === '2' && btns.length >= 2) btns[1].click();
    else if (e.key === '3' && btns.length >= 3) btns[2].click();
    else if (e.key === '4' && btns.length >= 4) btns[3].click();
  } else {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      goToNext();
    }
  }
});

// Swipe support
var touchStartX2 = 0;
document.getElementById('studyScreen').addEventListener('touchstart', function(e) {
  touchStartX2 = e.touches[0].clientX;
}, { passive: true });
document.getElementById('studyScreen').addEventListener('touchend', function(e) {
  var dx = e.changedTouches[0].clientX - touchStartX2;
  if (Math.abs(dx) < 60) return;
  if (dx < -60) { goToNext(); }
  else if (dx > 60) { goToPrev(); }
}, { passive: true });

function showDone() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  clearSession();
  var words = getDeckWords(currentDeck);
  var first = words[0].r, last = words[words.length - 1].r;
  document.getElementById('doneTitle').textContent = 'Words ' + first + '\u2013' + last;

  var total = sessionStats.correct + sessionStats.wrong;
  var pct = total > 0 ? Math.round(sessionStats.correct / total * 100) : 0;
  if (!isReviewSession) saveBestScore(currentDeck, pct);

  var prevBest = getDeckBestScore(currentDeck);
  var scoreText = sessionStats.correct + '/' + total + ' correct (' + pct + '%)';
  if (prevBest !== null && prevBest > pct) {
    scoreText += '\nBest: ' + prevBest + '%';
  } else if (prevBest !== null && prevBest === pct && pct < 100) {
    scoreText += '\nBest: ' + prevBest + '%';
  }
  document.getElementById('doneSub').textContent = scoreText;

  var reviewBtn = document.getElementById('reviewMistakes');
  if (mistakes.length > 0) {
    reviewBtn.style.display = '';
    reviewBtn.textContent = 'Review ' + mistakes.length + ' Mistakes';
  } else {
    reviewBtn.style.display = 'none';
  }

  var doneTitle = document.getElementById('doneEmoji');
  if (pct === 100) {
    doneTitle.textContent = '\uD83C\uDF1F';
    document.getElementById('doneMsg').textContent = 'Perfect!';
  } else if (pct >= 80) {
    doneTitle.textContent = '\uD83C\uDF89';
    document.getElementById('doneMsg').textContent = 'Great job!';
  } else if (pct >= 60) {
    doneTitle.textContent = '\uD83D\uDCAA';
    document.getElementById('doneMsg').textContent = 'Good effort!';
  } else {
    doneTitle.textContent = '\uD83D\uDCDA';
    document.getElementById('doneMsg').textContent = 'Keep practicing!';
  }

  showScreen('doneScreen');
}

// ===== NAVIGATION =====
function showScreen(id, pushHistory) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  if (id === 'deckScreen') renderDeckList();

  // Push browser history so back button works
  if (pushHistory !== false) {
    if (id === 'studyScreen' || id === 'doneScreen') {
      history.pushState({ screen: id }, '');
    } else if (id === 'deckScreen') {
      // Replace current state so we don't stack deck screens
      history.replaceState({ screen: 'deckScreen' }, '');
    }
  }
}

// Handle browser back button
window.addEventListener('popstate', function(e) {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  var overlay = document.getElementById('deckOptionsOverlay');
  if (overlay.classList.contains('active')) {
    overlay.classList.remove('active');
    // Push state back so next back press still works
    history.pushState({ screen: 'deckScreen' }, '');
    return;
  }
  showScreen('deckScreen', false);
});

// Set initial state
history.replaceState({ screen: 'deckScreen' }, '');

document.getElementById('backBtn').addEventListener('click', function() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  showScreen('deckScreen');
});
document.getElementById('doneBackBtn').addEventListener('click', function() { showScreen('deckScreen'); });
document.getElementById('doneBtn').addEventListener('click', function() { showScreen('deckScreen'); });

document.getElementById('reviewMistakes').addEventListener('click', function() {
  studyQueue = mistakes.slice();
  shuffle(studyQueue);
  currentIdx = 0;
  mistakes = [];
  sessionStats = { correct: 0, wrong: 0 };
  cardHistory = [];
  isReviewSession = true;
  showScreen('studyScreen');
  renderQuestion();
  saveSession();
});

document.getElementById('resetLink').addEventListener('click', function() {
  if (!confirm('Reset progress for this deck?')) return;
  var progress = getProgress();
  var modes = ['ru', 'en'];
  for (var i = 0; i < modes.length; i++) {
    delete progress[getDeckKey(currentDeck, modes[i])];
  }
  saveProgress(progress);
  showScreen('deckScreen');
});

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function() {});
}

// Init
renderDeckList();
