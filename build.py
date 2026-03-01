#!/usr/bin/env python3
"""Assemble russian3000.html from separate HTML template, JS, and JSON data files."""

import os

dir_path = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(dir_path, 'words_compact.json'), 'r', encoding='utf-8') as f:
    json_data = f.read()

with open(os.path.join(dir_path, 'app.js'), 'r', encoding='utf-8') as f:
    js_code = f.read()

# Ensure JSON doesn't contain </script>
json_safe = json_data.replace('</script>', '<\\/script>')

html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="RU 3000">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%236c7bf0'/><text x='50' y='62' text-anchor='middle' font-size='40' font-weight='bold' fill='white'>RU</text></svg>">
<link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%236c7bf0'/><text x='50' y='62' text-anchor='middle' font-size='40' font-weight='bold' fill='white'>RU</text></svg>">
<title>Russian 3000</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#0a0a0f;--surface:#16161f;--surface2:#1e1e2a;--border:#2a2a3a;
  --text:#e8e8f0;--text2:#8888a0;--accent:#6c7bf0;--accent2:#8b98f8;
  --green:#4ade80;--red:#f87171;--orange:#fbbf24;
}
html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,'SF Pro','Segoe UI',sans-serif;background:var(--bg);color:var(--text);overflow:hidden;touch-action:manipulation}
.screen{display:none;flex-direction:column;height:100%;height:100dvh}
.screen.active{display:flex}

/* DECK LIST */
.header{padding:20px 20px 12px;padding-top:max(20px,env(safe-area-inset-top))}
.header h1{font-size:28px;font-weight:700;letter-spacing:-0.5px}
.header p{color:var(--text2);font-size:14px;margin-top:4px}
.deck-list{flex:1;overflow-y:auto;padding:8px 16px 80px;-webkit-overflow-scrolling:touch}
.deck-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px;display:flex;align-items:center;cursor:pointer;transition:transform .15s,background .15s}
.deck-card:active{transform:scale(0.97);background:var(--surface2)}
.deck-num{font-size:13px;font-weight:600;color:var(--accent);width:28px;flex-shrink:0}
.deck-info{flex:1;min-width:0}
.deck-title{font-size:16px;font-weight:600}
.deck-sub{font-size:13px;color:var(--text2);margin-top:2px}
.deck-progress{width:56px;text-align:right;flex-shrink:0}
.deck-pct{font-size:15px;font-weight:700}
.deck-pbar{height:3px;background:var(--border);border-radius:2px;margin-top:6px;overflow:hidden}
.deck-pfill{height:100%;background:var(--accent);border-radius:2px;transition:width .3s}
.overall-stats{padding:16px 20px;background:var(--surface);border-top:1px solid var(--border)}
.overall-bar{height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:8px}
.overall-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--green));border-radius:2px;transition:width .5s}
.overall-text{font-size:13px;color:var(--text2);text-align:center}
.mode-toggle{display:flex;gap:6px;margin-top:12px;padding:0 20px}
.mode-btn{flex:1;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text2);font-size:13px;font-weight:600;text-align:center;cursor:pointer;transition:all .2s}
.mode-btn.active{border-color:var(--accent);color:var(--accent);background:rgba(108,123,240,0.08)}

/* STUDY SCREEN */
.study-header{display:flex;align-items:center;padding:12px 16px;padding-top:max(12px,env(safe-area-inset-top));gap:12px}
.back-btn{font-size:24px;cursor:pointer;color:var(--text2);width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px}
.back-btn:active{background:var(--surface2)}
.study-title{flex:1;font-size:16px;font-weight:600;text-align:center}
.study-count{font-size:14px;color:var(--text2);font-weight:500;width:60px;text-align:right}
.progress-track{height:3px;background:var(--border);margin:0 16px}
.progress-fill{height:100%;background:var(--accent);border-radius:2px;transition:width .3s}

