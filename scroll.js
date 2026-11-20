/* Daybook scroll engine, ported from the Daybook dashboard (smooth-scroll.ts, scroll-spy.ts, motion.ts)
 * to plain JS for this static app. Loaded by every page.
 *
 * 1. Smooth wheel: mouse-wheel notches glide (LERP 0.15, no ease-in). Trackpads and touch stay native.
 * 2. Jumps: DBScroll.glideTo / DBScroll.glideIntoView glide on the app curve cubic-bezier(.65,0,.35,1),
 *    0.45s to 0.8s at 1x, divided by SPEED.
 * 3. DBScroll.isJumping(scroller) lets a scroll spy hold its highlight while a jump is gliding.
 *
 * Never add CSS scroll-behavior:smooth: it fights both the wheel glide and the jumps.
 */
(function(){
  'use strict';
  if(window.DBScroll) return;

  /** One dial for how fast jumps move. 1 = original pace; 1.5 = 50% faster. */
  var SPEED = 1.5;
  var ms = function(millis){ return Math.round(millis / SPEED); };
  // Pace of the wheel glide: 0.15 settles in about half a second, applied by elapsed time.
  var LERP = 0.15;
  var reduced = function(){ return matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var rootEl = function(){ return document.scrollingElement || document.documentElement; };

  var nearInt = function(v){ return Math.abs(v - Math.round(v)) < 0.02; };
  function isWheelNotch(e){
    if(e.deltaMode !== 0) return true; // lines or pages: always a real wheel
    if(e.deltaX !== 0 || !e.deltaY) return false;
    var d = Math.abs(e.deltaY);
    // Mouse wheels send big whole-number steps with no sideways part; trackpads send small fractional ones.
    if(d >= 40 && Number.isInteger(e.deltaY)) return true;
    // With page zoom or Windows display scaling (110%, 125%, 150%...) Chrome and Edge divide each
    // notch by the zoom, so it arrives as e.g. 66.67 or 90.91. The legacy wheelDeltaY still counts
    // whole 120-unit wheel ticks, and trackpads in Chrome/Safari give exactly -3 x deltaY instead.
    var w = e.wheelDeltaY;
    if(typeof w === 'number' && w !== 0){
      if(Math.abs(w + 3 * e.deltaY) < 0.5) return false;
      if(Math.abs(w) % 120 === 0 && d >= 20) return true;
    }
    // Browsers without wheelDeltaY: a zoomed notch is still a whole number of device pixels.
    var z = window.devicePixelRatio || 1;
    return d >= 30 && nearInt(d * z);
  }

  function isScrollerStyle(el){
    var oy = getComputedStyle(el).overflowY;
    return oy === 'auto' || oy === 'scroll' || oy === 'overlay';
  }

  function canScroll(el, dir){
    var root = el === document.scrollingElement;
    if(!root){
      if(!isScrollerStyle(el)) return false;
    } else if(getComputedStyle(document.documentElement).overflowY === 'hidden' || getComputedStyle(document.body).overflowY === 'hidden'){
      return false;
    }
    if(el.scrollHeight <= el.clientHeight + 1) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  }

  // Pop-ups (.overlay backdrops, or anything marked data-scroll-contain) and panes with
  // overscroll-behavior:contain keep the wheel inside: it never leaks through to the page behind.
  var CONTAINED = 'contained';
  function contains(el){
    if(el.hasAttribute('data-scroll-contain') || el.classList.contains('overlay')) return true;
    if(!isScrollerStyle(el) || el.scrollHeight <= el.clientHeight + 1) return false;
    var ob = getComputedStyle(el).overscrollBehaviorY;
    return ob === 'contain' || ob === 'none';
  }

  function scrollerFor(target, dir){
    var el = target instanceof Element ? target : null;
    while(el && el !== document.body && el !== document.documentElement){
      if(canScroll(el, dir)) return el;
      if(contains(el)) return CONTAINED;
      el = el.parentElement;
    }
    var root = document.scrollingElement;
    return root && canScroll(root, dir) ? root : null;
  }

  /* ---------- 1. smooth wheel ---------- */
  (function smoothWheel(){
    if(reduced()) return;
    var el = null, pos = 0, to = 0, last = 0, lastPos = 0, raf = 0, lastWheel = 0, moved = false;

    function stop(){ cancelAnimationFrame(raf); raf = 0; el = null; }

    function frame(now){
      raf = 0;
      // The panel closed or was swapped out mid-glide: let go.
      if(!el || !el.isConnected) return stop();
      // Someone else moved it (scrollbar drag, keyboard, a jump): let go.
      if(Math.abs(el.scrollTop - lastPos) > 2) return stop();
      var dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      pos += (to - pos) * (1 - Math.exp(-60 * LERP * dt));
      var done = Math.abs(to - pos) < 0.5;
      if(done) pos = to;
      el.scrollTo({top: pos, behavior: 'instant'});
      lastPos = el.scrollTop;
      if(done) stop();
      else raf = requestAnimationFrame(frame);
    }

    function onWheel(e){
      if(e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if(!isWheelNotch(e)){
        // Trackpads scroll natively, except through a pop-up's backdrop to the page behind.
        if(e.deltaY && scrollerFor(e.target, Math.sign(e.deltaY)) === CONTAINED) e.preventDefault();
        return;
      }
      var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      var dir = Math.sign(delta);
      var now = performance.now();
      var found = scrollerFor(e.target, dir);
      if(found === CONTAINED){ e.preventDefault(); return; }
      var target = found;
      // While you keep spinning with the mouse held still, keep scrolling what you started on.
      if(!moved && el && raf && now - lastWheel < 300 && Math.sign(to - pos) === dir && canScroll(el, dir)) target = el;
      lastWheel = now;
      moved = false;
      if(!target) return;
      e.preventDefault();
      // A jump is gliding this scroller: your wheel takes over.
      stopJump(target);

      var max = target.scrollHeight - target.clientHeight;
      if(el !== target || !raf){
        // Switching to another panel mid-glide: fully clear the old loop first.
        cancelAnimationFrame(raf);
        raf = 0;
        el = target;
        pos = to = target.scrollTop;
        // Count the first frame as a full frame, so the very next paint already moves.
        last = performance.now() - 1000 / 60;
      }
      // Mid-glide notches add onto where we're heading, not where we are.
      to = Math.max(0, Math.min(max, to + delta));
      lastPos = target.scrollTop;
      if(!raf) raf = requestAnimationFrame(frame);
    }

    var cancel = function(){ if(el) stop(); };
    var mx = -1, my = -1;
    function onMove(e){
      if(e.pointerType !== 'mouse') return;
      if(Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) > 3) moved = true;
      mx = e.clientX; my = e.clientY;
    }
    window.addEventListener('wheel', onWheel, {passive: false});
    // Open any page with ?wheel to see what each wheel event reports and whether it glides.
    if(/[?&]wheel\b/.test(location.search)){
      var badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.8);color:#fff;font:12px/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre';
      badge.textContent = 'Spin the mouse wheel';
      var addBadge = function(){ document.body.appendChild(badge); };
      if(document.body) addBadge(); else document.addEventListener('DOMContentLoaded', addBadge);
      window.addEventListener('wheel', function(e){
        badge.textContent = 'deltaY ' + e.deltaY + '  mode ' + e.deltaMode + '\nwheelDeltaY ' + e.wheelDeltaY + '  deltaX ' + e.deltaX + '\nzoom x' + (window.devicePixelRatio || 1) + '\n' + (isWheelNotch(e) ? 'mouse wheel: glides' : 'trackpad: native');
      }, {passive: true, capture: true});
    }
    window.addEventListener('pointerdown', cancel, true);
    window.addEventListener('pointermove', onMove, {passive: true, capture: true});
    window.addEventListener('touchstart', cancel, {passive: true, capture: true});
    window.addEventListener('keydown', cancel, true);
  })();

  /* ---------- 2. jumps on the app curve ---------- */
  // cubic-bezier(0.65, 0, 0.35, 1), solved for y at time x.
  function ease(x){
    var x1 = 0.65, y1 = 0, x2 = 0.35, y2 = 1;
    var bx = function(t){ return 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t; };
    var by = function(t){ return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t; };
    var lo = 0, hi = 1, t = x;
    for(var i = 0; i < 24; i++){ t = (lo + hi) / 2; if(bx(t) < x) lo = t; else hi = t; }
    return by(t);
  }

  var jumps = new Map(); // scroller -> end()

  function stopJump(sc){
    if(sc){ var f = jumps.get(sc); if(f) f(); return; }
    Array.from(jumps.values()).forEach(function(f){ f(); });
  }

  function norm(sc){
    return !sc || sc === window || sc === document || sc === document.documentElement || sc === document.body ? rootEl() : sc;
  }

  function maxOf(sc){ return Math.max(0, sc.scrollHeight - sc.clientHeight); }

  /** Glide a scroller (or the page, for window) to a top position. `top` may be a function,
   *  re-measured every frame in case the layout is still settling. */
  function glideTo(scroller, top, opts){
    opts = opts || {};
    var sc = norm(scroller);
    var dest = function(){ var v = typeof top === 'function' ? top() : top; return Math.max(0, Math.min(maxOf(sc), v)); };
    stopJump(sc);
    var from = sc.scrollTop;
    if(opts.instant || reduced() || Math.abs(dest() - from) < 2){
      sc.scrollTo({top: dest(), behavior: 'instant'});
      if(opts.done) opts.done();
      return;
    }
    // Longer trips take a little longer, but never drag: 0.45s to 0.8s at 1x, through the speed dial.
    var dist = Math.abs(dest() - from);
    var dur = ms(Math.min(800, 450 + dist * 0.05));
    var start = performance.now(), raf = 0;
    function end(){
      cancelAnimationFrame(raf);
      if(jumps.get(sc) === end) jumps.delete(sc);
      window.removeEventListener('wheel', onInput);
      window.removeEventListener('touchstart', onInput);
      window.removeEventListener('keydown', onInput);
      window.dispatchEvent(new CustomEvent('dbscroll:jumped', {detail: {scroller: sc}}));
      if(opts.done) opts.done();
    }
    // Any wheel, touch or key from you takes over straight away.
    function onInput(){ end(); }
    jumps.set(sc, end);
    window.addEventListener('wheel', onInput, {passive: true});
    window.addEventListener('touchstart', onInput, {passive: true});
    window.addEventListener('keydown', onInput);
    function frame(now){
      var p = Math.min(1, (now - start) / dur);
      sc.scrollTo({top: from + (dest() - from) * ease(p), behavior: 'instant'});
      if(p < 1) raf = requestAnimationFrame(frame);
      else end();
    }
    raf = requestAnimationFrame(frame);
  }

  function scrollAncestors(el){
    var out = [], p = el.parentElement;
    while(p && p !== document.body && p !== document.documentElement){
      if(isScrollerStyle(p) && p.scrollHeight > p.clientHeight + 1) out.push(p);
      p = p.parentElement;
    }
    out.push(rootEl());
    return out;
  }

  /** Height of the sticky top bar on screen, if any, so the page lands just below it. */
  function topbarHeight(){
    var bars = document.querySelectorAll('.bar');
    for(var i = 0; i < bars.length; i++){
      var b = bars[i], cs = getComputedStyle(b);
      if(cs.position === 'sticky' && b.offsetParent !== null && b.getBoundingClientRect().bottom > 0) return b.getBoundingClientRect().height;
    }
    return 0;
  }

  // Where `sc` has to scroll for `el` to sit at `block` ('start' or 'center') of its visible area.
  function placeIn(sc, el, block){
    var root = sc === rootEl();
    var vTop = root ? 0 : sc.getBoundingClientRect().top + sc.clientTop;
    var vH = root ? window.innerHeight : sc.clientHeight;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var y = sc.scrollTop + r.top - vTop;
    if(block === 'center') return y - (vH - r.height) / 2;
    if(block === 'nearest'){
      var bottom = y + r.height - vH;
      if(r.top - vTop >= 0 && r.bottom <= vTop + vH) return sc.scrollTop;
      return r.top - vTop < 0 || r.height > vH ? y - (parseFloat(cs.scrollMarginTop) || 0) : bottom + (parseFloat(cs.scrollMarginBottom) || 0);
    }
    return y - (parseFloat(cs.scrollMarginTop) || 0) - (root ? topbarHeight() : 0);
  }

  /** Smooth replacement for el.scrollIntoView({behavior:'smooth', block}). Glides the nearest
   *  scroller to place `el`, and any outer scrollers (the page) just far enough to show it. */
  function glideIntoView(el, opts){
    if(!el) return;
    opts = opts || {};
    var block = opts.block || 'start';
    var chain = scrollAncestors(el);
    chain.forEach(function(sc, i){
      var inner = i === 0 ? el : chain[i - 1];
      glideTo(sc, function(){ return placeIn(sc, inner, i === 0 ? block : 'nearest'); }, {instant: opts.instant});
    });
  }

  window.DBScroll = {
    SPEED: SPEED,
    ms: ms,
    glideTo: glideTo,
    glideIntoView: glideIntoView,
    stop: stopJump,
    isJumping: function(sc){ return sc ? jumps.has(norm(sc)) : jumps.size > 0; }
  };
})();
