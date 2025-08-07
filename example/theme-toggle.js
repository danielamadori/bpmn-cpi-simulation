window.addEventListener('DOMContentLoaded', function() {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) {
    return;
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  var saved = localStorage.getItem('theme') || 'light';
  applyTheme(saved);

  toggle.addEventListener('click', function() {
    var next = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });
});
