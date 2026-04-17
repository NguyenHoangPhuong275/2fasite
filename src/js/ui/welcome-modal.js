const LEGACY_WELCOME_HIDE_KEY = "dovieshop:welcome-hidden-until";
const WELCOME_HIDE_KEY = "dovieshop:welcome-hide-optin-until-v2";
const WELCOME_HIDE_DURATION_MS = 24 * 60 * 60 * 1000;
const WELCOME_OPEN_DELAY_MS = 180;

function getHiddenUntilTimestamp() {
  try {
    const raw = localStorage.getItem(WELCOME_HIDE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function suppressWelcomeFor24Hours() {
  try {
    const hiddenUntil = Date.now() + WELCOME_HIDE_DURATION_MS;
    localStorage.setItem(WELCOME_HIDE_KEY, String(hiddenUntil));
  } catch {
  }
}

function shouldShowWelcomeModal() {
  return Date.now() >= getHiddenUntilTimestamp();
}

function clearLegacyAutoHideKey() {
  try {
    localStorage.removeItem(LEGACY_WELCOME_HIDE_KEY);
  } catch {
  }
}

export function initWelcomeModal() {
  const modal = document.getElementById("welcomeModal");
  const closeX = document.getElementById("closeWelcomeModalX");
  const hide24hCheckbox = document.getElementById("welcomeHide24h");

  clearLegacyAutoHideKey();

  if (!modal || !shouldShowWelcomeModal()) return;

  setTimeout(() => {
    requestAnimationFrame(() => {
      modal.classList.add("active");
    });
  }, WELCOME_OPEN_DELAY_MS);

  const closeModal = () => {
    modal.classList.remove("active");
    if (hide24hCheckbox?.checked) {
      suppressWelcomeFor24Hours();
    }
  };

  if (closeX) closeX.addEventListener("click", closeModal);

  const groupButtons = modal.querySelectorAll(".welcome-group-btn");
  groupButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (hide24hCheckbox?.checked) {
        suppressWelcomeFor24Hours();
      }
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}
