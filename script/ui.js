// UI Utilities, Toast Notifications, and Device Layout Handlers

export function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  const msgEl = document.getElementById("toast-msg");
  if (msgEl) msgEl.innerText = msg;

  toast.classList.remove("translate-y-16", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-16", "opacity-0");
  }, 3500);
}

export function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

let isCompactMode = window.innerWidth < 768;
let lastViewportWidth = window.innerWidth;

export function checkDeviceMode() {
  isCompactMode = window.innerWidth < 768;
  if (document.body) {
    document.body.classList.toggle("mode-compact", isCompactMode);
    document.body.classList.toggle("mode-wide", !isCompactMode);
  }
  return isCompactMode;
}

export function getIsCompactMode() {
  return isCompactMode;
}

export function initResizeListener(onModeChange) {
  window.addEventListener("resize", () => {
    if (Math.abs(window.innerWidth - lastViewportWidth) > 20) {
      lastViewportWidth = window.innerWidth;
      const wasCompact = isCompactMode;
      checkDeviceMode();
      if (wasCompact !== isCompactMode && typeof onModeChange === "function") {
        onModeChange();
      }
    }
  });
}

export function toggleSettingsModal(show) {
  const modal = document.getElementById("settings-modal");
  if (modal) {
    modal.classList.toggle("hidden", !show);
    if (show) refreshLucideIcons();
  }
}

export function toggleAppInfoModal(show) {
  const modal = document.getElementById("app-info-modal");
  if (modal) {
    modal.classList.toggle("hidden", !show);
    if (show) refreshLucideIcons();
  }
}

export function closeDateDetailModal() {
  const modal = document.getElementById("date-detail-modal");
  if (modal) modal.classList.add("hidden");
}
