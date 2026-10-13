/* Семь мини-игр. Каждая получает (stage, api) и возвращает функцию очистки. */
(() => {
  'use strict';
  const L = window.Love, C = window.LOVE;
  const { h, rand, pick, clamp, shuffle, center, sfx, burst, shake, wait, HEART, heartSvg, store } = L;

  function startOverlay(parent, text, label, onStart) {
    const ov = h('div', { class: 'overlay' }, h('p', {}, text), h('button', { class: 'btn', type: 'button' }, label));
    ov.querySelector('button').onclick = () => { sfx.unlock(); ov.classList.add('hide'); setTimeout(() => ov.remove(), 450); onStart(); };
    parent.append(ov);
  }

  /* ===== День 1 — поймай сердечки ===== */
  function catchHearts(stage, api) {
    const GOAL = C.catchGoal || 15;
    const box = h('div', { class: 'game catch' }), cv = h('canvas');
    const scoreEl = h('b', {}, '0'), bar = h('i');
    box.append(cv, h('div', { class: 'hud' }, h('span', {}, 'Поймано ', scoreEl, ` / ${GOAL}`), h('span', { class: 'meter' }, bar)));
    stage.append(box);
    const ctx = cv.getContext('2d'), heart = new Path2D(HEART);
    let W = 0, H = 0;
    const size = () => {
      const r = box.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(box);

    let px = W / 2, tx = W / 2, items = [], floats = [], score = 0, running = false, won = false;
    let raf = 0, last = performance.now(), spawnT = 0, elapsed = 0, shakeT = 0;
    const move = e => { const r = cv.getBoundingClientRect(); tx = clamp(e.clientX - r.left, 44, W - 44); };
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerdown', move);
    const onKey = e => {
      if (e.key === 'ArrowLeft') tx = clamp(tx - 70, 44, W - 44);
      if (e.key === 'ArrowRight') tx = clamp(tx + 70, 44, W - 44);
    };
    addEventListener('keydown', onKey);

    function spawn() {
      const bad = elapsed > 2500 && Math.random() < 0.22;
      items.push({ x: rand(30, W - 30), y: -30, v: rand(1.7, 2.6) + elapsed / 22000, s: bad ? 46 : rand(24, 36), bad, r: rand(-0.5, 0.5), vr: rand(-0.02, 0.02), sw: rand(0, 6.28) });
    }
    function drawHeart(x, y, s, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12.8);
      ctx.shadowColor = 'rgba(255,93,122,.8)'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff6b86'; ctx.fill(heart);
      ctx.restore();
    }
    function drawCloud(x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(150,138,165,.95)';
      for (const [cx, cy, r] of [[-0.26, 0.04, 0.26], [0.04, -0.1, 0.33], [0.32, 0.05, 0.22], [0, 0.1, 0.24]]) { ctx.beginPath(); ctx.arc(cx * s, cy * s, r * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#3a2d40';
      ctx.beginPath(); ctx.arc(-0.1 * s, 0.02 * s, 2.2, 0, 7); ctx.arc(0.14 * s, 0.02 * s, 2.2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3a2d40'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0.02 * s, 0.16 * s, 4, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
      ctx.restore();
    }
    function drawBowl(y) {
      ctx.save(); ctx.translate(px, y);
      ctx.shadowColor = 'rgba(255,93,122,.75)'; ctx.shadowBlur = 26;
      ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-42, 32, 0, 32); ctx.quadraticCurveTo(42, 32, 46, 0); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, '#ffc7cf'); g.addColorStop(1, '#e03a5e');
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 46, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    function catchIt(it, x) {
      if (won) return;
      const r = cv.getBoundingClientRect();
      if (it.bad) { score = Math.max(0, score - 2); shakeT = 14; sfx.bad(); floats.push({ x, y: H - 90, t: 1, txt: '−2', c: '#c9bfd6' }); }
      else { score++; sfx.pop(); burst(r.left + x, r.top + H - 56, { count: 7, spread: 70, size: [8, 16] }); floats.push({ x, y: H - 90, t: 1, txt: '+1', c: '#ffd0d8' }); }
      scoreEl.textContent = score; bar.style.width = Math.min(100, (score / GOAL) * 100) + '%';
      if (score >= GOAL) { won = true; running = false; api.done(); }
    }
    function frame(now) {
      const dt = Math.min(32, now - last) / 16.67; last = now;
      if (running) {
        elapsed += dt * 16.67; spawnT -= dt * 16.67;
        if (spawnT <= 0) { spawn(); spawnT = Math.max(360, 800 - elapsed / 50); }
      }
      px += (tx - px) * Math.min(1, 0.28 * dt);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (shakeT > 0) { shakeT -= dt; ctx.translate(Math.sin(shakeT * 2.4) * 6, 0); }
      const by = H - 52;
      for (let k = items.length - 1; k >= 0; k--) {
        const it = items[k];
        it.y += it.v * dt; it.r += it.vr * dt; it.sw += 0.03 * dt;
        const x = it.x + Math.sin(it.sw) * 8;
        if (it.y > by - 8 && it.y < by + 18 && Math.abs(x - px) < 50) { items.splice(k, 1); catchIt(it, x); continue; }
        if (it.y > H + 40) { items.splice(k, 1); continue; }
        it.bad ? drawCloud(x, it.y, it.s) : drawHeart(x, it.y, it.s, it.r);
      }
      drawBowl(by);
      ctx.font = '700 18px Manrope, sans-serif'; ctx.textAlign = 'center';
      for (let k = floats.length - 1; k >= 0; k--) {
        const f = floats[k]; f.t -= 0.022 * dt; f.y -= 0.8 * dt;
        if (f.t <= 0) { floats.splice(k, 1); continue; }
        ctx.globalAlpha = f.t; ctx.fillStyle = f.c; ctx.fillText(f.txt, f.x, f.y);
      }
      ctx.globalAlpha = 1; ctx.restore();
      raf = requestAnimationFrame(frame);
    }
    startOverlay(box, 'Води пальцем или мышкой. Сердечки — ловить, хмурые тучки — обходить.', 'Начать', () => { running = true; });
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown', onKey); };
  }

  /* ===== День 2 — скретч-карты ===== */
  function scratch(stage, api) {
    const list = C.reasons;
    let revealed = 0;
    const grid = h('div', { class: 'scratch-grid' });
    stage.append(grid);
    list.forEach((text, k) => {
      const cv = h('canvas', { 'aria-label': 'Сотри пальцем, чтобы открыть' });
      const card = h('div', { class: 'scratch-card', style: `--i:${k}` }, h('span', { class: 'scratch-num' }, `причина №${k + 1}`), h('p', {}, text), cv);
      grid.append(card);
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      let down = false, lastPt = null, done = false, moves = 0;
      requestAnimationFrame(() => {
        const r = card.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2), w = r.width, hh = r.height;
        cv.width = w * d; cv.height = hh * d; ctx.setTransform(d, 0, 0, d, 0, 0);
        const g = ctx.createLinearGradient(0, 0, w, hh);
        [['0', '#b98549'], ['.3', '#f6dcae'], ['.5', '#d4a265'], ['.75', '#f7dcaa'], ['1', '#b07a40']].forEach(([o, c]) => g.addColorStop(+o, c));
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
        for (let n = 0; n < 260; n++) { ctx.fillStyle = `rgba(255,255,255,${rand(0, 0.4)})`; ctx.fillRect(rand(0, w), rand(0, hh), 1.3, 1.3); }
        ctx.save(); ctx.translate(w / 2, hh / 2 - 14); ctx.scale(1.4, 1.4); ctx.translate(-12, -12.8);
        ctx.fillStyle = 'rgba(120,60,25,.35)'; ctx.fill(new Path2D(HEART)); ctx.restore();
        ctx.fillStyle = 'rgba(100,50,20,.6)'; ctx.font = '700 12px Manrope, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('С О Т Р И   М Е Н Я', w / 2, hh / 2 + 30);
      });
      const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      function scr(a, b) {
        ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineWidth = 26;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      cv.addEventListener('pointerdown', e => { if (done) return; down = true; cv.setPointerCapture(e.pointerId); lastPt = pos(e); scr(lastPt, { x: lastPt.x + 0.1, y: lastPt.y }); });
      cv.addEventListener('pointermove', e => { if (!down || done) return; const p = pos(e); scr(lastPt, p); lastPt = p; if (++moves % 10 === 0) check(); });
      const up = () => { if (down) { down = false; check(); } };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      function check() {
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let clear = 0, total = 0;
        for (let i = 3; i < data.length; i += 4 * 11) { total++; if (data[i] < 40) clear++; }
        const f = Math.min(1, clear / total / 0.9); card.style.setProperty('--clear', f.toFixed(3));
        if (f >= 1) reveal();
      }
      function reveal() {
        if (done) return; done = true;
        cv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, fill: 'forwards', easing: 'ease-out' }).onfinish = () => cv.remove();
        card.classList.add('revealed'); sfx.chime();
        const c = center(card); burst(c.x, c.y, { count: 16, spread: 130 });
        if (++revealed === list.length) setTimeout(api.done, 900);
      }
    });
  }

  /* ===== День 3 — мемори ===== */
  function memory(stage, api) {
    const faces = C.memory.slice(0, 8), deck = shuffle([...faces, ...faces]);
    const isImg = f => /\.(png|jpe?g|webp|gif|avif)$/i.test(f) || f.startsWith('data:');
    let open = [], lock = false, found = 0, moves = 0;
    const movesEl = h('b', {}, '0'), foundEl = h('b', {}, '0');
    const grid = h('div', { class: 'memory' });
    deck.forEach((f, k) => {
      const b = h('button', { class: 'mcard', type: 'button', style: `--i:${k}`, 'aria-label': `Карточка ${k + 1}` },
        h('span', { class: 'inner' },
          h('span', { class: 'face front', html: heartSvg() }),
          h('span', { class: 'face back' }, isImg(f) ? h('img', { src: f, alt: '', draggable: 'false' }) : f)));
      b.dataset.f = f; b.onclick = () => flip(b); grid.append(b);
    });
    stage.append(h('div', { class: 'hud hud-plain' }, h('span', {}, 'Ходов: ', movesEl), h('span', {}, 'Пар: ', foundEl, ` / ${faces.length}`)), grid);
    async function flip(b) {
      if (lock || b.classList.contains('open')) return;
      b.classList.add('open'); sfx.tick(); open.push(b);
      if (open.length < 2) return;
      movesEl.textContent = ++moves; lock = true;
      const [a, c] = open; open = [];
      if (a.dataset.f === c.dataset.f) {
        await wait(380);
        a.classList.add('matched'); c.classList.add('matched'); sfx.note(found * 2);
        foundEl.textContent = ++found;
        const p = center(c); burst(p.x, p.y, { count: 10, spread: 90 });
        lock = false;
        if (found === faces.length) setTimeout(api.done, 700);
      } else {
        await wait(900);
        a.classList.remove('open'); c.classList.remove('open'); lock = false;
      }
    }
  }

  /* ===== День 4 — созвездие ===== */
  function constellation(stage, api) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
    const hp = t => ({ x: 200 + 16 * Math.sin(t) ** 3 * 10.5, y: 182 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 10.5 });
    const N = 12, pts = Array.from({ length: N }, (_, k) => hp((k / N) * Math.PI * 2));
    const sky = h('div', { class: 'sky' }), svg = s('svg', { viewBox: '0 0 400 400', class: 'sky-svg' });
    svg.innerHTML = `<defs>
      <radialGradient id="starGlow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#f2c48d" stop-opacity=".35"/><stop offset="1" stop-color="#f2c48d" stop-opacity="0"/></radialGradient>
      <radialGradient id="hfill" cx=".5" cy=".4"><stop offset="0" stop-color="#ff5d7a" stop-opacity=".55"/><stop offset="1" stop-color="#ff5d7a" stop-opacity=".05"/></radialGradient></defs>`;
    const bgG = s('g');
    for (let i = 0; i < 80; i++) bgG.append(s('circle', { class: 'bgstar', cx: rand(0, 400), cy: rand(0, 400), r: rand(0.4, 1.5), style: `animation-delay:${rand(0, 3).toFixed(2)}s;animation-duration:${rand(1.8, 4).toFixed(2)}s` }));
    const fill = s('path', { class: 'heart-fill', d: 'M' + Array.from({ length: 120 }, (_, i) => { const p = hp((i / 120) * Math.PI * 2); return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(' L') + 'Z' });
    const linesG = s('g', { class: 'links' }), starsG = s('g');
    svg.append(bgG, fill, linesG, starsG);
    const caption = h('p', { class: 'sky-caption' }, C.constellationCaption);
    sky.append(svg); stage.append(sky, caption);

    let next = 0;
    const stars = pts.map((p, k) => {
      const g = s('g', { class: 'star', tabindex: '0', role: 'button', 'aria-label': `Звезда ${k + 1}`, transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` });
      g.append(s('circle', { class: 'hit', r: 22 }), s('circle', { class: 'pulse', r: 9 }), s('circle', { class: 'halo', r: 14 }), s('circle', { class: 'core', r: 3.2 }));
      const lbl = s('text', { class: 'lbl', y: -13, 'text-anchor': 'middle' }); lbl.textContent = k + 1; g.append(lbl);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(k, g); } });
      starsG.append(g); return g;
    });
    stars[0].classList.add('next');
    function line(a, b) {
      const l = s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }), len = Math.hypot(b.x - a.x, b.y - a.y);
      l.style.strokeDasharray = len; l.style.strokeDashoffset = len; linesG.append(l);
      l.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 550, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
    }
    const rope = s('line', { class: 'rope' }); rope.style.display = 'none'; svg.append(rope);
    const toSvg = e => { const m = svg.getScreenCTM().inverse(), q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return { x: q.x, y: q.y }; };
    const wrong = g => { if (!g.classList.contains('lit')) { g.querySelector('.core').animate([{ fill: '#ff5d7a', r: 5 }, { fill: '#fff', r: 3.2 }], { duration: 500 }); sfx.bad(); } };
    function connect(k) {
      const g = stars[k]; g.classList.remove('next'); g.classList.add('lit'); sfx.note(k);
      if (k > 0) line(pts[k - 1], pts[k]);
      if (++next < N) stars[next].classList.add('next'); else complete();
    }
    function hit(k, g) { if (next >= N) return; if (k !== next) return wrong(g); connect(k); }
    let dragging = false, moved = false, pid = null;
    svg.style.touchAction = 'none';
    svg.addEventListener('pointerdown', e => {
      if (next >= N || next === 0) return;
      const p = toSvg(e), a = pts[next - 1];
      if (Math.hypot(p.x - a.x, p.y - a.y) > 30) return;
      dragging = true; moved = false; pid = e.pointerId; svg.setPointerCapture(pid);
      rope.setAttribute('x1', a.x); rope.setAttribute('y1', a.y); rope.setAttribute('x2', p.x); rope.setAttribute('y2', p.y); rope.style.display = '';
    });
    svg.addEventListener('pointermove', e => {
      if (!dragging) return;
      const p = toSvg(e); moved = true;
      const a = pts[next - 1], t = pts[next], d = Math.hypot(p.x - t.x, p.y - t.y);
      rope.setAttribute('x1', a.x); rope.setAttribute('y1', a.y); rope.setAttribute('x2', p.x); rope.setAttribute('y2', p.y);
      if (d < 20) { connect(next); if (next >= N) stopDrag(); }
    });
    const stopDrag = () => { dragging = false; rope.style.display = 'none'; };
    svg.addEventListener('pointerup', stopDrag); svg.addEventListener('pointercancel', stopDrag);
    stars.forEach((g, k) => {
      g.addEventListener('click', () => { if (moved) { moved = false; return; } hit(k, g); });
    });
    async function complete() {
      await wait(400); line(pts[N - 1], pts[0]); sfx.note(N);
      await wait(600);
      sky.classList.add('complete'); caption.classList.add('show');
      for (let i = 0; i < 3; i++) setTimeout(() => { const sh = h('span', { class: 'shoot', style: `top:${rand(2, 40)}%;left:${rand(60, 110)}%` }); sky.append(sh); setTimeout(() => sh.remove(), 1600); }, i * 500);
      await wait(1900); api.done();
    }
  }

  /* ===== День 5 — шарики со словами ===== */
  function balloons(stage, api) {
    const words = C.balloonMessage.trim().split(/\s+/);
    const slots = h('div', { class: 'slots' }, words.map(w => h('span', { class: 'slot' }, w)));
    const field = h('div', { class: 'balloon-field' });
    stage.append(slots, field);
    const COLORS = [['#ff9fb1', '#e0365a'], ['#ffd9a8', '#e39a4a'], ['#ffc9d6', '#ff6f91'], ['#dcc2ff', '#9b6ad6'], ['#ffaaa0', '#c92f4d']];
    let W = field.clientWidth || 600, H = field.clientHeight || 480;
    const ro = new ResizeObserver(() => { W = field.clientWidth; H = field.clientHeight; }); ro.observe(field);
    const reset = (b, initial) => { b.x = rand(6, Math.max(12, W - 92)); b.y = initial ? rand(H * 0.2, H * 0.95) : H + rand(10, 140); b.v = rand(0.55, 1.05); };
    let left = words.length;
    const items = words.map((w, k) => {
      const [c1, c2] = COLORS[k % COLORS.length];
      const el = h('button', { class: 'balloon', type: 'button', 'aria-label': `Шарик со словом «${w}»`, style: `--c1:${c1};--c2:${c2}` },
        h('span', { class: 'b' }, h('span', { class: 'w' }, w)),
        h('span', { class: 'str', html: '<svg viewBox="0 0 10 60" preserveAspectRatio="none"><path d="M5 0 C0 15,10 25,5 40 S0 55,5 60"/></svg>' }));
      field.append(el);
      const b = { el, k, w, c1, ph: rand(0, 6.28), amp: rand(10, 24), popped: false };
      reset(b, true);
      el.addEventListener('pointerdown', e => { e.preventDefault(); pop(b); });
      el.addEventListener('click', e => { if (e.detail === 0) pop(b); });
      return b;
    });
    let raf = 0, last = performance.now();
    function frame(now) {
      const dt = Math.min(32, now - last) / 16.67; last = now;
      for (const b of items) {
        if (b.popped) continue;
        b.y -= b.v * dt; b.ph += 0.02 * dt;
        if (b.y < -150) reset(b, false);
        b.el.style.transform = `translate(${(b.x + Math.sin(b.ph) * b.amp).toFixed(1)}px,${b.y.toFixed(1)}px) rotate(${(Math.sin(b.ph) * 6).toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(frame);
    }
    async function pop(b) {
      if (b.popped) return; b.popped = true; sfx.pop();
      const r = b.el.querySelector('.b').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      burst(cx, cy, { count: 12, spread: 90, colors: [b.c1, '#fff', '#ffc7cf'], glyphs: ['●', '✦', '♥'], size: [6, 14] });
      b.el.querySelector('.b').animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], { duration: 170, easing: 'ease-out', fill: 'forwards' });
      b.el.querySelector('.str').animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(50px)' }], { duration: 500, fill: 'forwards' });
      const slot = slots.children[b.k], sr = slot.getBoundingClientRect();
      const fly = h('span', { class: 'fly-word' }, b.w);
      fly.style.left = cx + 'px'; fly.style.top = cy + 'px'; document.body.append(fly);
      const dx = sr.left + sr.width / 2 - cx, dy = sr.top + sr.height / 2 - cy;
      await fly.animate([
        { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1 },
      ], { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)' }).finished;
      fly.remove(); b.el.remove();
      slot.classList.add('filled');
      slot.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      if (--left === 0) { slots.classList.add('complete'); await wait(700); api.done(); }
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }

  /* ===== День 6 — фонарики желаний ===== */
  function lanterns(stage, api) {
    const N = C.lanternCount || 3, hints = C.lanternHints || [];
    let sent = 0;
    const sky = h('div', { class: 'lsky' });
    for (let i = 0; i < 50; i++) sky.append(h('i', { class: 'lstar', style: `left:${rand(0, 100)}%;top:${rand(0, 80)}%;--d:${rand(0, 3).toFixed(2)}s;--s:${rand(1, 2.4).toFixed(1)}px` }));
    const counter = h('p', { class: 'lcount' });
    const input = h('input', { class: 'wish', type: 'text', maxlength: 60, autocomplete: 'off', enterkeyhint: 'send' });
    const btn = h('button', { class: 'btn', type: 'button' }, 'Отпустить ✨');
    const form = h('div', { class: 'wish-form' }, input, btn);
    stage.append(sky, counter, form);
    const upd = () => { counter.textContent = `Желание ${Math.min(sent + 1, N)} из ${N}`; input.placeholder = hints[sent] || 'Загадай желание…'; };
    upd();
    function launch() {
      const text = input.value.trim();
      if (!text || sent >= N) { if (!text) { shake(input); sfx.bad(); input.focus(); } return; }
      sent++; input.value = ''; sfx.pop();
      const w = sky.clientWidth, hh = sky.clientHeight;
      const x = (sent / (N + 1)) * (w - 60) + rand(-14, 14);
      const el = h('div', { class: 'lantern' }, h('span', { class: 'lbody' }, h('span', { class: 'lflame' })), h('span', { class: 'ltext' }, text));
      el.style.left = x + 'px'; sky.append(el);
      const sway = rand(14, 30) * (sent % 2 ? 1 : -1);
      el.animate([
        { transform: 'translate(0,0) scale(.6)', opacity: 0 },
        { transform: `translate(${sway * .3}px,-12%) scale(1)`, opacity: 1, offset: .08 },
        { transform: `translate(${-sway}px,-${hh * .5}px) scale(.9)`, opacity: 1, offset: .5 },
        { transform: `translate(${sway}px,-${hh * 1.1}px) scale(.55)`, opacity: 0 }
      ], { duration: 11000, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => el.remove();
      const c = center(el); burst(c.x, c.y, { count: 10, spread: 80 });
      if (sent < N) { upd(); input.focus(); } else {
        counter.textContent = 'Все желания отпущены ♥'; form.classList.add('gone'); sfx.chime();
        setTimeout(api.done, 4500);
      }
    }
    btn.onclick = launch;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') launch(); });
    setTimeout(() => input.focus({ preventScroll: true }), 400);
  }

  /* ===== День 7 — главный вопрос ===== */
  function finale(stage, api) {
    const yes = h('button', { class: 'btn btn-yes', type: 'button' }, C.finalYes || 'Да ♥');
    const no = h('button', { class: 'btn btn-ghost btn-no', type: 'button' }, 'Нет');
    const arena = h('div', { class: 'arena' }, yes, no);
    const card = h('div', { class: 'final-card' }, h('p', { class: 'eyebrow' }, 'Один вопрос'), h('h3', { class: 'question' }, C.finalQuestion), arena);
    stage.append(card);
    const NO = ['Нет', 'Точно нет?', 'Подумай ещё', 'Ну пожалуйста 🥺', 'Кнопка устала', 'Не-а, не выйдет', '…'];
    let tries = 0, lastFlee = 0;
    requestAnimationFrame(() => {
      const a = arena.getBoundingClientRect(), nb = no.getBoundingClientRect();
      no.style.left = a.width * 0.72 - nb.width / 2 + 'px'; no.style.top = a.height / 2 - nb.height / 2 + 'px';
    });
    function flee(e) {
      const now = performance.now(); if (no.dataset.gone || now - lastFlee < 250) return; lastFlee = now;
      tries++; sfx.tick();
      yes.style.setProperty('--grow', Math.min(1.9, 1 + tries * 0.15));
      if (tries >= NO.length) {
        no.dataset.gone = '1';
        no.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0) rotate(-20deg)' }], { duration: 400, fill: 'forwards', easing: 'cubic-bezier(.55,0,1,.45)' });
        return;
      }
      no.textContent = NO[tries];
      const a = arena.getBoundingClientRect(), nb = no.getBoundingClientRect(), yb = yes.getBoundingClientRect();
      const px = (e?.clientX ?? 0) - a.left, py = (e?.clientY ?? 0) - a.top;
      let x, y, guard = 0;
      do {
        x = rand(0, Math.max(0, a.width - nb.width)); y = rand(0, Math.max(0, a.height - nb.height)); guard++;
        var hitsYes = x < yb.right - a.left + 16 && x + nb.width > yb.left - a.left - 16 && y < yb.bottom - a.top + 16 && y + nb.height > yb.top - a.top - 16;
        var nearPtr = Math.hypot(x + nb.width / 2 - px, y + nb.height / 2 - py) < 130;
      } while (guard < 60 && (hitsYes || nearPtr));
      no.style.left = x + 'px'; no.style.top = y + 'px';
    }
    no.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') flee(e); });
    no.addEventListener('pointerdown', e => { e.preventDefault(); flee(e); });
    no.addEventListener('click', e => { e.preventDefault(); flee(e); });
    yes.onclick = async () => {
      if (yes.dataset.done) return; yes.dataset.done = '1';
      no.remove(); card.classList.add('said-yes');
      L.fireworks(7000); L.bg.boost(3);
      await wait(1400); api.done();
    };
  }

  /* ===== Концовка после письма ===== */
  function ending(wrap) {
    wrap.append(h('section', { class: 'prize ending' },
      h('p', { class: 'display sm' }, 'Конец недели.', h('br'), h('em', {}, 'Начало — навсегда.')),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { L.fireworks(5000); L.bg.boost(2); } }, 'Ещё салют ✨')));
  }

  window.Days = { games: [catchHearts, scratch, memory, constellation, balloons, lanterns, finale], extras: { 6: ending } };
})();
