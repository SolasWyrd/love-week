/* Общие утилиты: DOM, звук, фон, частицы, салют, печатная машинка */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    el.append(...kids.flat().filter(k => k != null && k !== false));
    return el;
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  const HEART = 'M12 21.2s-7.6-4.7-9.7-9.4C.8 8.3 3 4.4 6.8 4.4c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 6 3.9 4.5 7.4-2.1 4.7-9.7 9.4-9.7 9.4z';
  const heartSvg = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART}"/></svg>`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('lw:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('lw:' + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- Звук: синтез через WebAudio, без файлов ---------- */
  const sfx = (() => {
    let ctx = null, master = null, on = store.get('sound', true);
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(f, { dur = 0.25, type = 'sine', vol = 0.07, delay = 0, slide = 0 } = {}) {
      if (!on) return;
      const c = ensure(); if (!c) return;
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    const P = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568, 1760, 2093, 2349.3, 2637];
    return {
      pop() { tone(rand(520, 760), { dur: 0.12, type: 'triangle', vol: 0.06, slide: 1.8 }); },
      tick() { tone(1250, { dur: 0.05, vol: 0.025 }); },
      note(i) { const f = P[i % P.length]; tone(f, { dur: 0.7, vol: 0.06 }); tone(f * 2, { dur: 0.4, vol: 0.012 }); },
      chime() { [0, 2, 4].forEach((n, i) => tone(P[n + 2], { dur: 0.8, vol: 0.045, delay: i * 0.07 })); },
      win() { [0, 2, 4, 5, 7].forEach((n, i) => tone(P[n], { dur: 1, vol: 0.05, type: 'triangle', delay: i * 0.09 })); },
      bad() { tone(240, { dur: 0.25, vol: 0.06, slide: 0.6 }); },
      boom() { tone(rand(90, 140), { dur: 0.5, vol: 0.08, slide: 0.4 }); tone(rand(1800, 2600), { dur: 0.3, vol: 0.012, type: 'triangle', delay: 0.05, slide: 0.5 }); },
      get on() { return on; },
      toggle() { on = !on; store.set('sound', on); if (on) ensure(); return on; },
      unlock() { if (on) ensure(); },
    };
  })();

  /* ---------- Фон: дрейфующие световые пятна и сердечки ---------- */
  const bg = (() => {
    const cv = $('#bg'), ctx = cv.getContext('2d'), heart = new Path2D(HEART);
    let w, hh, boost = 0;
    const ORB = ['255,93,122', '242,196,141', '150,60,120', '255,152,168'];
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; hh = innerHeight;
      cv.width = w * dpr; cv.height = hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); addEventListener('resize', resize);
    const orbs = Array.from({ length: 5 }, (_, i) => ({ x: rand(0, 1), y: rand(0, 1), r: rand(0.25, 0.45), c: ORB[i % 4], p: rand(0, 6.28), s: rand(0.0001, 0.00025) }));
    const mk = initial => ({ x: rand(0, w), y: initial ? rand(0, hh) : hh + 30, s: rand(6, 16), v: rand(0.15, 0.5), sw: rand(10, 30), p: rand(0, 6.28), a: rand(0.07, 0.25), r: rand(-0.4, 0.4) });
    const hearts = Array.from({ length: reduce ? 10 : w < 600 ? 16 : 26 }, () => mk(true));
    let t0 = performance.now();
    function frame(now) {
      const dt = Math.min(50, now - t0); t0 = now;
      ctx.clearRect(0, 0, w, hh);
      ctx.globalCompositeOperation = 'lighter';
      for (const o of orbs) {
        o.p += o.s * dt;
        const x = (o.x + Math.sin(o.p) * 0.1) * w, y = (o.y + Math.cos(o.p * 1.3) * 0.1) * hh, r = o.r * Math.max(w, hh);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${o.c},${0.09 + boost * 0.02})`); g.addColorStop(1, `rgba(${o.c},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
      }
      ctx.globalCompositeOperation = 'source-over';
      const sp = 1 + boost * 5; boost *= 0.985;
      for (const p of hearts) {
        p.y -= p.v * sp * dt * 0.06; p.p += 0.0015 * dt;
        if (p.y < -30) Object.assign(p, mk(false));
        ctx.save();
        ctx.translate(p.x + Math.sin(p.p) * p.sw, p.y); ctx.rotate(p.r + Math.sin(p.p) * 0.2);
        ctx.scale(p.s / 24, p.s / 24); ctx.translate(-12, -12.8);
        ctx.fillStyle = `rgba(255,140,165,${p.a})`; ctx.fill(heart);
        ctx.restore();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { boost(v = 1) { boost = Math.min(2.5, boost + v); } };
  })();

  /* ---------- Взрыв частиц ---------- */
  const fx = $('#fx');
  const COLORS = ['#ff5d7a', '#ff98a8', '#ffc7cf', '#f2c48d', '#ffffff'];
  function burst(x, y, { count = 18, spread = 140, colors = COLORS, glyphs = ['♥', '♥', '✦'], size = [10, 24] } = {}) {
    if (reduce) count = Math.min(count, 6);
    for (let i = 0; i < count; i++) {
      const el = h('span', { class: 'particle' }, pick(glyphs));
      el.style.cssText = `left:${x}px;top:${y}px;color:${pick(colors)};font-size:${rand(size[0], size[1])}px`;
      fx.append(el);
      const a = rand(0, Math.PI * 2), d = rand(spread * 0.35, spread), dx = Math.cos(a) * d, dy = Math.sin(a) * d - rand(10, 50), rot = rand(-90, 90);
      el.animate([
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 60}px)) scale(.5) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: rand(800, 1300), easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => el.remove();
    }
  }

  /* ---------- Искры за курсором ---------- */
  if (finePointer && !reduce) {
    let last = 0;
    addEventListener('pointermove', e => {
      const n = performance.now(); if (n - last < 50) return; last = n;
      const s = h('span', { class: 'spark' }, '✦');
      s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
      fx.append(s);
      s.animate([
        { opacity: 0.8, transform: 'translate(-50%,-50%) scale(1)' },
        { opacity: 0, transform: `translate(calc(-50% + ${rand(-14, 14)}px), calc(-50% + ${rand(10, 28)}px)) scale(.2) rotate(120deg)` },
      ], { duration: 800, easing: 'ease-out' }).onfinish = () => s.remove();
    }, { passive: true });
  }

  /* ---------- Салют (с сердечными взрывами) ---------- */
  function fireworks(ms = 6000) {
    const cv = h('canvas', { class: 'fireworks' }); document.body.append(cv);
    const ctx = cv.getContext('2d'); let w, hh;
    const resize = () => { const d = Math.min(devicePixelRatio || 1, 2); w = innerWidth; hh = innerHeight; cv.width = w * d; cv.height = hh * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    resize(); addEventListener('resize', resize);
    const C = ['#ff5d7a', '#ffc7cf', '#f2c48d', '#ffffff', '#ff98a8', '#ffd9a0', '#d7b8ff'];
    const rockets = [], parts = [], G = 0.06, end = performance.now() + ms;
    let nextLaunch = 0, last = performance.now();
    function launch() {
      const th = rand(0.45, 0.75) * hh;
      rockets.push({ x: rand(0.15, 0.85) * w, y: hh, vx: rand(-0.6, 0.6), vy: -Math.sqrt(2 * 0.15 * th), c: pick(C), heart: Math.random() < 0.45 });
    }
    function explode(r) {
      sfx.boom();
      const k = Math.min(w, hh) / 900 + 0.35;
      if (r.heart) {
        for (let i = 0; i < 70; i++) {
          const t = (i / 70) * Math.PI * 2;
          const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          parts.push({ x: r.x, y: r.y, vx: x * 0.2 * k, vy: y * 0.2 * k, life: 1, d: rand(0.008, 0.012), c: r.c, s: 2.2 });
        }
      } else {
        const c2 = pick(C);
        for (let i = 0; i < 80; i++) {
          const a = rand(0, Math.PI * 2), s = rand(1, 4.5) * k * 1.4;
          parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, d: rand(0.01, 0.018), c: i % 3 ? r.c : c2, s: 1.8 });
        }
      }
    }
    return new Promise(res => {
      function frame(now) {
        const dt = Math.min(2, (now - last) / 16.67); last = now;
        if (now < end && now > nextLaunch) { launch(); if (Math.random() < 0.3) launch(); nextLaunch = now + rand(280, 600); }
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, 0, w, hh);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i]; r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 0.15 * dt;
          ctx.fillStyle = '#ffe9d6'; ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, 7); ctx.fill();
          if (r.vy >= -0.4) { rockets.splice(i, 1); explode(r); }
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += G * 0.5 * dt; p.vx *= 0.985; p.vy *= 0.985; p.life -= p.d * dt;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (now < end || rockets.length || parts.length) requestAnimationFrame(frame);
        else { removeEventListener('resize', resize); cv.remove(); res(); }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------- Печатная машинка (тап — допечатать сразу) ---------- */
  function typewrite(el, text, speed = 30) {
    return new Promise(res => {
      el.textContent = '';
      const txt = document.createTextNode(''), caret = h('span', { class: 'caret' });
      el.append(txt, caret);
      let i = 0, skip = reduce;
      const onSkip = () => { skip = true; };
      el.closest('.letter')?.addEventListener('pointerdown', onSkip, { once: true });
      (function step() {
        if (skip) { txt.data = text; return finish(); }
        txt.data = text.slice(0, ++i);
        const ch = text[i - 1];
        const d = /[.!?…]/.test(ch) ? speed * 10 : /[,—]/.test(ch) ? speed * 5 : ch === '\n' ? speed * 4 : speed + rand(-10, 14);
        if (i < text.length) setTimeout(step, d); else finish();
      })();
      function finish() { setTimeout(() => caret.remove(), 1500); res(); }
    });
  }

  /* ---------- Тост, наклон, тряска ---------- */
  let toastT;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = h('div', { class: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
  }
  function tilt(el, max = 10) {
    if (!finePointer || reduce) return;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', (x - 0.5) * max + 'deg'); el.style.setProperty('--rx', (0.5 - y) * max + 'deg');
      el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  }
  function shake(el) {
    el.animate([{ translate: '0' }, { translate: '-9px' }, { translate: '8px' }, { translate: '-5px' }, { translate: '3px' }, { translate: '0' }], { duration: 450, easing: 'ease-out' });
  }

  window.Love = { reduce, finePointer, $, $$, h, wait, rand, pick, clamp, shuffle, center, HEART, heartSvg, store, sfx, bg, burst, fireworks, typewrite, toast, tilt, shake };
})();
