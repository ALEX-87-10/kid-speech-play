/* 星星小屋 · 交互逻辑
   页面路由、点读、儿歌/古诗逐句高亮、语音识别问答、庆祝粒子 */
(function () {
  "use strict";

  var D = window.KID_DATA;
  var S = window.KidSound;
  var V = window.KidVoice;
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  var STATE_KEY = "kid-speak:settings:v1";
  var settings = { sound: true, voice: true, rate: 0.9 };
  try {
    var saved = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    if (saved && typeof saved === "object") {
      settings.sound = saved.sound !== false;
      settings.voice = saved.voice !== false;
      settings.rate = Number(saved.rate) >= 0.6 && Number(saved.rate) <= 1.2 ? Number(saved.rate) : 0.9;
    }
  } catch (e) { /* 读取失败就用默认值 */ }

  function persist() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  /* ---------------- 背景星星 ---------------- */
  var starsBox = document.getElementById("stars");
  for (var i = 0; i < 34; i++) {
    var st = document.createElement("span");
    st.className = "star";
    st.style.left = (Math.random() * 100).toFixed(2) + "%";
    st.style.top = (Math.random() * 78).toFixed(2) + "%";
    st.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
    st.style.animationDuration = (2.2 + Math.random() * 2).toFixed(2) + "s";
    st.style.opacity = (0.25 + Math.random() * 0.5).toFixed(2);
    st.style.transform = "scale(" + (0.6 + Math.random() * 0.9).toFixed(2) + ")";
    starsBox.appendChild(st);
  }

  /* ---------------- 庆祝粒子 ---------------- */
  function party(count) {
    var box = document.getElementById("confetti");
    var colors = ["#ff8a65", "#ffc93c", "#4bc2a2", "#5ab5ea", "#c79bf0"];
    for (var i = 0; i < (count || 16); i++) {
      var p = document.createElement("span");
      p.className = "bit";
      p.style.left = (10 + Math.random() * 80) + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4).toFixed(2) + "s";
      p.style.animationDuration = (1.2 + Math.random() * 0.7).toFixed(2) + "s";
      p.style.width = (6 + Math.random() * 6).toFixed(0) + "px";
      p.style.height = (8 + Math.random() * 8).toFixed(0) + "px";
      box.appendChild(p);
      (function (node) { setTimeout(function () { node.remove(); }, 2200); })(p);
    }
  }

  /* ---------------- 设置条 ---------------- */
  var soundBtn = document.getElementById("soundBtn");
  var voiceBtn = document.getElementById("voiceBtn");
  var rateInput = document.getElementById("rate");

  function syncControls() {
    soundBtn.setAttribute("aria-pressed", settings.sound ? "true" : "false");
    soundBtn.classList.toggle("is-off", !settings.sound);
    soundBtn.querySelector("span").textContent = settings.sound ? "音效" : "音效关";
    voiceBtn.setAttribute("aria-pressed", settings.voice ? "true" : "false");
    voiceBtn.classList.toggle("is-off", !settings.voice);
    voiceBtn.querySelector("span").textContent = settings.voice ? "朗读" : "朗读关";
    rateInput.value = String(settings.rate);
  }

  soundBtn.addEventListener("click", function () {
    settings.sound = S.toggle();
    persist();
    syncControls();
  });

  voiceBtn.addEventListener("click", function () {
    settings.voice = V.toggle();
    persist();
    syncControls();
    if (!settings.voice) stopSequence();
  });

  rateInput.addEventListener("input", function () {
    settings.rate = Number(rateInput.value);
    V.setRate(settings.rate);
    persist();
  });

  V.setRate(settings.rate);
  syncControls();

  /* ---------------- 页面切换 ---------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var pages = Array.prototype.slice.call(document.querySelectorAll(".page"));

  function go(page) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-page") === page;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    pages.forEach(function (p) {
      p.classList.toggle("is-on", p.id === "page-" + page);
    });
    stopSequence();
    V.cancel();
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      S.play("page");
      go(t.getAttribute("data-page"));
    });
  });

  /* ---------------- 逐句朗读（儿歌/古诗共用） ---------------- */
  var seqTimer = null;
  var seqToken = 0;

  function stopSequence() {
    seqToken++;
    if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
  }

  function runLines(lines, nodes, done) {
    stopSequence();
    var token = ++seqToken;
    var idx = 0;

    function mark(i) {
      nodes.forEach(function (n, k) { n.classList.toggle("is-reading", k === i); });
    }

    function step() {
      if (token !== seqToken) return;
      if (idx >= lines.length) {
        nodes.forEach(function (n) { n.classList.remove("is-reading"); });
        if (done) done();
        return;
      }
      mark(idx);
      var line = lines[idx++];
      var fired = false;
      /* 只推进一次：朗读结束事件和兜底计时器谁先来就用谁，避免跳过句子 */
      var advance = function () {
        if (fired) return;
        fired = true;
        if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
        if (token !== seqToken) return;
        seqTimer = setTimeout(step, 340);
      };
      if (V.isOn()) {
        V.speak(line, advance);
        seqTimer = setTimeout(advance, V.estimate(line) + 2500);
      } else {
        seqTimer = setTimeout(step, 620);
      }
    }
    step();
  }

  /* ---------------- 儿歌 ---------------- */
  var songGrid = document.getElementById("songGrid");
  var songStage = document.getElementById("songStage");
  var songTitle = document.getElementById("songTitle");
  var songBody = document.getElementById("songBody");

  D.songs.forEach(function (s) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "card tone-" + s.color;
    card.innerHTML = '<span class="card-emoji">' + s.emoji + '</span><span class="card-word">' + s.title + "</span>";
    card.addEventListener("click", function () {
      S.play("tap");
      openSong(s);
    });
    songGrid.appendChild(card);
  });

  var currentSong = null;

  function openSong(song) {
    currentSong = song;
    songStage.hidden = false;
    songTitle.textContent = song.emoji + " " + song.title;
    songBody.innerHTML = "";
    var nodes = song.lines.map(function (line) {
      var el = document.createElement("p");
      el.className = "line";
      el.textContent = line;
      songBody.appendChild(el);
      return el;
    });
    var note = document.createElement("p");
    note.className = "kid-note";
    note.textContent = song.note;
    songBody.appendChild(note);
    songStage.scrollIntoView({ behavior: "smooth", block: "nearest" });
    runLines(song.lines, nodes, function () { S.play("good"); party(10); });
  }

  document.getElementById("songReplay").addEventListener("click", function () {
    if (currentSong) { S.play("tap"); openSong(currentSong); }
  });

  /* ---------------- 古诗 ---------------- */
  var poemGrid = document.getElementById("poemGrid");
  var poemStage = document.getElementById("poemStage");
  var poemTitle = document.getElementById("poemTitle");
  var poemMeta = document.getElementById("poemMeta");
  var poemBody = document.getElementById("poemBody");
  var poemNote = document.getElementById("poemNote");

  D.poems.forEach(function (p) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "card tone-" + p.color;
    card.innerHTML = '<span class="card-emoji">' + p.emoji + '</span><span class="card-word">' + p.title + "</span>";
    card.addEventListener("click", function () {
      S.play("tap");
      openPoem(p);
    });
    poemGrid.appendChild(card);
  });

  var currentPoem = null;

  function openPoem(poem) {
    currentPoem = poem;
    poemStage.hidden = false;
    poemTitle.textContent = poem.emoji + " " + poem.title;
    poemMeta.textContent = poem.author;
    poemNote.textContent = poem.explain;
    poemBody.innerHTML = "";
    var nodes = poem.lines.map(function (line) {
      var el = document.createElement("p");
      el.className = "line poem-line";
      el.textContent = line;
      poemBody.appendChild(el);
      return el;
    });
    poemStage.scrollIntoView({ behavior: "smooth", block: "nearest" });
    runLines(poem.lines, nodes, function () { S.play("good"); party(10); });
  }

  document.getElementById("poemReplay").addEventListener("click", function () {
    if (currentPoem) { S.play("tap"); openPoem(currentPoem); }
  });

  document.getElementById("poemExplain").addEventListener("click", function () {
    if (!currentPoem) return;
    S.play("pop");
    V.speak(currentPoem.explain);
    poemNote.classList.add("is-on");
    setTimeout(function () { poemNote.classList.remove("is-on"); }, 1200);
  });

  /* ---------------- 认知卡片 ---------------- */
  var catChips = document.getElementById("catChips");
  var cardGrid = document.getElementById("cardGrid");

  function renderCards(cat) {
    var group = D.cards.filter(function (g) { return g.cat === cat; })[0];
    cardGrid.innerHTML = "";
    if (!group) return;
    group.items.forEach(function (item) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "card big tone-sky";
      card.innerHTML = '<span class="card-emoji">' + item.emoji + '</span><span class="card-word">' + item.word + "</span>";
      card.addEventListener("click", function () {
        S.play("pop");
        card.classList.add("is-tapped");
        setTimeout(function () { card.classList.remove("is-tapped"); }, 320);
        V.speak(item.say);
        bubble("我", item.word, true);
      });
      cardGrid.appendChild(card);
    });
  }

  D.cards.forEach(function (group, i) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (i === 0 ? " is-on" : "");
    chip.textContent = group.cat;
    chip.addEventListener("click", function () {
      S.play("tap");
      Array.prototype.forEach.call(catChips.children, function (c) { c.classList.remove("is-on"); });
      chip.classList.add("is-on");
      renderCards(group.cat);
    });
    catChips.appendChild(chip);
  });
  renderCards(D.cards[0].cat);

  /* ---------------- 聊天气泡 ---------------- */
  var chat = document.getElementById("chat");

  function bubble(who, text, isKid) {
    var row = document.createElement("div");
    row.className = "bubble-row " + (isKid ? "kid" : "bot");
    row.innerHTML =
      '<span class="avatar">' + (isKid ? "🧒" : "⭐") + "</span>" +
      '<p class="bubble">' + escapeHtml(text) + "</p>";
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
    while (chat.children.length > 6) chat.removeChild(chat.firstChild);
    return row;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 问答匹配 ---------------- */
  function findReply(text) {
    var t = String(text || "").replace(/\s/g, "");
    if (!t) return null;
    var best = null;
    D.replies.forEach(function (r) {
      r.keys.forEach(function (k) {
        if (t.indexOf(k) !== -1 && (!best || k.length > best.len)) {
          best = { text: r.text, go: r.go || null, len: k.length };
        }
      });
    });
    return best;
  }

  function answer(userText) {
    bubble("kid", userText, true);
    var hit = findReply(userText);
    if (hit) {
      setTimeout(function () {
        bubble("bot", hit.text);
        V.speak(hit.text);
        S.play("good");
        party(8);
        if (hit.go) {
          setTimeout(function () { go(hit.go); }, 900);
        }
      }, 260);
    } else {
      var f = D.fallbacks[Math.floor(Math.random() * D.fallbacks.length)];
      setTimeout(function () {
        bubble("bot", f);
        V.speak(f);
        S.play("nope");
      }, 260);
    }
  }

  /* ---------------- 快捷问题 ---------------- */
  Array.prototype.forEach.call(document.querySelectorAll(".chip[data-say]"), function (chip) {
    chip.addEventListener("click", function () {
      S.play("tap");
      answer(chip.getAttribute("data-say"));
    });
  });

  /* ---------------- 语音识别 ---------------- */
  var micBtn = document.getElementById("micBtn");
  var micHint = document.getElementById("micHint");
  var rec = null;
  var listening = false;

  function setListening(on) {
    listening = on;
    micBtn.classList.toggle("is-live", on);
    micHint.textContent = on ? "我在听，你慢慢说……" : "按一下，然后对我说句话";
  }

  if (!SpeechRec) {
    micHint.textContent = "这个浏览器不能听声音，可以点下面的小按钮来问";
    micBtn.disabled = true;
    micBtn.classList.add("is-off");
  } else {
    rec = new SpeechRec();
    rec.lang = "zh-CN";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = function () {
      setListening(true);
      S.play("listen");
    };
    rec.onresult = function (e) {
      var text = e.results[0][0].transcript;
      setListening(false);
      answer(text);
    };
    rec.onerror = function (e) {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        micHint.textContent = "没有拿到麦克风权限，请在浏览器里允许使用麦克风";
      } else if (e.error === "no-speech") {
        micHint.textContent = "没听到声音，靠近一点再说一次";
      } else {
        micHint.textContent = "没听清，再按一次试试";
      }
      S.play("nope");
    };
    rec.onend = function () { setListening(false); };
  }

  function startRec() {
    if (!rec) return;
    S.play("tap");
    try {
      rec.start();
    } catch (e) {
      micHint.textContent = "刚才还在听，稍等一下再按";
    }
  }

  micBtn.addEventListener("click", function () {
    if (S.unlock) S.unlock();
    if (V.unlock) V.unlock();
    if (!rec) return;
    if (listening) { rec.stop(); return; }
    /* 先申请一次麦克风权限，让系统弹出授权框，也能提前暴露权限被拒的情况 */
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        startRec();
      }).catch(function () {
        micHint.textContent = "麦克风被禁止了，请在浏览器的权限设置里打开麦克风";
        S.play("nope");
      });
    } else {
      startRec();
    }
  });

  /* ---------------- 首次进入引导 ---------------- */
  /* 手机 / 平板：语音引擎必须在一次用户手势里被唤醒，否则只有音效没有人声 */
  document.addEventListener("pointerdown", function () {
    if (S.unlock) S.unlock();
    if (V.unlock) V.unlock();
  }, { once: true });

  /* 安卓 / 微信里读不出声时给一次明确提示，免得小朋友以为坏了 */
  var silentShown = false;
  if (V.onSilent) {
    V.onSilent(function () {
      if (silentShown) return;
      silentShown = true;
      bubble("bot", "这台设备没能读出声音。安卓手机请先安装「语音合成引擎」并下载中文语音包，再用 Chrome 或系统浏览器打开。");
    });
  }

  if (/MicroMessenger/i.test(navigator.userAgent) && /Android/i.test(navigator.userAgent)) {
    var tip = document.createElement("p");
    tip.className = "kid-note";
    tip.style.margin = "0 2px 12px";
    tip.textContent = "微信里可能读不出声音，点右上角「…」选择「在浏览器打开」试试。";
    var talkPage = document.getElementById("page-talk");
    if (talkPage) talkPage.insertBefore(tip, talkPage.firstChild);
  }

  if (!V.supported()) {
    bubble("bot", "这台设备的浏览器不能朗读语音，可以先看文字和卡片哦。");
  } else {
    bubble("bot", "你好，我是星星小屋。按一下大按钮，跟我说句话吧！");
    V.speak("你好，我是星星小屋。");
  }
})();
