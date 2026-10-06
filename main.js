(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const small = matchMedia('(max-width: 760px)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rand = n => Math.floor(Math.random() * n);

  /* ── Smooth scroll ─────────────────────────── */
  const lenis = !reduce && window.Lenis
    ? new window.Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    : null;

  /* ── Text splitting ────────────────────────── */
  $$('.split').forEach((el, li) => {
    el.innerHTML = [...el.textContent].map((c, i) => `<span class="char" style="--ci:${i + li * 4}">${c}</span>`).join('');
  });
  // Words: each wrapped in its own clip so it can slide up into place
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(' ');
          const w = document.createElement('span');
          const inner = document.createElement('span');
          w.className = 'w';
          inner.textContent = part;
          inner.style.setProperty('--i', i++);
          w.append(inner);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'BR') walk(n);
    });
    walk(el);
  });

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    void body.offsetWidth; // flush initial styles so the entrance transitions run, even in a background tab
    body.classList.add('loaded');
    measure();
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  setTimeout(start, 1400);

  /* ── Reveal on scroll ──────────────────────── */
  const revealIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    revealIO.unobserve(e.target);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  $$('[data-reveal], [data-split]').forEach(el => revealIO.observe(el));

  /* ── Count-up facts ────────────────────────── */
  const countIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, t0 = performance.now();
    const step = t => {
      const p = clamp((t - t0) / 1600);
      el.textContent = p < 1 ? Math.round(end * (1 - Math.pow(2, -10 * p))) : end;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  if (!reduce) $$('[data-count]').forEach(el => { el.textContent = '0'; countIO.observe(el); });

  /* ── Nav: current-section indicator + tone ─── */
  const nav = $('#nav');
  const nowNo = $('.nav-now-no'), nowName = $('.nav-now-name'), nowBox = $('.nav-now');
  const navLinks = $$('.nav-links a');
  const sections = $$('[data-no]');
  const nowIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const s = e.target;
    if (nowNo.textContent !== s.dataset.no) {
      nowBox.classList.add('swap');
      requestAnimationFrame(() => {
        nowNo.textContent = s.dataset.no;
        nowName.textContent = s.dataset.name;
        requestAnimationFrame(() => nowBox.classList.remove('swap'));
      });
    }
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + s.id));
  }), { rootMargin: '-50% 0px -50% 0px' });
  // Tone follows whatever section is under the nav bar itself
  const toneIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) nav.classList.toggle('on-dark', e.target.dataset.tone === 'dark');
  }), { rootMargin: '0px 0px -94% 0px' });
  sections.forEach(s => { nowIO.observe(s); toneIO.observe(s); });

  /* ── Mobile menu ───────────────────────────── */
  const menuBtn = $('.menu-btn');
  const menu = $('#menu');
  const menuOpen = () => root.classList.contains('menu-open');
  const setMenu = open => {
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    $('.menu-btn-label', menuBtn).textContent = open ? 'Close' : 'Menu';
    $('#main').inert = open;
    if (open) { lenis?.stop(); nav.classList.remove('hide'); $('a', menu).focus(); }
    else lenis?.start();
  };
  menuBtn.addEventListener('click', () => setMenu(!menuOpen()));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen()) { setMenu(false); menuBtn.focus(); } });

  /* ── In-page links: smooth, and move focus ─── */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && $(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen()) setMenu(false);
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
    history.pushState(null, '', id);
  }));

  /* ── Local time ────────────────────────────── */
  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const tick = () => { clock.textContent = fmt.format(new Date()) + ' IST'; };
  tick();
  setInterval(tick, 15000);

  /* ── Copy email ────────────────────────────── */
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const status = $('.copy-status', btn.parentElement);
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
      btn.classList.add('done');
      status.textContent = 'Email address copied.';
    } catch {
      status.textContent = 'Could not copy. Select the address instead.';
    }
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); status.textContent = ''; }, 2200);
  }));

  /* ── Cursor (fine pointers only) ───────────── */
  const cursor = $('.cursor'), cursorLabel = $('.cursor-label');
  let px = -200, py = -200, pDirty = false, pSpeed = 0, lastPX = 0, lastPY = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pSpeed = Math.hypot(e.clientX - lastPX, e.clientY - lastPY);
    lastPX = px = e.clientX; lastPY = py = e.clientY; pDirty = true;
  }, { passive: true });
  if (fine) {
    root.classList.add('has-cursor');
    addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button');
      const label = t?.dataset.cursor;
      cursor.classList.toggle('is-label', !!label);
      cursor.classList.toggle('is-link', !!t && !label);
      if (label) {
        cursorLabel.textContent = label;
        cursor.classList.toggle('on-light', !t.closest('[data-tone="dark"]'));
      }
    });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { cursor.style.opacity = ''; });
  }

  /* ── Magnetic elements ─────────────────────── */
  if (fine && !reduce) $$('[data-magnetic]').forEach(el => {
    let r = null;
    el.addEventListener('pointerenter', () => { el.style.transform = ''; r = el.getBoundingClientRect(); el.classList.add('is-pulled'); });
    el.addEventListener('pointermove', e => {
      if (!r) return;
      const x = (e.clientX - r.left - r.width / 2) * 0.28, y = (e.clientY - r.top - r.height / 2) * 0.4;
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    });
    el.addEventListener('pointerleave', () => { r = null; el.classList.remove('is-pulled'); el.style.transform = ''; });
  });

  /* ── Scroll-linked scene (all geometry cached; the loop never reads layout) ── */
  const bar = $('.progress');
  const heroLines = $$('.hero-name .line');
  const heroMid = $('.hero-mid');
  const work = $('.work'), stage = $('.stage');
  const band = $('.band-track');
  const pars = $$('[data-speed]').map(el => ({ el, speed: +el.dataset.speed, top: 0, h: 0, room: 0, last: null }));

  let vh = innerHeight, maxScroll = 1, renderedY = -1, lastDirY = 0;
  let workTop = 0, stageP = -1, mHalf = 0, bandBottom = 0, mx = 0, contactTop = 0;

  function measure() {
    vh = innerHeight;
    const y = scrollY;
    pars.forEach(p => {
      const r = p.el.parentElement.getBoundingClientRect();
      p.top = r.top + y; p.h = r.height; p.room = r.height * 0.085; p.last = null;
    });
    workTop = work.getBoundingClientRect().top + y;
    contactTop = $('.contact').getBoundingClientRect().top + y;
    mHalf = band.scrollWidth / 2;
    bandBottom = band.getBoundingClientRect().bottom + y;
    maxScroll = Math.max(1, root.scrollHeight - vh);
    stageP = -1;
    renderedY = -1;
    forms.forEach(f => f.resize());
  }

  function update(y) {
    bar.style.transform = `scaleX(${clamp(y / maxScroll).toFixed(4)})`;
    if (Math.abs(y - lastDirY) > 8) {
      nav.classList.toggle('hide', y > lastDirY && y > vh * 0.8 && !menuOpen());
      lastDirY = y;
    }
    if (reduce) return;

    // Hero: the two name lines drift apart, the middle rises
    if (y < vh * 1.2) {
      const p = y / vh;
      heroLines[0].style.transform = `translate3d(${(-p * 7).toFixed(3)}vw,0,0)`;
      heroLines[1].style.transform = `translate3d(${(p * 5).toFixed(3)}vw,0,0)`;
      heroMid.style.transform = `translate3d(0,${(-p * 60).toFixed(1)}px,0)`;
    }

    // Work: the black stage opens from an inset panel to full bleed
    const sp = Math.round(clamp((y + vh - workTop) / (vh * 0.9)) * 1000) / 1000;
    if (sp !== stageP) {
      stageP = sp;
      const inset = (1 - sp) * Math.min(innerWidth * 0.06, 80), radius = (1 - sp) * 32;
      stage.style.clipPath = sp >= 1 ? 'none' : `inset(0 ${inset.toFixed(1)}px round ${radius.toFixed(1)}px)`;
    }

    // Parallax: images drift inside their frames, only while on screen
    for (const p of pars) {
      if (p.top > y + vh || p.top + p.h < y) continue;
      const off = clamp((p.top + p.h / 2 - (y + vh / 2)) * p.speed * (small ? 0.5 : 1), -p.room, p.room);
      const v = Math.round(off * 10) / 10;
      if (v !== p.last) { p.last = v; p.el.style.transform = `translate3d(0,${v}px,0)`; }
    }
  }

  /* ── 3D form: a noise-deformed object drawn as stacked contour slices ── */
  const VERT = `
attribute vec2 a_uv;
uniform float u_t, u_amp, u_asp, u_s, u_dir;
uniform vec2 u_m;
varying float v_z;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
void main(){
  float th = a_uv.x * 6.28318530718;
  float ph = mix(0.2, 2.94, a_uv.y);
  vec3 p = vec3(sin(ph)*cos(th), cos(ph), sin(ph)*sin(th));
  float n = snoise(p*1.1 + vec3(0.0, u_t*0.10, u_t*0.05)) + 0.4*snoise(p*2.5 - vec3(u_t*0.06));
  p *= 1.0 + u_amp*n;
  p.y *= 1.1;
  float ay = u_dir*(u_t*0.06 + u_s*1.3) + u_m.x*0.5, ax = -0.3 + u_m.y*0.3;
  float cy=cos(ay), sy=sin(ay), cx=cos(ax), sx=sin(ax);
  p = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z);
  p = vec3(p.x, cx*p.y - sx*p.z, sx*p.y + cx*p.z);
  v_z = p.z;
  float f = 2.6 / (p.z + 3.6) * 0.74;
  gl_Position = vec4(p.x*f/u_asp, p.y*f, 0.0, 1.0);
}`;
  const FRAG = `
precision mediump float;
varying float v_z;
uniform vec3 u_col; uniform float u_alpha;
void main(){
  float a = u_alpha * mix(0.1, 1.0, 1.0 - smoothstep(-1.1, 1.1, v_z));
  gl_FragColor = vec4(u_col*a, a);
}`;

  function makeForm(canvas, { col, alpha, dir, progress }) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    if (!gl) { canvas.remove(); return null; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); canvas.remove(); return null; }
    gl.useProgram(prog);

    // ponytail: geometry is fixed per device class; rebuild on breakpoint change only if it ever matters
    const RINGS = small ? 34 : 58, SEG = small ? 110 : 170;
    const uv = new Float32Array(RINGS * (SEG + 1) * 2);
    const idx = new Uint16Array(RINGS * SEG * 2);
    let k = 0, q = 0;
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s <= SEG; s++) { uv[k++] = s / SEG; uv[k++] = r / (RINGS - 1); }
      for (let s = 0; s < SEG; s++) { const b = r * (SEG + 1) + s; idx[q++] = b; idx[q++] = b + 1; }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    const U = n => gl.getUniformLocation(prog, n);
    const u = { t: U('u_t'), amp: U('u_amp'), asp: U('u_asp'), s: U('u_s'), dir: U('u_dir'), m: U('u_m'), col: U('u_col'), alpha: U('u_alpha') };
    gl.uniform3fv(u.col, col);
    gl.uniform1f(u.alpha, alpha);
    gl.uniform1f(u.dir, dir);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const f = { active: false, mx: 0, my: 0, amp: 0.18, tamp: 0.18, w: 0, h: 0 };
    f.resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w === f.w && h === f.h) return;
      f.w = canvas.width = w; f.h = canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform1f(u.asp, w / Math.max(1, h));
      if (reduce) f.draw(14);
    };
    f.draw = t => {
      // ease toward the pointer; pointer speed briefly agitates the surface
      const tx = fine ? (px / innerWidth) * 2 - 1 : 0, ty = fine ? (py / innerHeight) * 2 - 1 : 0;
      f.mx += (tx - f.mx) * 0.04; f.my += (ty - f.my) * 0.04;
      f.tamp = Math.max(0.18, f.tamp * 0.97); f.amp += (f.tamp - f.amp) * 0.05;
      gl.uniform1f(u.t, t);
      gl.uniform1f(u.amp, f.amp);
      gl.uniform1f(u.s, progress());
      gl.uniform2f(u.m, f.mx, f.my);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.LINES, idx.length, gl.UNSIGNED_SHORT, 0);
    };
    f.kick = s => { f.tamp = Math.min(0.32, f.tamp + s * 0.0015); };
    new IntersectionObserver(([e]) => { f.active = e.isIntersecting; }).observe(canvas);
    return f;
  }

  const forms = [
    makeForm($('[data-form="hero"]'), { col: [0.04, 0.04, 0.04], alpha: 0.5, dir: 1, progress: () => clamp(scrollY / vh) }),
    makeForm($('[data-form="contact"]'), { col: [1, 1, 1], alpha: 0.32, dir: -1, progress: () => clamp((scrollY + vh - contactTop) / (vh * 2)) }),
  ].filter(Boolean);

  /* ── One loop: Lenis, scroll scene, band, cursor, forms ── */
  let rate = 1, dir = 1, prevY = scrollY, lastT = 0;
  if (!reduce) band.classList.add('js-driven');

  function frame(t) {
    lenis?.raf(t);
    const y = scrollY;
    if (y !== renderedY) { update(y); renderedY = y; }

    if (pDirty) {
      cursor.style.transform = `translate3d(${px}px,${py}px,0)`;
      pDirty = false;
      forms.forEach(f => f.kick(pSpeed));
    }

    if (!reduce) {
      if (mHalf) {
        const dt = Math.min(t - (lastT || t), 50);
        const v = lenis ? lenis.velocity : y - prevY;
        if (v > 0.3) dir = 1; else if (v < -0.3) dir = -1;
        rate += (dir * (1 + Math.min(Math.abs(v) * 0.1, 4)) - rate) * 0.06;
        mx -= (mHalf / 50000) * dt * rate;
        if (mx <= -mHalf) mx += mHalf; else if (mx > 0) mx -= mHalf;
        if (y < bandBottom) band.style.transform = `translate3d(${mx.toFixed(2)}px,0,0)`;
      }
      if (!document.hidden) forms.forEach(f => f.active && f.draw(t / 1000));
    }
    lastT = t;
    prevY = y;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let resizeT;
  const remeasure = () => { clearTimeout(resizeT); resizeT = setTimeout(measure, 150); };
  addEventListener('resize', remeasure);
  addEventListener('load', measure);
  new ResizeObserver(remeasure).observe(body);
  measure();

  /* ── Project visuals (run only while on screen) ── */
  const whileVisible = (el, fn, ms) => {
    let id = 0;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !id) id = setInterval(fn, ms);
      else if (!e.isIntersecting && id) { clearInterval(id); id = 0; }
    }).observe(el);
  };

  // SyncChron: a timetable evolving until clashes hit zero
  const ga = $('.vis-ga');
  if (ga) {
    const SUBJ = [['DS', '#eaeaea', '#0a0a0a'], ['OOP', '#cfcfcf', '#0a0a0a'], ['DSTL', '#a0a0a0', '#0a0a0a'], ['BD', '#6e6e6e', '#ffffff'],
      ['CS', '#ffffff', '#0a0a0a'], ['LAB', '#3a3a3a', '#ffffff'], ['', '#191919', '#a0a0a0']];
    const grid = $('[data-ga-grid]', ga);
    const cells = [];
    for (let r = 0; r < 6; r++) {
      const slot = document.createElement('span');
      slot.className = 'ga-slot';
      slot.textContent = 'P' + (r + 1);
      grid.append(slot);
      for (let d = 0; d < 5; d++) {
        const c = document.createElement('span');
        c.className = 'ga-cell';
        grid.append(c);
        cells.push(c);
      }
    }
    const paint = (c, i) => { const s = SUBJ[i]; c.textContent = s[0]; c.style.setProperty('--c', s[1]); c.style.setProperty('--t', s[2]); c.dataset.s = i; };
    const gen = $('[data-ga-gen]', ga), fit = $('[data-ga-fit]', ga), clash = $('[data-ga-clash]', ga);
    let g = 0, hold = 0;
    const reset = () => { g = 0; ga.classList.remove('done'); cells.forEach(c => paint(c, rand(SUBJ.length))); };
    const show = n => {
      cells.forEach(c => c.classList.remove('clash'));
      for (let i = 0; i < n; i++) cells[rand(cells.length)].classList.add('clash');
      gen.textContent = String(g).padStart(3, '0');
      fit.textContent = (1 - n / 24).toFixed(3);
      clash.textContent = n;
    };
    reset();
    if (reduce) { g = 42; ga.classList.add('done'); show(0); }
    else {
      show(14);
      whileVisible(ga, () => {
        if (hold) { if (--hold === 0) reset(); return; }
        g++;
        const a = cells[rand(cells.length)], b = cells[rand(cells.length)];
        const sa = +a.dataset.s, sb = +b.dataset.s;
        a.classList.add('swap'); b.classList.add('swap');
        setTimeout(() => { paint(a, sb); paint(b, sa); a.classList.remove('swap'); b.classList.remove('swap'); }, 160);
        const n = Math.max(0, Math.round(14 * Math.exp(-g / 9) + (Math.random() - 0.5) * 1.5));
        show(g > 36 ? 0 : n);
        if (g > 36) { ga.classList.add('done'); hold = 7; }
      }, 420);
    }
  }

  // Secured: ciphertext that never settles
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const codes = $$('[data-cipher]');
  codes.forEach(c => { c.textContent = Array.from({ length: +c.dataset.cipher }, () => B64[rand(64)]).join('') + '=='; });
  if (codes.length && !reduce) {
    whileVisible($('.vis-cipher'), () => codes.forEach(c => {
      const t = [...c.textContent];
      for (let k = 0; k < 3; k++) t[rand(t.length - 2)] = B64[rand(64)];
      c.textContent = t.join('');
    }), 150);
  }

  // NASA: flip through random APOD dates
  const apod = $('[data-apod]');
  if (apod && !reduce) {
    const first = Date.UTC(1995, 5, 16), now = Date.now();
    whileVisible(apod, () => {
      const final = new Date(first + Math.random() * (now - first)).toISOString().slice(0, 10);
      let k = 0;
      const spin = setInterval(() => {
        apod.textContent = ++k < 7 ? final.replace(/\d/g, () => rand(10)) : final;
        if (k >= 7) clearInterval(spin);
      }, 45);
    }, 2200);
  }
})();
