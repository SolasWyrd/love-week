/* Экраны: интро → дни → сцена дня → письмо */
(() => {
  'use strict';
  const L = window.Love, C = window.LOVE, D = window.Days;
  const { $, $$, h, wait, sfx, bg, burst, store, toast, tilt, shake, typewrite, heartSvg, center } = L;

  const params = new URLSearchParams(location.search);
  if (params.has('reset')) { try { Object.keys(localStorage).filter(k => k.startsWith('lw:')).forEach(k => localStorage.removeItem(k)); } catch {} }
  const preview = params.has('preview');
  const done = new Set(store.get('done', []));
  const markDone = i => { done.add(i); store.set('done', [...done]); };

  document.title = C.siteTitle || document.title;
  $$('[data-her]').forEach(e => (e.textContent = C.herName));
  $('[data-intro]').textContent = C.introText;
  $('[data-hub]').textContent = C.hubText;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  /* ----- даты ----- */
  const [Y, M, Dd] = C.startDate.split('-').map(Number);
  const unlockAt = i => new Date(Y, M - 1, Dd + i, C.unlockHour || 0);
  const isOpen = i => preview || Date.now() >= unlockAt(i).getTime();
  const dateLabel = i => unlockAt(i).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  const pad = n => String(n).padStart(2, '0');
  function left(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), d = Math.floor(s / 86400);
    return (d ? d + ' д ' : '') + `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  /* ----- звук ----- */
  const soundBtn = $('#sound');
  const syncSound = () => { soundBtn.classList.toggle('off', !sfx.on); soundBtn.setAttribute('aria-pressed', sfx.on); };
  syncSound();
  soundBtn.onclick = () => { sfx.toggle(); syncSound(); sfx.tick(); };

  /* ----- переключение экранов ----- */
  async function show(id) {
    const cur = $('.screen.is-active'), next = $('#' + id);
    if (cur === next) return;
    if (cur) { cur.classList.add('is-leaving'); await wait(L.reduce ? 0 : 600); cur.classList.remove('is-active', 'is-leaving'); }
    next.classList.add('is-active'); scrollTo(0, 0);
  }

  /* ----- интро: удерживай сердце ----- */
  (function intro() {
    const btn = $('#holdHeart'), ring = $('#holdHeart .ring-progress'), hint = $('#intro .hint');
    const LEN = 2 * Math.PI * 56, DUR = 1300;
    ring.style.strokeDasharray = LEN; ring.style.strokeDashoffset = LEN;
    let p = 0, holding = false, raf = 0, last = 0, finished = false, lastTick = 0;
    function loop(now) {
      const dt = now - last; last = now;
      p = Math.max(0, Math.min(1, p + (holding ? dt / DUR : -dt / 450)));
      ring.style.strokeDashoffset = LEN * (1 - p); btn.style.setProperty('--p', p.toFixed(3));
      if (holding && now - lastTick > 110) { lastTick = now; sfx.note(Math.floor(p * 9)); }
      if (p >= 1) return finish();
      raf = holding || p > 0 ? requestAnimationFrame(loop) : 0;
    }
    function startHold(e) {
      if (finished) return;
      e.preventDefault(); sfx.unlock(); holding = true; hint.textContent = 'Ещё чуть-чуть…';
      btn.setPointerCapture?.(e.pointerId);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }
    const stop = () => { if (holding && !finished) hint.textContent = 'Не отпускай 🙂'; holding = false; };
    btn.addEventListener('pointerdown', startHold);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, stop));
    btn.addEventListener('click', e => { if (e.detail === 0) finish(); });
    btn.addEventListener('contextmenu', e => e.preventDefault());
    async function finish() {
      if (finished) return; finished = true; cancelAnimationFrame(raf);
      const c = center(btn);
      sfx.win(); burst(c.x, c.y, { count: 46, spread: 280, size: [12, 30] }); bg.boost(2.5);
      btn.classList.add('bloom');
      await wait(500); await show('hub'); renderHub(true);
    }
  })();

  /* ----- сетка дней ----- */
  const grid = $('#days');
  const ICON = {
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };
  let tickT;
  const statusOf = i => (!isOpen(i) ? 'locked' : done.has(i) ? 'done' : 'open');
  function renderHub(animate = false) {
    grid.textContent = ''; grid.classList.toggle('quiet', !animate);
    const firstNew = C.days.findIndex((_, i) => statusOf(i) === 'open');
    C.days.forEach((d, i) => {
      const st = statusOf(i);
      const status = st === 'locked' ? h('span', { 'data-left': i }, 'через ' + left(unlockAt(i) - Date.now())) : st === 'done' ? 'Открыто · перечитать' : 'Открыть →';
      const card = h('button', { class: `day-card is-${st}${i === firstNew ? ' is-new' : ''}${i === 6 ? ' is-final' : ''}`, type: 'button', style: `--i:${i}`, 'aria-label': `День ${i + 1}${st === 'locked' ? ', ещё закрыт' : ': ' + d.title}` },
        h('span', { class: 'day-top' },
          h('span', { class: 'day-num' }, pad(i + 1)),
          h('span', { class: 'day-icon', html: st === 'locked' ? ICON.lock : st === 'done' ? ICON.done : heartSvg() })),
        h('span', { class: 'day-date' }, dateLabel(i)),
        h('span', { class: 'day-title' }, st === 'locked' ? (i === 6 ? 'Финал' : 'Секрет') : d.title),
        h('span', { class: 'day-status' }, status),
        i === firstNew ? h('span', { class: 'badge' }, 'Новое') : null);
      tilt(card);
      card.onclick = () => {
        if (st !== 'locked') return openDay(i, card);
        shake(card); sfx.bad(); toast(`Терпение 😉 Этот день откроется ${dateLabel(i)}`);
      };
      grid.append(card);
    });
    $('#progressText').textContent = `Открыто ${done.size} из 7`;
    $('.progress i').style.width = (done.size / 7) * 100 + '%';
    clearInterval(tickT);
    tickT = setInterval(() => {
      let changed = false;
      $$('[data-left]').forEach(el => { const ms = unlockAt(+el.dataset.left) - Date.now(); if (ms <= 0) changed = true; else el.textContent = 'через ' + left(ms); });
      if (changed) renderHub(true);
    }, 1000);
  }

  /* ----- сцена дня ----- */
  const scene = $('#scene'), body = $('#sceneBody');
  let cleanup = null, origin = null;
  const radius = c => Math.hypot(Math.max(c.x, innerWidth - c.x), Math.max(c.y, innerHeight - c.y));

  async function openDay(i, from) {
    sfx.chime();
    const d = C.days[i];
    origin = center(from);
    body.textContent = '';
    const stage = h('div', { class: 'stage reveal', style: '--i:3' }), reward = h('div', { class: 'reward' });
    body.append(
      h('header', { class: 'scene-head' },
        h('p', { class: 'eyebrow reveal', style: '--i:0' }, `День ${i + 1} · ${dateLabel(i)}`),
        h('h2', { class: 'display reveal', style: '--i:1' }, d.title),
        h('p', { class: 'lead reveal', style: '--i:2' }, d.hint),
        done.has(i) ? h('button', { class: 'link-btn reveal', style: '--i:3', type: 'button', onclick: e => { e.currentTarget.remove(); finishDay(i, stage, reward, true); } }, 'Сразу к письму →') : null),
      stage, reward);
    scene.style.clipPath = `circle(0px at ${origin.x}px ${origin.y}px)`;
    scene.hidden = false; scene.scrollTop = 0;
    document.body.classList.add('lock');
    scene.classList.add('is-active');
    cleanup = D.games[i](stage, { done: () => finishDay(i, stage, reward) }) || null;
    history.pushState({ day: i }, '', `#day-${i + 1}`);
    if (!L.reduce) await scene.animate([{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }, { clipPath: `circle(${radius(origin)}px at ${origin.x}px ${origin.y}px)` }], { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)' }).finished;
    scene.style.clipPath = '';
  }

  async function finishDay(i, stage, reward, skip = false) {
    if (reward.dataset.shown) return; reward.dataset.shown = '1';
    markDone(i);
    if (!skip) { sfx.win(); bg.boost(1.5); const c = center(stage); burst(c.x, c.y, { count: 36, spread: 240 }); await wait(1000); }
    if (cleanup) { cleanup(); cleanup = null; }
    if (stage.isConnected) {
      await stage.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.96)', filter: 'blur(8px)' }], { duration: 450, easing: 'ease-in', fill: 'forwards' }).finished;
      stage.remove();
    }
    reward.append(buildLetter(i));
    reward.scrollIntoView({ behavior: L.reduce ? 'auto' : 'smooth', block: 'center' });
  }

  function buildLetter(i) {
    const wrap = h('div', { class: 'letter-wrap' });
    const env = h('button', { class: 'envelope', type: 'button', 'aria-label': 'Открыть письмо' },
      h('span', { class: 'env-back' }), h('span', { class: 'env-paper' }), h('span', { class: 'env-front' }), h('span', { class: 'env-flap' }),
      h('span', { class: 'env-seal', html: heartSvg() }));
    const hint = h('p', { class: 'hint' }, 'Тебе письмо. Нажми на конверт');
    wrap.append(env, hint);
    env.onclick = async () => {
      if (env.classList.contains('open')) return;
      env.classList.add('open'); hint.remove(); sfx.chime();
      await wait(L.reduce ? 0 : 1400);
      await env.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(40px) scale(.9)' }], { duration: 380, fill: 'forwards', easing: 'ease-in' }).finished;
      env.remove();
      const text = h('div', { class: 'letter-body' }), sign = h('p', { class: 'letter-sign' }, C.signature);
      const letter = h('article', { class: 'letter' }, h('p', { class: 'letter-to' }, C.letterGreeting.replace('{name}', C.herName)), text, sign);
      wrap.append(letter);
      letter.animate([{ opacity: 0, transform: 'translateY(40px) scale(.95) rotate(-3deg)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.22,1,.36,1)' });
      await typewrite(text, C.days[i].letter);
      sign.classList.add('show');
      await wait(500);
      D.extras[i]?.(wrap);
      wrap.append(h('button', { class: 'btn btn-ghost back-all', type: 'button', onclick: () => closeScene() }, '← Ко всем дням'));
    };
    return wrap;
  }

  async function closeScene(fromPop = false) {
    if (scene.hidden || scene.dataset.closing) return;
    scene.dataset.closing = '1';
    if (cleanup) { cleanup(); cleanup = null; }
    const c = origin || { x: innerWidth / 2, y: innerHeight / 2 };
    renderHub(false);
    if (!L.reduce) await scene.animate([{ clipPath: `circle(${radius(c)}px at ${c.x}px ${c.y}px)` }, { clipPath: `circle(0px at ${c.x}px ${c.y}px)` }], { duration: 700, easing: 'cubic-bezier(.7,0,.2,1)' }).finished;
    scene.hidden = true; scene.classList.remove('is-active'); body.textContent = '';
    document.body.classList.remove('lock'); delete scene.dataset.closing;
    if (!fromPop && history.state?.day != null) history.back();
  }
  $('#sceneBack').onclick = () => closeScene();
  addEventListener('keydown', e => { if (e.key === 'Escape') closeScene(); });
  addEventListener('popstate', () => closeScene(true));
})();
