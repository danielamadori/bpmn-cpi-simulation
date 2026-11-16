(function() {
  var MIN_WIDTH = 300;
  var CANVAS_OFFSET = 50;

  var root = document.documentElement;
  var resizer = document.getElementById('sidebar-resizer');
  var toggleBtn = document.getElementById('sidebar-toggle');

  if (!resizer || !toggleBtn) {
    return;
  }

  function getMaxWidth() {
    return Math.max(MIN_WIDTH, Math.floor(window.innerWidth / 2) - CANVAS_OFFSET);
  }

  function clampWidth(width) {
    return Math.min(getMaxWidth(), Math.max(MIN_WIDTH, Math.round(width)));
  }

  function setSidebarWidth(width) {
    root.style.setProperty('--sidebar-width', clampWidth(width) + 'px');
  }

  function notifyCanvasResize() {
    if (window.bpmnjs) {
      try {
        window.bpmnjs.get('canvas').resized();
      } catch (err) {
        // canvas service not ready
      }
    }
    window.dispatchEvent(new Event('resize'));
  }

  function updateToggleUI(collapsed) {
    toggleBtn.textContent = collapsed ? '\u203A' : '\u2039';
    toggleBtn.title = collapsed ? 'Show sidebar' : 'Hide sidebar';
    toggleBtn.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  setSidebarWidth(MIN_WIDTH);
  updateToggleUI(false);

  toggleBtn.addEventListener('click', function() {
    var willCollapse = !document.body.classList.contains('sidebar-collapsed');

    if (willCollapse) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
      setSidebarWidth(MIN_WIDTH);
    }

    updateToggleUI(willCollapse);
    notifyCanvasResize();
  });

  var isDragging = false;

  resizer.addEventListener('mousedown', function(event) {
    if (document.body.classList.contains('sidebar-collapsed')) {
      return;
    }

    event.preventDefault();
    isDragging = true;
    document.body.classList.add('sidebar-resizing');
  });

  document.addEventListener('mousemove', function(event) {
    if (!isDragging) {
      return;
    }

    setSidebarWidth(event.clientX - 38);
    notifyCanvasResize();
  });

  document.addEventListener('mouseup', function() {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    document.body.classList.remove('sidebar-resizing');
    notifyCanvasResize();
  });

  window.addEventListener('resize', function() {
    if (document.body.classList.contains('sidebar-collapsed')) {
      return;
    }

    var current = parseInt(getComputedStyle(root).getPropertyValue('--sidebar-width'), 10);
    if (!isNaN(current)) {
      var clamped = clampWidth(current);
      if (clamped !== current) {
        root.style.setProperty('--sidebar-width', clamped + 'px');
      }
    }
  });
})();
