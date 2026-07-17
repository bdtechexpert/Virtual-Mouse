(function(){
  if(document.getElementById('vm-styles'))return;
  var s=document.createElement('style');s.id='vm-styles';
  s.textContent='html{scroll-behavior:auto!important}*{scroll-behavior:auto!important}#vm-cursor{position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;user-select:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;will-change:transform;filter:drop-shadow(1px 2px 2px rgba(0,0,0,.4));transition:none;display:block}#vm-cursor.vm-cursor-hidden{display:none}#vm-hover-highlight{position:fixed;z-index:2147483646;pointer-events:none;border:2px solid rgba(144,238,144,.7);background:rgba(144,238,144,.08);border-radius:3px;transition:top .06s linear,left .06s linear,width .06s linear,height .06s linear;display:none}#vm-hover-highlight.vm-visible{display:block}.vm-ripple{position:fixed;width:24px;height:24px;border-radius:50%;pointer-events:none;z-index:2147483646;animation:vm-ripple-anim .45s ease-out forwards}@keyframes vm-ripple-anim{0%{transform:translate(-50%,-50%) scale(.4);opacity:.8}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}#vm-mode-indicator{position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:6px 18px;border-radius:20px;font-size:.8rem;font-weight:700;z-index:2147483646;pointer-events:none;opacity:0;transition:opacity .2s ease;text-transform:uppercase;letter-spacing:.06em}#vm-mode-indicator.vm-active{opacity:1}#vm-mode-indicator.vm-scroll{background:rgba(144,238,144,.92);color:#1a1a2e}#vm-mode-indicator.vm-precision{background:rgba(144,238,144,.92);color:#1a1a2e}#vm-mode-indicator.vm-drag{background:rgba(144,238,144,.92);color:#1a1a2e}#vm-speed-indicator{position:fixed;bottom:12px;right:12px;padding:4px 10px;border-radius:6px;font-size:.7rem;font-weight:600;z-index:2147483646;pointer-events:none;background:rgba(26,26,46,.75);color:#90ee90;opacity:0;transition:opacity .3s ease}#vm-speed-indicator.vm-visible{opacity:1}#vm-cursor.vm-clicking svg path{fill:#90ee90}@media(max-width:649px){#vm-cursor,#vm-hover-highlight,#vm-mode-indicator,#vm-speed-indicator,.vm-ripple{display:none!important;visibility:hidden!important;opacity:0!important}}';
  (document.head||document.documentElement).appendChild(s);
})();
(function() {
  'use strict';

  /* ------------------------------------------
     CONFIGURATION
     ------------------------------------------ */
  var CONFIG = {
    SPEED_SLOW: 1.5,
    SPEED_NORMAL: 2.5,
    SPEED_FAST: 5,
    SPEED_PRECISION_MULTIPLIER: 1.00,
    LONG_PRESS_START: 300,
    LONG_PRESS_MAX_ACCEL: 1.5,
    HOLD_THRESHOLD: 500,
    DOUBLE_CLICK_THRESHOLD: 350,
    TRIPLE_CLICK_THRESHOLD: 600,
    SCROLL_AMOUNT: 60,
    HSCROLL_AMOUNT: 40,
    POINTER_ID: 9991,
    LERP_FACTOR: 0.45,
    HOVER_DEBOUNCE: 16,
    EASING_ACCEL_RAMP: 600,
    EDGE_SCROLL_ZONE: 10,
    EDGE_SCROLL_AMOUNT: 50,
    CURSOR_AUTO_HIDE_DELAY: 5000,
    MIN_WIDTH: 650
  };

  /* ------------------------------------------
     STATE
     ------------------------------------------ */
  var state = {
    enabled: true,
    visible: true,
    x: 10,
    y: 10,
    displayX: 10,
    displayY: 10,
    speed: 'normal',
    precisionMode: false,
    scrollMode: false,
    dragMode: false,
    isDragging: false,
    dragTarget: null,
    dragDataTransfer: null,
    lastHoveredElement: null,
    lastHoverTime: 0,
    pressedKeys: {},
    keyHoldStart: {},
    okDownTime: 0,
    okHoldTimer: null,
    clickSequence: 0,
    clickSequenceTimer: null,
    lastClickTime: 0,
    rafId: null,
    lastFrameTime: 0,
    animating: false,
    speedShowTimer: null,
    cursorAutoShown: false,
    cursorHideTimer: null
  };

  /* ------------------------------------------
     DOM REFERENCES
     ------------------------------------------ */
  var cursorEl = null;
  var hoverHighlight = null;
  var modeIndicator = null;
  var speedIndicator = null;
  var mutationObserver = null;

  /* ------------------------------------------
     UTILITY FUNCTIONS
     ------------------------------------------ */
  function clamp(val, min, max) {
    return val < min ? min : (val > max ? max : val);
  }

  function now() {
    return performance.now();
  }

  function getBaseSpeed() {
    /* Precision mode = fast speed, normal mode = normal speed */
    if (state.precisionMode) return CONFIG.SPEED_FAST;
    var speeds = { slow: CONFIG.SPEED_SLOW, normal: CONFIG.SPEED_NORMAL, fast: CONFIG.SPEED_FAST };
    return speeds[state.speed] || CONFIG.SPEED_NORMAL;
  }

  function getViewportWidth() {
    return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  }

  function getViewportHeight() {
    return window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  }

  /* ------------------------------------------
     CREATE CURSOR
     ------------------------------------------ */
  function createCursor() {
    if (cursorEl) return;
    cursorEl = document.createElement('div');
    cursorEl.id = 'vm-cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    cursorEl.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;">' +
        '<path d="M2 1 L2 19 L6.5 14.5 L10.5 22 L13 21 L9 13.5 L15 13.5 Z" ' +
          'fill="white" stroke="black" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>';
    document.documentElement.appendChild(cursorEl);
    updateCursorPositionImmediate();
  }

  function createHoverHighlight() {
    if (hoverHighlight) return;
    hoverHighlight = document.createElement('div');
    hoverHighlight.id = 'vm-hover-highlight';
    hoverHighlight.setAttribute('aria-hidden', 'true');
    document.documentElement.appendChild(hoverHighlight);
  }

  function createModeIndicator() {
    if (modeIndicator) return;
    modeIndicator = document.createElement('div');
    modeIndicator.id = 'vm-mode-indicator';
    modeIndicator.setAttribute('aria-hidden', 'true');
    document.documentElement.appendChild(modeIndicator);
  }

  function createSpeedIndicator() {
    if (speedIndicator) return;
    speedIndicator = document.createElement('div');
    speedIndicator.id = 'vm-speed-indicator';
    speedIndicator.setAttribute('aria-hidden', 'true');
    document.documentElement.appendChild(speedIndicator);
  }

  /* ------------------------------------------
     CLICK RIPPLE
     ------------------------------------------ */
  function createRipple(x, y, color) {
    var ripple = document.createElement('div');
    ripple.className = 'vm-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.border = '2px solid ' + (color || 'rgba(233, 69, 96, 0.7)');
    document.documentElement.appendChild(ripple);
    setTimeout(function() {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 500);
  }

  /* ------------------------------------------
     CURSOR POSITION UPDATE
     ------------------------------------------ */
  function updateCursorPositionImmediate() {
    if (!cursorEl) return;
    cursorEl.style.transform = 'translate(' + Math.round(state.displayX) + 'px,' + Math.round(state.displayY) + 'px)';
  }

  /* ------------------------------------------
     MODE INDICATOR
     ------------------------------------------ */
  function updateModeIndicator() {
    if (!modeIndicator) return;
    modeIndicator.className = 'vm-active';
    if (state.scrollMode) {
      modeIndicator.classList.add('vm-scroll');
      modeIndicator.textContent = 'Scroll Mode';
    } else if (state.isDragging) {
      modeIndicator.classList.add('vm-drag');
      modeIndicator.textContent = 'Dragging';
    } else if (state.precisionMode) {
      modeIndicator.classList.add('vm-precision');
      modeIndicator.textContent = 'Precision Mode';
    } else {
      modeIndicator.className = '';
    }
  }

  function flashSpeedIndicator() {
    if (!speedIndicator) return;
    var label = state.speed.charAt(0).toUpperCase() + state.speed.slice(1);
    if (state.precisionMode) label += ' (Precision)';
    speedIndicator.textContent = 'Speed: ' + label;
    speedIndicator.classList.add('vm-visible');
    clearTimeout(state.speedShowTimer);
    state.speedShowTimer = setTimeout(function() {
      speedIndicator.classList.remove('vm-visible');
    }, 1500);
  }

  /* ------------------------------------------
     CURSOR AUTO-HIDE
     ------------------------------------------ */
  function showCursorAuto() {
    state.cursorAutoShown = true;
    if (cursorEl) cursorEl.classList.remove('vm-cursor-hidden');
    clearTimeout(state.cursorHideTimer);
    state.cursorHideTimer = setTimeout(hideCursorAuto, CONFIG.CURSOR_AUTO_HIDE_DELAY);
  }

  function hideCursorAuto() {
    state.cursorAutoShown = false;
    if (cursorEl) cursorEl.classList.add('vm-cursor-hidden');
    if (hoverHighlight) hoverHighlight.classList.remove('vm-visible');
    clearTimeout(state.cursorHideTimer);
    state.cursorHideTimer = null;
  }

  /* ------------------------------------------
     HIT DETECTION
     ------------------------------------------ */
  function getTargetElement(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el === cursorEl || el === hoverHighlight || el === modeIndicator || el === speedIndicator) {
      /* Skip VM elements - try parent */
      el = el.parentElement;
      if (!el || el === document.body || el === document.documentElement) return null;
    }
    return el;
  }

  /* Walk up DOM to find the nearest clickable ancestor */
  function findClickableAncestor(el) {
    if (!el) return null;
    var walk = el;
    var depth = 0;
    while (walk && walk !== document.body && walk !== document.documentElement && depth < 10) {
      var tag = walk.tagName;
      if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' ||
          tag === 'SELECT' || tag === 'OPTION' || tag === 'VIDEO' || tag === 'AUDIO' ||
          tag === 'SUMMARY' || tag === 'LABEL' ||
          walk.getAttribute('role') === 'button' || walk.getAttribute('role') === 'link' ||
          walk.getAttribute('role') === 'tab' || walk.getAttribute('role') === 'menuitem' ||
          walk.getAttribute('role') === 'option' || walk.onclick ||
          (walk.style && walk.style.cursor === 'pointer') ||
          walk.hasAttribute('data-href') || walk.hasAttribute('ng-click') ||
          walk.hasAttribute('@click') || walk.hasAttribute('v-on:click')) {
        return walk;
      }
      walk = walk.parentElement;
      depth++;
    }
    return el;
  }

  function getClickableTarget(el) {
    if (!el) return null;
    var tag = el.tagName;
    if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' ||
        tag === 'SELECT' || tag === 'OPTION' || tag === 'VIDEO' || tag === 'AUDIO' ||
        tag === 'CANVAS' || tag === 'SVG' || tag === 'SUMMARY' || tag === 'DETAILS' ||
        tag === 'LABEL' || el.hasAttribute('contenteditable') ||
        el.hasAttribute('draggable') || el.getAttribute('role') === 'button' ||
        el.getAttribute('role') === 'link' || el.getAttribute('role') === 'option' ||
        el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'menuitem' ||
        el.onclick || el.style && el.style.cursor === 'pointer') {
      return el;
    }
    return el;
  }

  /* ------------------------------------------
     HOVER HIGHLIGHT
     ------------------------------------------ */
  function updateHoverHighlight(el) {
    if (!hoverHighlight) return;
    if (!state.cursorAutoShown) {
      hoverHighlight.classList.remove('vm-visible');
      return;
    }
    if (!el || el === document.body || el === document.documentElement) {
      hoverHighlight.classList.remove('vm-visible');
      return;
    }
    var rect = el.getBoundingClientRect();
    hoverHighlight.style.top = rect.top + 'px';
    hoverHighlight.style.left = rect.left + 'px';
    hoverHighlight.style.width = rect.width + 'px';
    hoverHighlight.style.height = rect.height + 'px';
    hoverHighlight.classList.add('vm-visible');
  }

  /* ------------------------------------------
     AUTO FOCUS
     ------------------------------------------ */
  function autoFocusElement(el) {
    if (!el) return;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      el.focus();
    }
    if (el.hasAttribute && el.hasAttribute('contenteditable')) {
      el.focus();
    }
    if (el.getAttribute && el.getAttribute('tabindex') !== null) {
      el.focus();
    }
    var role = el.getAttribute && el.getAttribute('role');
    if (role === 'textbox' || role === 'searchbox' || role === 'combobox') {
      el.focus();
    }
  }

  /* ------------------------------------------
     EVENT DISPATCHING - MOUSE
     ------------------------------------------ */
  function createMouseInit(type, x, y, button, buttons, detail) {
    return {
      bubbles: true,
      cancelable: type !== 'mouseenter' && type !== 'mouseleave' && type !== 'mousemove',
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y + 80,
      pageX: x + (window.scrollX || window.pageXOffset),
      pageY: y + (window.scrollY || window.pageYOffset),
      button: button || 0,
      buttons: buttons !== undefined ? buttons : 0,
      detail: detail || 0,
      relatedTarget: null,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false
    };
  }

  function dispatchMouseEvent(type, target, x, y, button, buttons, detail) {
    if (!target) return;
    try {
      var evt = new MouseEvent(type, createMouseInit(type, x, y, button, buttons, detail));
      target.dispatchEvent(evt);
    } catch(e) {
      try {
        var evt2 = document.createEvent('MouseEvents');
        evt2.initMouseEvent(type, true, true, window,
          detail || 0, x, y, x, y + 80,
          false, false, false, false, button || 0, null);
        target.dispatchEvent(evt2);
      } catch(e2) { /* silent */ }
    }
  }

  /* ------------------------------------------
     EVENT DISPATCHING - POINTER
     ------------------------------------------ */
  function dispatchPointerEvent(type, target, x, y, button, buttons, detail) {
    if (!target) return;
    try {
      var evt = new PointerEvent(type, {
        bubbles: true,
        cancelable: type !== 'pointerenter' && type !== 'pointerleave',
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y + 80,
        pageX: x + (window.scrollX || window.pageXOffset),
        pageY: y + (window.scrollY || window.pageYOffset),
        button: button || 0,
        buttons: buttons !== undefined ? buttons : 0,
        detail: detail || 0,
        pointerId: CONFIG.POINTER_ID,
        pointerType: 'mouse',
        isPrimary: true,
        width: 1,
        height: 1,
        pressure: buttons > 0 ? 0.5 : 0,
        tiltX: 0,
        tiltY: 0,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false
      });
      target.dispatchEvent(evt);
    } catch(e) { /* silent */ }
  }

  /* ------------------------------------------
     EVENT DISPATCHING - TOUCH
     ------------------------------------------ */
  function dispatchTouchEvent(type, target, x, y) {
    if (!target) return;
    try {
      var touch = new Touch({
        identifier: CONFIG.POINTER_ID,
        target: target,
        clientX: x,
        clientY: y,
        pageX: x + (window.scrollX || window.pageXOffset),
        pageY: y + (window.scrollY || window.pageYOffset),
        screenX: x,
        screenY: y + 80,
        radiusX: 6,
        radiusY: 6,
        rotationAngle: 0,
        force: 0.5
      });

      var touchList = [touch];
      var evtInit = {
        bubbles: true,
        cancelable: true,
        touches: type === 'touchend' ? [] : touchList,
        targetTouches: type === 'touchend' ? [] : touchList,
        changedTouches: touchList
      };

      var evt = new TouchEvent(type, evtInit);
      target.dispatchEvent(evt);
    } catch(e) { /* silent */ }
  }

  /* ------------------------------------------
     EVENT DISPATCHING - WHEEL
     ------------------------------------------ */
  function dispatchWheelEvent(target, x, y, deltaX, deltaY) {
    if (!target) return;
    try {
      var evt = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y + 80,
        deltaX: deltaX,
        deltaY: deltaY,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false
      });
      target.dispatchEvent(evt);
    } catch(e) { /* silent */ }
  }

  /* ------------------------------------------
     EVENT DISPATCHING - DRAG
     ------------------------------------------ */
  function dispatchDragEvent(type, target, x, y) {
    if (!target) return;
    try {
      var dt = state.dragDataTransfer;
      if (!dt) {
        dt = new DataTransfer();
        state.dragDataTransfer = dt;
      }
      var evt = new DragEvent(type, {
        bubbles: true,
        cancelable: type !== 'dragend' && type !== 'dragleave' && type !== 'dragexit',
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y + 80,
        pageX: x + (window.scrollX || window.pageXOffset),
        pageY: y + (window.scrollY || window.pageYOffset),
        dataTransfer: dt,
        button: 0,
        buttons: 1,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false
      });
      target.dispatchEvent(evt);
    } catch(e) { /* silent */ }
  }

  /* ------------------------------------------
     HOVER TRACKING
     ------------------------------------------ */
  function handleHover(x, y) {
    var t = now();
    if (t - state.lastHoverTime < CONFIG.HOVER_DEBOUNCE) return;
    state.lastHoverTime = t;

    var target = getTargetElement(x, y);

    if (target !== state.lastHoveredElement) {
      var oldEl = state.lastHoveredElement;
      var newEl = target;

      if (oldEl) {
        dispatchMouseEvent('mouseout', oldEl, x, y, 0, 0, 0);
        dispatchMouseEvent('mouseleave', oldEl, x, y, 0, 0, 0);
        dispatchPointerEvent('pointerout', oldEl, x, y, 0, 0, 0);
        dispatchPointerEvent('pointerleave', oldEl, x, y, 0, 0, 0);
      }
      if (newEl) {
        dispatchMouseEvent('mouseover', newEl, x, y, 0, 0, 0);
        dispatchMouseEvent('mouseenter', newEl, x, y, 0, 0, 0);
        dispatchPointerEvent('pointerover', newEl, x, y, 0, 0, 0);
        dispatchPointerEvent('pointerenter', newEl, x, y, 0, 0, 0);
      }
      state.lastHoveredElement = newEl;
    }

    if (!state.isDragging) {
      updateHoverHighlight(target);
    }

    if (target) {
      dispatchMouseEvent('mousemove', target, x, y, 0, 0, 0);
      dispatchPointerEvent('pointermove', target, x, y, 0, 0, 0);
    }
  }

  /* ------------------------------------------
     CLICK SEQUENCE
     ------------------------------------------ */
  /* After a click, forward to the real input if the target is a <label>
     so that checkboxes / radios actually toggle. */
  function forwardLabelClick(target) {
    var el = target;
    while (el && el !== document.body) {
      if (el.tagName === 'LABEL') {
        /* label.control = the input it's for */
        var input = el.control || el.querySelector('input');
        if (input) { try { input.click(); } catch(e) {} }
        return;
      }
      el = el.parentElement;
    }
  }

  function fireFullClickSequence(x, y, clickDetail) {
    var target = getTargetElement(x, y);
    if (!target) return;

    /* Find nearest clickable ancestor for better hit detection */
    var clickTarget = findClickableAncestor(target);
    var useTarget = clickTarget || target;

    dispatchPointerEvent('pointerdown', useTarget, x, y, 0, 1, clickDetail);
    dispatchTouchEvent('touchstart', useTarget, x, y);
    dispatchMouseEvent('mousedown', useTarget, x, y, 0, 1, clickDetail);
    autoFocusElement(useTarget);

    dispatchMouseEvent('mouseup', useTarget, x, y, 0, 0, clickDetail);
    dispatchPointerEvent('pointerup', useTarget, x, y, 0, 0, clickDetail);
    dispatchTouchEvent('touchend', useTarget, x, y);
    dispatchMouseEvent('click', useTarget, x, y, 0, 0, clickDetail);
    dispatchPointerEvent('click', useTarget, x, y, 0, 0, clickDetail);

    /* Fallback: try native .click() for elements that ignore dispatched events */
    try { useTarget.click(); } catch(e) {}

    /* Also dispatch on original target if different from clickable ancestor */
    if (useTarget !== target) {
      dispatchMouseEvent('click', target, x, y, 0, 0, clickDetail);
      try { target.click(); } catch(e) {}
    }

    /* Ensure checkboxes / radios inside labels actually toggle */
    forwardLabelClick(useTarget);
    forwardLabelClick(target);

    createRipple(x, y, 'rgba(144, 238, 144, 0.8)');
    cursorFlash();
  }

  function fireDoubleClickSequence(x, y) {
    var target = getTargetElement(x, y);
    if (!target) return;

    dispatchPointerEvent('pointerdown', target, x, y, 0, 1, 1);
    dispatchMouseEvent('mousedown', target, x, y, 0, 1, 1);
    autoFocusElement(target);

    dispatchMouseEvent('mouseup', target, x, y, 0, 0, 1);
    dispatchPointerEvent('pointerup', target, x, y, 0, 0, 1);
    dispatchMouseEvent('click', target, x, y, 0, 0, 1);
    dispatchPointerEvent('click', target, x, y, 0, 0, 1);

    dispatchPointerEvent('pointerdown', target, x, y, 0, 1, 2);
    dispatchMouseEvent('mousedown', target, x, y, 0, 1, 2);

    dispatchMouseEvent('mouseup', target, x, y, 0, 0, 2);
    dispatchPointerEvent('pointerup', target, x, y, 0, 0, 2);
    dispatchMouseEvent('click', target, x, y, 0, 0, 2);
    dispatchPointerEvent('click', target, x, y, 0, 0, 2);
    dispatchMouseEvent('dblclick', target, x, y, 0, 0, 2);
    dispatchPointerEvent('dblclick', target, x, y, 0, 0, 2);

    createRipple(x, y, 'rgba(139, 92, 246, 0.8)');
    cursorFlash();
  }

  function fireRightClickSequence(x, y) {
    var target = getTargetElement(x, y);
    if (!target) return;

    dispatchPointerEvent('pointerdown', target, x, y, 2, 2, 0);
    dispatchMouseEvent('mousedown', target, x, y, 2, 2, 0);

    dispatchMouseEvent('mouseup', target, x, y, 2, 0, 0);
    dispatchPointerEvent('pointerup', target, x, y, 2, 0, 0);
    dispatchMouseEvent('contextmenu', target, x, y, 2, 0, 0);

    createRipple(x, y, 'rgba(59, 130, 246, 0.7)');
    cursorFlash();
  }

  function cursorFlash() {
    if (!cursorEl) return;
    cursorEl.classList.add('vm-clicking');
    setTimeout(function() { cursorEl.classList.remove('vm-clicking'); }, 120);
  }

  /* ------------------------------------------
     DRAG MODE
     ------------------------------------------ */
  function enterDragMode() {
    var target = getTargetElement(state.x, state.y);
    if (!target) return;

    state.dragMode = true;
    state.isDragging = true;
    state.dragTarget = target;
    state.dragDataTransfer = new DataTransfer();

    dispatchPointerEvent('pointerdown', target, state.x, state.y, 0, 1, 1);
    dispatchTouchEvent('touchstart', target, state.x, state.y);
    dispatchMouseEvent('mousedown', target, state.x, state.y, 0, 1, 1);
    autoFocusElement(target);

    try {
      var dragEvt = new DragEvent('dragstart', {
        bubbles: true, cancelable: true, view: window,
        clientX: state.x, clientY: state.y,
        dataTransfer: state.dragDataTransfer,
        button: 0, buttons: 1
      });
      target.dispatchEvent(dragEvt);
    } catch(e) { /* silent */ }

    showCursorAuto();
    if (hoverHighlight) hoverHighlight.classList.remove('vm-visible');
    updateModeIndicator();
  }

  function updateDrag(x, y) {
    if (!state.isDragging || !state.dragTarget) return;

    dispatchPointerEvent('pointermove', state.dragTarget, x, y, 0, 1, 0);
    dispatchTouchEvent('touchmove', state.dragTarget, x, y);
    dispatchMouseEvent('mousemove', state.dragTarget, x, y, 0, 1, 0);

    try {
      var dragEvt = new DragEvent('drag', {
        bubbles: true, cancelable: false, view: window,
        clientX: x, clientY: y,
        dataTransfer: state.dragDataTransfer,
        button: 0, buttons: 1
      });
      state.dragTarget.dispatchEvent(dragEvt);
    } catch(e) { /* silent */ }
  }

  function endDrag() {
    if (!state.isDragging || !state.dragTarget) {
      state.dragMode = false;
      state.isDragging = false;
      updateModeIndicator();
      return;
    }

    var target = state.dragTarget;

    dispatchMouseEvent('mouseup', target, state.x, state.y, 0, 0, 1);
    dispatchPointerEvent('pointerup', target, state.x, state.y, 0, 0, 1);
    dispatchTouchEvent('touchend', target, state.x, state.y);

    var dropTarget = getTargetElement(state.x, state.y);
    if (dropTarget && dropTarget !== target) {
      try {
        var dropEvt = new DragEvent('drop', {
          bubbles: true, cancelable: true, view: window,
          clientX: state.x, clientY: state.y,
          dataTransfer: state.dragDataTransfer,
          button: 0, buttons: 0
        });
        dropTarget.dispatchEvent(dropEvt);
      } catch(e) { /* silent */ }
    }

    try {
      var dragEndEvt = new DragEvent('dragend', {
        bubbles: true, cancelable: false, view: window,
        clientX: state.x, clientY: state.y,
        dataTransfer: state.dragDataTransfer,
        button: 0, buttons: 0
      });
      target.dispatchEvent(dragEndEvt);
    } catch(e) { /* silent */ }

    state.dragMode = false;
    state.isDragging = false;
    state.dragTarget = null;
    state.dragDataTransfer = null;

    showCursorAuto();
    updateModeIndicator();
    updateHoverHighlight(getTargetElement(state.x, state.y));
  }

  /* ------------------------------------------
     SCROLL MODE
     ------------------------------------------ */
  function handleScrollMovement(dx, dy) {
    var target = getTargetElement(state.x, state.y) || document.documentElement;
    if (dx !== 0 || dy !== 0) {
      dispatchWheelEvent(target, state.x, state.y, dx, dy);
    }
  }

  /* ------------------------------------------
     KEY HANDLING
     ------------------------------------------ */
  function getMaxKeyHoldDuration() {
    var maxDur = 0;
    var keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (var i = 0; i < keys.length; i++) {
      if (state.pressedKeys[keys[i]] && state.keyHoldStart[keys[i]]) {
        var dur = now() - state.keyHoldStart[keys[i]];
        if (dur > maxDur) maxDur = dur;
      }
    }
    return maxDur;
  }

  /* Check if the currently focused element accepts text input */
  function isTextEditingElement(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      var t = (el.type || 'text').toLowerCase();
      return ['text','search','password','email','url','tel','number','date','time','datetime-local','month','week','color'].indexOf(t) !== -1;
    }
    if (el.isContentEditable) return true;
    if (tag === 'SELECT') return true;
    return false;
  }

  function handleKeyDown(e) {
    if (!state.enabled) return;

    var key = e.key;
    var active = document.activeElement;
    var typing = isTextEditingElement(active);

    /* When a text input / textarea / contenteditable is focused,
       pass all keys through to the element so the user can type.
       Only Escape is intercepted to blur the element and return to mouse mode. */
    if (typing) {
      if (key === 'Escape') {
        e.preventDefault();
        active.blur();
        return;
      }
      /* Do NOT intercept any key — let it reach the input */
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      if (!state.pressedKeys[key]) {
        state.pressedKeys[key] = true;
        state.keyHoldStart[key] = now();
      }
      showCursorAuto();
      return;
    }

    if (key === 'Enter' || key === 'OK' || key === 'Center') {
      e.preventDefault();
      if (!state.pressedKeys['Enter']) {
        state.pressedKeys['Enter'] = true;
        state.okDownTime = now();

        clearTimeout(state.okHoldTimer);
        state.okHoldTimer = setTimeout(function() {
          if (state.pressedKeys['Enter'] && !state.isDragging && !state.scrollMode) {
            enterDragMode();
          }
        }, CONFIG.HOLD_THRESHOLD);
      }
      return;
    }

    if (key === 'Backspace' || key === 'Back' || key === 'Escape') {
      e.preventDefault();
      if (state.isDragging) {
        clearTimeout(state.okHoldTimer);
        endDrag();
      } else if (state.scrollMode) {
        state.scrollMode = false;
        updateModeIndicator();
      } else {
        var focused = document.activeElement;
        if (focused && focused !== document.body && focused !== document.documentElement) {
          focused.blur();
        }
      }
      return;
    }

    if (key === 'ContextMenu' || key === 'Menu') {
      e.preventDefault();
      showCursorAuto();
      fireRightClickSequence(state.x, state.y);
      return;
    }

    if (key === 'MediaPlayPause' || key === ' ' && e.target === document.body) {
      e.preventDefault();
      state.scrollMode = !state.scrollMode;
      showCursorAuto();
      updateModeIndicator();
      return;
    }

    if (key === '+' || key === '=') {
      e.preventDefault();
      cycleSpeed(1);
      return;
    }

    if (key === '-' || key === '_') {
      e.preventDefault();
      cycleSpeed(-1);
      return;
    }
  }

  function handleKeyUp(e) {
    if (!state.enabled) return;

    var key = e.key;

    /* If user is typing in an input, don't interfere with keyup either */
    if (isTextEditingElement(document.activeElement)) {
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      state.pressedKeys[key] = false;
      delete state.keyHoldStart[key];
      return;
    }

    if (key === 'Enter' || key === 'OK' || key === 'Center') {
      state.pressedKeys['Enter'] = false;
      clearTimeout(state.okHoldTimer);

      if (state.isDragging) {
        endDrag();
        return;
      }

      var holdDuration = now() - state.okDownTime;
      if (holdDuration >= CONFIG.HOLD_THRESHOLD) return;

      var currentTime = now();
      var timeSinceLastClick = currentTime - state.lastClickTime;
      state.lastClickTime = currentTime;

      clearTimeout(state.clickSequenceTimer);

      if (timeSinceLastClick < CONFIG.DOUBLE_CLICK_THRESHOLD) {
        state.clickSequence++;
      } else {
        state.clickSequence = 1;
      }

      if (state.clickSequence === 1) {
        showCursorAuto();
        fireFullClickSequence(state.x, state.y, 1);
        state.clickSequenceTimer = setTimeout(function() {
          state.clickSequence = 0;
        }, CONFIG.TRIPLE_CLICK_THRESHOLD);
      } else if (state.clickSequence === 2) {
        /* Double click = toggle precision mode (fast speed) */
        state.precisionMode = !state.precisionMode;
        state.clickSequence = 0;
        showCursorAuto();
        updateModeIndicator();
        flashSpeedIndicator();
      } else if (state.clickSequence >= 3) {
        /* Triple click = fire actual double-click event for websites that need it */
        showCursorAuto();
        fireDoubleClickSequence(state.x, state.y);
        state.clickSequence = 0;
      }
      return;
    }
  }

  /* ------------------------------------------
     SPEED CONTROL
     ------------------------------------------ */
  function cycleSpeed(direction) {
    var speeds = ['slow', 'normal', 'fast'];
    var idx = speeds.indexOf(state.speed);
    if (idx === -1) idx = 1;
    idx += direction;
    if (idx < 0) idx = 0;
    if (idx >= speeds.length) idx = speeds.length - 1;
    state.speed = speeds[idx];
    flashSpeedIndicator();
  }

  /* ------------------------------------------
     ANIMATION LOOP
     ------------------------------------------ */
  function animationLoop(timestamp) {
    if (!state.enabled) {
      state.animating = false;
      return;
    }
    state.animating = true;

    if (!state.lastFrameTime) state.lastFrameTime = timestamp;
    var deltaMs = timestamp - state.lastFrameTime;
    if (deltaMs > 100) deltaMs = 16;
    state.lastFrameTime = timestamp;
    var dt = deltaMs / 16.667;

    var dx = 0;
    var dy = 0;

    if (state.pressedKeys['ArrowLeft']) dx -= 1;
    if (state.pressedKeys['ArrowRight']) dx += 1;
    if (state.pressedKeys['ArrowUp']) dy -= 1;
    if (state.pressedKeys['ArrowDown']) dy += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    if (dx !== 0 || dy !== 0) {
      if (state.scrollMode) {
        var scrollX = dx * CONFIG.HSCROLL_AMOUNT * dt;
        var scrollY = dy * CONFIG.SCROLL_AMOUNT * dt;
        handleScrollMovement(scrollX, scrollY);
      } else {
        var baseSpeed = getBaseSpeed();
        var maxHold = getMaxKeyHoldDuration();
        var accel = 1;
        if (maxHold > CONFIG.LONG_PRESS_START) {
          var progress = (maxHold - CONFIG.LONG_PRESS_START) / (CONFIG.EASING_ACCEL_RAMP - CONFIG.LONG_PRESS_START);
          if (progress > 1) progress = 1;
          accel = 1 + progress * CONFIG.LONG_PRESS_MAX_ACCEL;
        }

        var speed = baseSpeed * accel * dt;
        var newX = state.x + dx * speed;
        var newY = state.y + dy * speed;
        var vw = getViewportWidth();
        var vh = getViewportHeight();
        var edgeZone = CONFIG.EDGE_SCROLL_ZONE;

        /* Edge scrolling — triggers when cursor reaches viewport boundary */
        var scrollAmt = CONFIG.EDGE_SCROLL_AMOUNT * dt;
        var atTop = state.y <= edgeZone;
        var atBottom = state.y >= vh - 1 - edgeZone;
        var atLeft = state.x <= edgeZone;
        var atRight = state.x >= vw - 1 - edgeZone;

        if (dy < 0 && atTop) {
          scrollContainer(state.x, state.y, 0, -scrollAmt);
          newY = Math.max(newY, edgeZone);
        } else if (dy > 0 && atBottom) {
          scrollContainer(state.x, state.y, 0, scrollAmt);
          newY = Math.min(newY, vh - 1 - edgeZone);
        }

        if (dx < 0 && atLeft) {
          scrollContainer(state.x, state.y, -scrollAmt, 0);
          newX = Math.max(newX, edgeZone);
        } else if (dx > 0 && atRight) {
          scrollContainer(state.x, state.y, scrollAmt, 0);
          newX = Math.min(newX, vw - 1 - edgeZone);
        }

        state.x = clamp(newX, 0, vw - 1);
        state.y = clamp(newY, 0, vh - 1);

        if (state.isDragging) {
          updateDrag(state.x, state.y);
        }
      }
    }

    state.displayX += (state.x - state.displayX) * CONFIG.LERP_FACTOR;
    state.displayY += (state.y - state.displayY) * CONFIG.LERP_FACTOR;

    if (Math.abs(state.displayX - state.x) < 0.3) state.displayX = state.x;
    if (Math.abs(state.displayY - state.y) < 0.3) state.displayY = state.y;

    updateCursorPositionImmediate();

    if (!state.scrollMode && (dx !== 0 || dy !== 0 || Math.abs(state.x - state.displayX) > 0.5 || Math.abs(state.y - state.displayY) > 0.5)) {
      handleHover(Math.round(state.displayX), Math.round(state.displayY));
    } else if (dx === 0 && dy === 0) {
      handleHover(Math.round(state.displayX), Math.round(state.displayY));
    }

    state.rafId = requestAnimationFrame(animationLoop);
  }

  function startAnimation() {
    if (state.animating) return;
    state.animating = true;
    state.lastFrameTime = 0;
    state.rafId = requestAnimationFrame(animationLoop);
  }

  function stopAnimation() {
    state.animating = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  /* ------------------------------------------
     MUTATION OBSERVER
     ------------------------------------------ */
  function setupMutationObserver() {
    if (mutationObserver) return;
    try {
      mutationObserver = new MutationObserver(function() {
        if (state.enabled && state.visible) {
          handleHover(Math.round(state.displayX), Math.round(state.displayY));
        }
      });
      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'disabled', 'display']
      });
    } catch(e) { /* silent */ }
  }

  /* ------------------------------------------
     NESTED SCROLLABLE CONTAINER DETECTION
     ------------------------------------------ */
  function isScrollable(el) {
    if (!el || el === document.documentElement || el === document.body) return false;
    var cs = getComputedStyle(el);
    var oy = cs.overflowY;
    var ox = cs.overflowX;
    var scrollOY = (oy === 'auto' || oy === 'scroll' || oy === 'overlay' || oy === 'hidden');
    var scrollOX = (ox === 'auto' || ox === 'scroll' || ox === 'overlay' || ox === 'hidden');
    if (!scrollOY && !scrollOX) return false;
    /* Must have actual overflow content to scroll */
    var hasScrollY = el.scrollHeight > el.clientHeight + 1;
    var hasScrollX = el.scrollWidth > el.clientWidth + 1;
    if (!hasScrollY && !hasScrollX) return false;
    /* Check if element is visible (don't scroll hidden/offscreen containers) */
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    return true;
  }

  function scrollContainer(cx, cy, dx, dy) {
    var vh = getViewportHeight();
    var vw = getViewportWidth();

    /* Try multiple probe points: cursor position first, then progressively
       inward from the viewport edge to reach elements inside sidebars/menus */
    var probePoints = [[cx, cy]];
    /* Always add several inward probe points for better detection */
    var inwardSteps = [30, 70, 120, 180, 250, 350, 450];
    for (var s = 0; s < inwardSteps.length; s++) {
      var inset = inwardSteps[s];
      if (inset >= vw && inset >= vh) break;
      /* Vertical probes */
      if (dy !== 0) {
        if (dy < 0 && inset < vh) probePoints.push([cx, inset]);
        if (dy > 0 && vh - 1 - inset > 0) probePoints.push([cx, vh - 1 - inset]);
      }
      /* Horizontal probes */
      if (dx !== 0) {
        if (dx < 0 && inset < vw) probePoints.push([inset, cy]);
        if (dx > 0 && vw - 1 - inset > 0) probePoints.push([vw - 1 - inset, cy]);
      }
    }

    var scrolled = false;
    for (var p = 0; p < probePoints.length; p++) {
      var px = probePoints[p][0];
      var py = probePoints[p][1];
      if (px < 0 || py < 0 || px >= vw || py >= vh) continue;
      var target = document.elementFromPoint(px, py);
      if (!target) continue;
      /* Skip VM elements */
      if (target === cursorEl || target === hoverHighlight || target === modeIndicator || target === speedIndicator) continue;

      /* Walk up from the target to find the innermost scrollable ancestor */
      var el = target;
      while (el && el !== document.documentElement && el !== document.body) {
        if (isScrollable(el)) {
          if (dy !== 0) {
            if ((dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop < el.scrollHeight - el.clientHeight)) {
              el.scrollTop += dy;
              scrolled = true;
              break;
            }
          }
          if (dx !== 0) {
            if ((dx < 0 && el.scrollLeft > 0) || (dx > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth)) {
              el.scrollLeft += dx;
              scrolled = true;
              break;
            }
          }
        }
        el = el.parentElement;
      }
      if (scrolled) return;
    }

    /* Also try wheel event on the element under the cursor for JS-based sliders/carousels.
       Do NOT return here — always fall through to window.scrollBy as guaranteed fallback. */
    var wheelTarget = document.elementFromPoint(cx, cy);
    if (wheelTarget && wheelTarget !== document.body && wheelTarget !== document.documentElement) {
      dispatchWheelEvent(wheelTarget, cx, cy, dx * 12, dy * 12);
    }
    dispatchWheelEvent(document.documentElement, cx, cy, dx * 12, dy * 12);

    /* Always try window scroll as the final fallback for main page scrolling */
    if (dy !== 0) window.scrollBy({top: dy, left: 0, behavior: 'instant'});
    if (dx !== 0) window.scrollBy({top: 0, left: dx, behavior: 'instant'});
  }

  /* ------------------------------------------
     MOBILE WIDTH CHECK
     ------------------------------------------ */
  function checkMinWidth() {
    var wide = getViewportWidth() >= CONFIG.MIN_WIDTH;
    if (wide && !state.enabled) {
      VirtualMouse.enable();
    } else if (!wide && state.enabled) {
      VirtualMouse.disable();
      VirtualMouse.hide();
    }
  }

  /* ------------------------------------------
     WINDOW HANDLERS
     ------------------------------------------ */
  function handleResize() {
    checkMinWidth();
    state.x = clamp(state.x, 0, getViewportWidth() - 1);
    state.y = clamp(state.y, 0, getViewportHeight() - 1);
    state.displayX = state.x;
    state.displayY = state.y;
    updateCursorPositionImmediate();
    handleHover(Math.round(state.x), Math.round(state.y));
  }

  /* ------------------------------------------
     PUBLIC API
     ------------------------------------------ */
  var VirtualMouse = {
    enable: function() {
      if (state.enabled) return;
      state.enabled = true;
      state.visible = true;
      startAnimation();
      handleHover(Math.round(state.x), Math.round(state.y));
    },

    disable: function() {
      state.enabled = false;
      state.scrollMode = false;
      if (state.isDragging) endDrag();
      stopAnimation();
      hideCursorAuto();
      updateModeIndicator();
    },

    setSpeed: function(speed) {
      var valid = ['slow', 'normal', 'fast'];
      if (valid.indexOf(speed) === -1) return;
      state.speed = speed;
      flashSpeedIndicator();
    },

    show: function() {
      state.visible = true;
      showCursorAuto();
    },

    hide: function() {
      state.visible = false;
      hideCursorAuto();
    },

    click: function() {
      fireFullClickSequence(state.x, state.y, 1);
    },

    rightClick: function() {
      fireRightClickSequence(state.x, state.y);
    },

    doubleClick: function() {
      fireDoubleClickSequence(state.x, state.y);
    },

    scrollMode: function(forceState) {
      if (typeof forceState === 'boolean') {
        state.scrollMode = forceState;
      } else {
        state.scrollMode = !state.scrollMode;
      }
      updateModeIndicator();
      return state.scrollMode;
    },

    dragMode: function() {
      enterDragMode();
    },

    moveTo: function(x, y) {
      state.x = clamp(x, 0, getViewportWidth() - 1);
      state.y = clamp(y, 0, getViewportHeight() - 1);
      state.displayX = state.x;
      state.displayY = state.y;
      updateCursorPositionImmediate();
      handleHover(Math.round(state.x), Math.round(state.y));
    },

    getState: function() {
      return {
        x: Math.round(state.x),
        y: Math.round(state.y),
        speed: state.speed,
        precisionMode: state.precisionMode,
        scrollMode: state.scrollMode,
        isDragging: state.isDragging,
        enabled: state.enabled,
        visible: state.visible
      };
    }
  };

  /* ------------------------------------------
     EVENT LISTENER SETUP (guarded — runs once)
     ------------------------------------------ */
  var _listenersReady = false;

  function setupListeners() {
    if (_listenersReady) return;
    _listenersReady = true;
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('resize', handleResize, false);
    try {
      if (screen.orientation) {
        screen.orientation.addEventListener('change', handleResize);
      } else {
        window.addEventListener('orientationchange', handleResize, false);
      }
    } catch(e) {
      window.addEventListener('orientationchange', handleResize, false);
    }
    document.addEventListener('fullscreenchange', function() {
      setTimeout(handleResize, 100);
    }, false);
    document.addEventListener('webkitfullscreenchange', function() {
      setTimeout(handleResize, 100);
    }, false);
  }

  /* ------------------------------------------
     INITIALIZATION
     ------------------------------------------ */
  function init() {
    /* On narrow screens (mobile), do not activate */
    if (getViewportWidth() < CONFIG.MIN_WIDTH) {
      window.VirtualMouse = VirtualMouse;
      setupListeners();
      return;
    }

    createCursor();
    createHoverHighlight();
    createModeIndicator();
    createSpeedIndicator();

    /* Cursor starts hidden — shows only on arrow key press */
    if (cursorEl) cursorEl.classList.add('vm-cursor-hidden');

    setupListeners();

    setupMutationObserver();
    startAnimation();
    handleHover(Math.round(state.x), Math.round(state.y));

    window.VirtualMouse = VirtualMouse;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
