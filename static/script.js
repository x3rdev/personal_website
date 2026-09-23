(() => {
  const root = document.documentElement;
  const fine = matchMedia('(pointer: fine)').matches;
  if (fine){
    addEventListener('pointermove', e => {
      root.style.setProperty('--mx', (e.clientX / innerWidth * 100).toFixed(1));
    }, {passive:true});
  }

  /* scroll: progress bar, section rules, and (on touch) the text light band */
  let ticking = false;
  function onScroll(){
    const max = document.documentElement.scrollHeight - innerHeight;
    const sy = max > 0 ? scrollY / max : 0;
    root.style.setProperty('--sy', sy.toFixed(4));
    if (!fine) root.style.setProperty('--mx', (15 + sy * 70).toFixed(1));
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, {passive:true});
  addEventListener('resize', onScroll);
  onScroll();
})();

/* ASCII name: sampled from real type, then drawn as terminal characters */
(() => {
  const cv = document.getElementById('name');
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RAMP = '.:-=+*#%@';
  const NOISE = '01<>/\\|[]{}=+*^?#$%&';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let cells = [], cell = 8, W = 0, H = 0, dpr = 1, start = 0, mxPx = -9999, myPx = -9999, animating = false;

  function hex(h){ const n = parseInt(h.replace('#',''),16); return [n>>16&255, n>>8&255, n&255]; }
  function mix(a,b,t){ return a.map((v,i) => Math.round(v + (b[i]-v)*t)); }

  function sample(){
    W = cv.parentElement.clientWidth;
    cell = W < 500 ? 6 : W < 800 ? 7 : 9;
    const size = Math.min(W * 0.205, 190);
    const lh = size * 0.95;
    H = Math.ceil(lh * 2 + size * 0.1);
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';

    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d');
    o.fillStyle = '#000';
    o.font = `800 ${size}px "Hanken Grotesk", system-ui, sans-serif`;
    o.textBaseline = 'alphabetic';
    o.fillText('Nicolae', 0, size * 0.82);
    o.fillText('Ungur', 0, size * 0.82 + lh);
    const data = o.getImageData(0, 0, W, H).data;
    const txt = document.getElementById('nameText');
    txt.style.fontSize = size + 'px';
    txt.style.lineHeight = lh + 'px';
    txt.style.top = (size * 0.82 - lh * 0.8) + 'px';

    cells = [];
    for (let y = 0; y < H; y += cell){
      for (let x = 0; x < W; x += cell){
        let sum = 0, n = 0;
        for (let yy = y; yy < Math.min(H, y + cell); yy += 2)
          for (let xx = x; xx < Math.min(W, x + cell); xx += 2){ sum += data[(yy*W + xx)*4 + 3]; n++; }
        const cov = sum / (n * 255);
        if (cov > 0.08){
          const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(cov * RAMP.length))];
          cells.push({ x, y, ch, cov, delay: (x / W) * 700 + Math.random() * 450 });
        }
      }
    }
  }

  function draw(now){
    const t = now - start;
    const ink = hex(css('--ink')), muted = hex(css('--muted'));
    const band = [hex(css('--h1')), hex(css('--h2')), hex(css('--h3')), hex(css('--h4'))];
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.font = `500 ${cell * 1.25}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let busy = false;
    for (const c of cells){
      const local = t - c.delay;
      let ch = c.ch, col = ink, a = 0.35 + c.cov * 0.65;
      if (!reduce && local < 0){ continue; }
      if (!reduce && local < 380){
        busy = true;
        ch = NOISE[(Math.random() * NOISE.length) | 0];
        col = muted; a *= 0.4 + local / 380 * 0.6;
      } else if (selected){
        const k = c.x / W * 3, i = Math.min(2, Math.floor(k));
        col = mix(band[i], band[i+1], k - i); a = Math.min(1, a + .15);
      } else {
        const dx = c.x - mxPx, dy = c.y - myPx, d = Math.hypot(dx, dy);
        if (d < 150){
          const k = 1 - d / 150;
          const pos = Math.min(2.999, Math.max(0, ((dx + dy) / 300 + 1) / 2 * 3));
          const i = Math.floor(pos);
          col = mix(ink, mix(band[i], band[i+1], pos - i), k * k * (3 - 2 * k));
        }
      }
      if (!reduce && local < 0) busy = true;
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      ctx.fillText(ch, c.x + cell/2, c.y + cell/2);
    }
    if (!reduce && t < 1600) busy = true;
    if (busy) requestAnimationFrame(draw); else animating = false;
  }

  let selected = false;
  const txtEl = document.getElementById('nameText');
  document.addEventListener('selectionchange', () => {
    const sel = getSelection();
    const now = !!sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.getRangeAt(0).intersectsNode(txtEl);
    if (now !== selected){ selected = now; kick(); }
  });
  document.addEventListener('copy', e => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.getRangeAt(0).intersectsNode(txtEl)) return;
    e.clipboardData.setData('text/plain', sel.toString().replace(/\s*\n\s*/g, ' ').trim());
    e.preventDefault();
  });

  function kick(){ if (!animating){ animating = true; requestAnimationFrame(draw); } }

  addEventListener('pointermove', e => {
    const b = cv.getBoundingClientRect();
    if (e.clientY < b.top - 120 || e.clientY > b.bottom + 120) { if (mxPx !== -9999){ mxPx = -9999; kick(); } return; }
    mxPx = e.clientX - b.left; myPx = e.clientY - b.top; kick();
  }, {passive:true});
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { sample(); start = performance.now() - 5000; kick(); }, 150); });
  const recolor = () => kick();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
  new MutationObserver(recolor).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});

  Promise.all([
    document.fonts.load('800 100px "Hanken Grotesk"'),
    document.fonts.load('500 10px "JetBrains Mono"')
  ]).catch(()=>{}).finally(() => { sample(); start = performance.now(); kick(); });
})();
