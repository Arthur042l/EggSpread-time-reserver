import * as UI from "./ui.js";
import * as Auth from "./auth.js";
import * as Calendar from "./calendar.js";
import * as Localize from "./localize/dictionary.js";

// Expose functions globally for index.html inline event attributes
window.showToast = UI.showToast;
window.toggleSettingsModal = UI.toggleSettingsModal;
window.toggleAppInfoModal = UI.toggleAppInfoModal;
window.closeDateDetailModal = UI.closeDateDetailModal;

window.signInWithGoogle = Auth.signInWithGoogle;
window.handleGoogleSignOut = Auth.handleGoogleSignOut;
window.clearUserLocalSession = Auth.clearUserLocalSession;

window.setAuthMode = Calendar.setAuthMode;
window.handleLoginSubmit = Calendar.handleLoginSubmit;
window.logout = Calendar.logout;
window.navigate = Calendar.navigate;
window.changeCalMonth = Calendar.changeCalMonth;
window.resetCalToToday = Calendar.resetCalToToday;
window.toggleDateSelection = Calendar.toggleDateSelection;
window.submitFreeDays = Calendar.submitFreeDays;
window.openDateDetailModal = Calendar.openDateDetailModal;
window.handleSaveSettings = Calendar.handleSaveSettings;
window.clearEventResponses = Calendar.clearEventResponses;
window.exportEventJSON = Calendar.exportEventJSON;
window.triggerImportJSON = Calendar.triggerImportJSON;
window.importEventJSON = Calendar.importEventJSON;

// Expose language change function globally
window.changeAppLanguage = function(lang) {
    Localize.setAppLanguage(lang);
    Calendar.renderCurrentPage();
};

// App initialization on window load
window.onload = function() {
    Localize.initLanguage();

    UI.refreshLucideIcons();
    UI.checkDeviceMode();
    UI.initResizeListener(() => Calendar.renderCurrentPage());

    const remBox = document.getElementById('remember-me-checkbox');
    const isRemembered = localStorage.getItem('dateMatch_rememberMe') === 'true';
    const savedName = localStorage.getItem('dateMatch_savedUserName');

    if (remBox) remBox.checked = isRemembered;

    if (isRemembered && savedName) {
        const nameEl = document.getElementById('login-user-name');
        if (nameEl) nameEl.value = savedName;
    }

    Auth.initAuthObserver();
    Calendar.navigate('login');
};