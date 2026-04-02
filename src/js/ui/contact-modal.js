export function initContactModal() {
  const contactBtn = document.getElementById("contactBtn");
  const contactModal = document.getElementById("contactModal");
  const closeContactBtn = document.getElementById("closeContactBtn");

  if (!contactBtn || !contactModal || !closeContactBtn) {
    return;
  }

  function openModal() {
    contactModal.classList.add("active");
  }

  function closeModal() {
    contactModal.classList.remove("active");
  }

  contactBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  closeContactBtn.addEventListener("click", () => {
    closeModal();
  });

  contactModal.addEventListener("click", (event) => {
    if (event.target === contactModal) {
      closeModal();
    }
  });
}