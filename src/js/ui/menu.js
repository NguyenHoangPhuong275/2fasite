export function initMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const siteNav = document.getElementById("siteNav");

  if (!siteNav) {
    return;
  }

  const closeMenu = () => {
    siteNav.classList.remove("active");
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", "false");
    }
  };

  const openMenu = () => {
    siteNav.classList.add("active");
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", "true");
    }
  };

  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "false");

    menuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (siteNav.classList.contains("active")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (!siteNav.contains(event.target) && !menuToggle.contains(event.target)) {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      closeMenu();
    });
  }

  const navLinks = siteNav.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });
}
