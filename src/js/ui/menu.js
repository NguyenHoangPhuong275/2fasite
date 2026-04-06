export function initMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const siteNav = document.getElementById("siteNav");

  if (!menuToggle || !siteNav) {
    return;
  }

  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    siteNav.classList.toggle("active");
  });

  document.addEventListener("click", (event) => {
    if (!siteNav.contains(event.target) && event.target !== menuToggle) {
      siteNav.classList.remove("active");
    }
  });

  const navLinks = siteNav.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("active");
    });
  });
}
