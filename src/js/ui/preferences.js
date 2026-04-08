const THEME_STORAGE_KEY = "dovie2fa:theme";
const DEFAULT_THEME = "dark";
const THEMES = new Set(["dark", "light"]);

function readStorage(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

function normalizeTheme(theme) {
  return THEMES.has(theme) ? theme : DEFAULT_THEME;
}

function applyTheme(theme) {
  const normalized = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", normalized);
  return normalized;
}

function renderThemeButton(theme) {
  const button = document.getElementById("themeToggleBtn");
  if (!button) {
    return;
  }

  const isDark = theme === "dark";
  const icon = button.querySelector(".theme-toggle-icon");
  if (icon) {
    icon.textContent = isDark ? "☀" : "🌙";
  }

  const label = isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
  button.setAttribute("aria-label", label);
  button.title = label;
}

export function initPreferences() {
  let currentTheme = applyTheme(readStorage(THEME_STORAGE_KEY));
  renderThemeButton(currentTheme);

  const button = document.getElementById("themeToggleBtn");
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    currentTheme = applyTheme(currentTheme);
    writeStorage(THEME_STORAGE_KEY, currentTheme);
    renderThemeButton(currentTheme);
  });
}
