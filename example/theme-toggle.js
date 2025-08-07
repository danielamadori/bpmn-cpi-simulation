(function() {
  var toggle;
  var theme = localStorage.getItem('theme') || 'light';

  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');

    if (toggle) {
      toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
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

