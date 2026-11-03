(() => {
  const key = 'jjal-card-studio-theme';
  let theme = 'dark';
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch { /* A blocked preference store must not stop the editor. */ }

  function apply(next) {
    theme = next === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
  }

  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    apply(theme);
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => {
        apply(button.dataset.themeChoice);
        try { localStorage.setItem(key, theme); } catch { /* Keep the current view usable. */ }
        document.getElementById('theme-status').textContent = theme === 'light' ? '화이트 모드로 변경했습니다.' : '다크 모드로 변경했습니다.';
      });
    });
    window.addEventListener('storage', event => {
      if (event.key === key) apply(event.newValue);
    });
  });
})();
