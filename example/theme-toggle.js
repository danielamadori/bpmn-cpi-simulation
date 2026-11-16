(function() {
  var toggle;
  var theme = localStorage.getItem('theme') || 'light';

  function applyTheme(newTheme) {
    document.documentElement.classList.toggle('dark-mode', newTheme === 'dark');

    var bpmnjs = window.bpmnjs;

    if (bpmnjs) {

      // No module of this modeller registers a 'theme' service today, so its
      // absence is the expected case: get(name, false) answers undefined for
      // a service nobody registered (diagram-js's injector, didi), and the
      // absence is asked for that way. The catch this replaces read every
      // error as «theming module not available», setTheme's own included.
      var themeService = bpmnjs.get('theme', false);

      if (themeService !== undefined) {
        themeService.setTheme(newTheme);
      }
    }

    if (toggle) {
      toggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
      toggle.setAttribute('aria-label', newTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  applyTheme(theme);

  function init() {
    toggle = document.getElementById('theme-toggle');

    if (!toggle) {
      return;
    }

    applyTheme(theme);

    toggle.addEventListener('click', function() {
      theme = document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark';

      localStorage.setItem('theme', theme);

      applyTheme(theme);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

