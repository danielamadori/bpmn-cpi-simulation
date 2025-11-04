(function() {
  var toggle;
  var theme = localStorage.getItem('theme') || 'light';

  function applyTheme(newTheme) {
    document.documentElement.classList.toggle('dark-mode', newTheme === 'dark');

    var bpmnjs = window.bpmnjs;

    if (bpmnjs) {
      try {
        var themeService = bpmnjs.get('theme');
        themeService.setTheme(newTheme);
      } catch (err) {

        // theming module not available
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