/* NAV BUTTONS */
.study-nav{display:flex;justify-content:space-between;padding:8px 20px 0}
.nav-btn{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface);color:var(--text2);font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;-webkit-appearance:none}
.nav-btn:active:not(.nav-disabled){transform:scale(0.9);background:var(--surface2)}
.nav-btn.nav-disabled{opacity:0.25;pointer-events:none}

/* PROMPT */
.prompt-area{padding:24px 24px 16px;text-align:center}
.prompt-meta{display:flex;justify-content:space-between;padding:0 4px;margin-bottom:16px}
.prompt-dir{font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:1px}
.prompt-rank{font-size:12px;color:var(--text2);font-weight:500}
.prompt-word{font-size:38px;font-weight:700;line-height:1.2}

/* CHOICES */
.choices{flex:1;display:flex;flex-direction:column;gap:10px;padding:8px 20px;overflow-y:auto}
.choice-btn{width:100%;padding:16px 20px;border:1.5px solid var(--border);border-radius:14px;background:var(--surface);color:var(--text);font-size:17px;font-weight:500;text-align:left;cursor:pointer;transition:all .2s;-webkit-appearance:none;appearance:none;line-height:1.3}
.choice-btn:active:not(.disabled){transform:scale(0.98);background:var(--surface2)}
.choice-btn.correct{border-color:var(--green);background:rgba(74,222,128,0.12);color:var(--green)}
.choice-btn.wrong{border-color:var(--red);background:rgba(248,113,113,0.12);color:var(--red)}
.choice-btn.disabled{pointer-events:none;opacity:0.5}
.choice-btn.correct.disabled{opacity:1}
.choice-btn.wrong.disabled{opacity:1}

/* FEEDBACK */
.feedback{display:none;padding:16px 24px;border-radius:14px;margin:8px 20px 0;font-size:15px;line-height:1.5;transition:all .2s}
.feedback.correct{background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);color:var(--green)}
.feedback.wrong{background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);color:var(--text)}
.fb-icon{font-size:18px;font-weight:700;margin-right:6px}
.feedback.correct .fb-icon{color:var(--green)}
.feedback.wrong .fb-icon{color:var(--red)}
.fb-example{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);font-size:14px}
.fb-ex-ru{color:var(--text)}
.fb-ex-en{color:var(--text2)}

/* NEXT BUTTON */
.next-btn{display:none;margin:12px 20px;padding:16px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;text-align:center;-webkit-appearance:none}
.next-btn:active{opacity:0.8}

/* BOTTOM PADDING */
.study-bottom{padding-bottom:max(16px,env(safe-area-inset-bottom))}

