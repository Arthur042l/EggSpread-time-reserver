import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { auth } from "./firebase.js";
import * as UI from "./ui.js";
import * as Admin from "./admin.js";

// Expose functions globally for admin.html inline event attributes
window.showToast = UI.showToast;

window.signInWithGoogleAdmin = Admin.signInWithGoogleAdmin;
window.handleAdminSignOut = Admin.handleAdminSignOut;
window.enterDashboard = Admin.enterDashboard;
window.filterEvents = Admin.filterEvents;
window.openInspectModal = Admin.openInspectModal;
window.closeInspectModal = Admin.closeInspectModal;
window.handleAdminUpdateEvent = Admin.handleAdminUpdateEvent;
window.triggerDeleteEvent = Admin.triggerDeleteEvent;
window.closeConfirmDeleteModal = Admin.closeConfirmDeleteModal;
window.exportSingleEventJSON = Admin.exportSingleEventJSON;
window.exportAllDatabaseJSON = Admin.exportAllDatabaseJSON;

// Admin Portal initialization
window.onload = function() {
    UI.refreshLucideIcons();
    
    onAuthStateChanged(auth, (user) => {
        Admin.updateAdminAuthUI(user);
    });
};