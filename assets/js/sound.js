/* 星星小屋 · 声音层
   1) KidSound：Web Audio 合成音效，不依赖任何音频文件
   2) KidVoice：浏览器语音合成（朗读），逐句回调便于同步歌词高亮 */
(function () {
  var ctx = null;
  var enabled = true;

  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(o) {
    var c = unlock();
    if (!c || !enabled) return;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, c.currentTime + (o.delay || 0));
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, c.currentTime + (o.delay || 0) + o.dur);
    gain.gain.setValueAtTime(0.0001, c.currentTime + (o.delay || 0));
    gain.gain.exponentialRampToValueAtTime(o.vol || 0.16, c.currentTime + (o.delay || 0) + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (o.delay || 0) + o.dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + (o.delay || 0));
    osc.stop(c.currentTime + (o.delay || 0) + o.dur + 0.02);
  }

  var library = {
    tap: function () { tone({ freq: 520, to: 620, dur: 0.09, vol: 0.12 }); },
    pop: function () { tone({ freq: 720, to: 980, dur: 0.12, vol: 0.14 }); },
    page: function () {
      tone({ freq: 440, dur: 0.16, vol: 0.1 });
      tone({ freq: 660, dur: 0.18, vol: 0.1, delay: 0.1 });
    },
    good: function () {
      tone({ freq: 660, dur: 0.14, vol: 0.15 });
      tone({ freq: 880, dur: 0.16, vol: 0.15, delay: 0.13 });
      tone({ freq: 1040, dur: 0.2, vol: 0.12, delay: 0.26 });
    },
    sparkle: function () {
      [880, 1040, 1320, 1560].forEach(function (f, i) {
        tone({ freq: f, dur: 0.12, vol: 0.08, delay: i * 0.06 });
      });
    },
    nope: function () { tone({ freq: 320, to: 220, dur: 0.2, vol: 0.1, type: 'triangle' }); },
    listen: function () {
      tone({ freq: 600, dur: 0.1, vol: 0.1 });
      tone({ freq: 900, dur: 0.12, vol: 0.1, delay: 0.12 });
    }
  };

  window.KidSound = {
    play: function (name) {
      var fn = library[name];
      if (fn) fn();
    },
    unlock: unlock,
    isOn: function () { return enabled; },
    toggle: function () {
      enabled = !enabled;
      if (enabled) { unlock(); library.pop(); }
      return enabled;
    }
  };

  /* ---------- 语音朗读 ---------- */
  var synth = window.speechSynthesis || null;
  var voiceOn = true;
  var rate = 0.9;
  var zhVoice = null;
  var warmed = false;

  function pickVoice() {
    if (!synth) return;
    var list = synth.getVoices() || [];
    for (var i = 0; i < list.length; i++) {
      if (/zh|Chinese|中文|普通话/i.test(list[i].lang + ' ' + list[i].name)) { zhVoice = list[i]; return; }
    }
    zhVoice = null;
  }

  /* 手机 / 平板上的语音引擎必须由一次用户手势唤醒，否则只出音效不出人声 */
  function unlockVoice() {
    if (!synth) return;
    try { synth.resume(); } catch (e) {}
    if (warmed) return;
    warmed = true;
    try {
      var u = new SpeechSynthesisUtterance('。');
      u.lang = 'zh-CN';
      u.volume = 0;
      synth.speak(u);
    } catch (e) {}
    pickVoice();
  }

  if (synth) {
    pickVoice();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = pickVoice;
    setTimeout(pickVoice, 300);
    setTimeout(pickVoice, 1200);
  }

  window.KidVoice = {
    supported: function () { return !!synth; },
    hasZhVoice: function () { return !!zhVoice; },
    isOn: function () { return voiceOn; },
    toggle: function () {
      voiceOn = !voiceOn;
      if (!voiceOn) this.cancel();
      return voiceOn;
    },
    setRate: function (v) { rate = v; },
    getRate: function () { return rate; },
    cancel: function () { if (synth) { try { synth.cancel(); } catch (e) {} } },
    unlock: unlockVoice,
    /* 朗读一段，结束回调 onEnd；返回是否真的读了 */
    speak: function (text, onEnd) {
      var body = String(text || '').replace(/\n/g, '，').trim();
      if (!voiceOn || !synth || !body) {
        if (onEnd) setTimeout(onEnd, 0);
        return false;
      }
      unlockVoice();
      if (!zhVoice) pickVoice();

      var once = false;
      var fire = function () {
        if (once) return;
        once = true;
        if (onEnd) onEnd();
      };

      var go = function () {
        try {
          var u = new SpeechSynthesisUtterance(body);
          u.lang = 'zh-CN';
          u.rate = rate;
          u.pitch = 1.08;
          u.volume = 1;
          if (zhVoice) u.voice = zhVoice;
          u.onend = fire;
          u.onerror = fire;
          synth.speak(u);
        } catch (e) {
          fire();
          return;
        }
        /* 移动端：引擎卡在暂停态时推一把；彻底没出声就不要一直卡着 */
        setTimeout(function () {
          try { if (synth.paused) synth.resume(); } catch (e) {}
          if (!synth.speaking && !synth.pending) fire();
        }, 900);
      };

      var busy = false;
      try { busy = !!(synth.speaking || synth.pending); } catch (e) {}
      if (busy) {
        try { synth.cancel(); } catch (e) {}
        setTimeout(go, 60);
      } else {
        go();
      }
      return true;
    },
    /* 按估算时长延时回调，用于逐行高亮（朗读失败时也不卡住） */
    estimate: function (text) {
      var base = String(text).length * 210 / Math.max(0.6, rate);
      return Math.max(1400, Math.min(base, 7000));
    }
  };
})();