/* DONE SCREEN */
.done-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center}
.done-emoji{font-size:64px;margin-bottom:8px}
.done-msg{font-size:24px;font-weight:700;margin-bottom:4px}
.done-sub{color:var(--text2);font-size:17px;margin-bottom:32px;line-height:1.5}
.done-btn{padding:14px 32px;background:var(--accent);color:#fff;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;border:none;-webkit-appearance:none}
.done-btn:active{opacity:0.8}
.reset-link{color:var(--text2);font-size:13px;margin-top:16px;cursor:pointer;text-decoration:underline}

/* DECK OPTIONS OVERLAY */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.overlay.active{display:flex}
.overlay-sheet{width:100%;max-width:420px;background:var(--surface);border-radius:20px 20px 0 0;padding:24px 20px;padding-bottom:max(24px,env(safe-area-inset-bottom))}
.overlay-title{font-size:18px;font-weight:700;margin-bottom:4px}
.overlay-sub{font-size:14px;color:var(--text2);margin-bottom:20px}
.overlay-btn{width:100%;padding:16px;border:1.5px solid var(--border);border-radius:14px;background:var(--surface2);color:var(--text);font-size:16px;font-weight:600;text-align:center;cursor:pointer;margin-bottom:10px;-webkit-appearance:none}
.overlay-btn:active{opacity:0.8;transform:scale(0.98)}
.overlay-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.overlay-btn.cancel{background:transparent;border-color:transparent;color:var(--text2);font-weight:500}
</style>
</head>
<body>

<!-- DECK LIST -->
<div class="screen active" id="deckScreen">
  <div class="header">
    <h1>Russian 3000</h1>
    <p>Most frequent words, by rank</p>
  </div>
  <div class="mode-toggle">
    <div class="mode-btn active" data-mode="ru">RU &rarr; EN</div>
    <div class="mode-btn" data-mode="en">EN &rarr; RU</div>
    <div class="mode-btn" data-mode="mix">Mixed</div>
  </div>
  <div class="mode-toggle" style="margin-top:6px">
    <div class="mode-btn" id="shuffleBtn">Shuffle: Off</div>
    <div class="mode-btn" id="resetBestBtn">Reset Best Scores</div>
  </div>
  <div class="deck-list" id="deckList"></div>
  <div class="overall-stats">
    <div class="overall-bar"><div class="overall-fill" id="overallFill"></div></div>
    <div class="overall-text" id="overallText"></div>
  </div>
</div>

<!-- STUDY SCREEN -->
<div class="screen" id="studyScreen">
  <div class="study-header">
    <div class="back-btn" id="backBtn">&#8249;</div>
    <div class="study-title" id="studyTitle"></div>
    <div class="study-count" id="studyCount"></div>
  </div>
  <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
  <div class="study-nav">
    <button class="nav-btn nav-disabled" id="prevBtn">&#8249;</button>
    <button class="nav-btn" id="skipBtn">&#8250;</button>
  </div>
  <div class="prompt-area">
    <div class="prompt-meta">
      <span class="prompt-dir" id="promptDir"></span>
      <span class="prompt-rank" id="promptRank"></span>
    </div>
    <div class="prompt-word" id="promptWord"></div>
  </div>
  <div class="choices" id="choices"></div>
  <div class="feedback" id="feedback"></div>
  <button class="next-btn" id="nextBtn">Next</button>
  <div class="study-bottom"></div>
</div>

<!-- DONE SCREEN -->
<div class="screen" id="doneScreen">
  <div class="study-header">
    <div class="back-btn" id="doneBackBtn">&#8249;</div>
    <div class="study-title" id="doneTitle"></div>
    <div class="study-count"></div>
  </div>
  <div class="done-screen">
    <div class="done-emoji" id="doneEmoji">&#127881;</div>
    <div class="done-msg" id="doneMsg">Deck Complete!</div>
    <div class="done-sub" id="doneSub"></div>
    <button class="done-btn" id="reviewMistakes" style="display:none">Review Mistakes</button>
    <button class="done-btn" id="doneBtn" style="margin-top:12px">Back to Decks</button>
    <div class="reset-link" id="resetLink">Reset this deck</div>
  </div>
</div>

<!-- DECK OPTIONS OVERLAY -->
<div class="overlay" id="deckOptionsOverlay">
  <div class="overlay-sheet">
    <div class="overlay-title" id="deckOptTitle"></div>
    <div class="overlay-sub" id="deckOptSub"></div>
    <button class="overlay-btn primary" id="deckOptResume" style="display:none">Resume Session</button>
    <button class="overlay-btn primary" id="deckOptContinue">Continue</button>
    <button class="overlay-btn" id="deckOptRestart">Start Over</button>
    <button class="overlay-btn cancel" id="deckOptCancel">Cancel</button>
  </div>
</div>

'''

# Write the complete file
output_path = os.path.join(dir_path, 'index.html')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html)
    f.write('<script id="wordData" type="application/json">\n')
    f.write(json_safe)
    f.write('\n</script>\n')
    f.write('<script>\n')
    f.write(js_code)
    f.write('\n</script>\n')
    f.write('</body>\n</html>\n')

size = os.path.getsize(output_path)
print(f"Built index.html ({size/1024:.0f} KB)")
