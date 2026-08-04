import { 
    signInAnonymously, 
    signInWithCustomToken, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { showToast } from "./ui.js";
import { VERIFIED_UIDS } from "./config.js";

let authInitialized = false;

export function updateGoogleProfileUI(user) {
    const loggedOutView = document.getElementById('google-logged-out-view');
    const loggedInView = document.getElementById('google-logged-in-view');
    const photoEl = document.getElementById('google-user-photo');
    const nameEl = document.getElementById('google-user-name');
    const emailEl = document.getElementById('google-user-email');
    const adminPortalBtn = document.getElementById('admin-portal-btn');

    const isGoogleUser = user && !user.isAnonymous && user.providerData && user.providerData.some(p => p.providerId === 'google.com');

    if (isGoogleUser) {
        if (loggedOutView) loggedOutView.classList.add('hidden');
        if (loggedInView) loggedInView.classList.remove('hidden');
        if (photoEl) photoEl.src = user.photoURL || './material/pinguVibeCode.png';
        if (nameEl) nameEl.innerText = user.displayName || 'Google User';
        if (emailEl) emailEl.innerText = user.email || '';

        if (adminPortalBtn) {
            const isVerified = VERIFIED_UIDS.length === 0 || VERIFIED_UIDS.includes(user.uid);
            adminPortalBtn.classList.toggle('hidden', !isVerified);
        }
    } else {
        if (loggedOutView) loggedOutView.classList.remove('hidden');
        if (loggedInView) loggedInView.classList.add('hidden');
        if (adminPortalBtn) adminPortalBtn.classList.add('hidden');
    }
}

export function initAuthObserver() {
    if (!auth) return;
    
    onAuthStateChanged(auth, (user) => {
        updateGoogleProfileUI(user);

        if (!user && !authInitialized) {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                signInWithCustomToken(auth, __initial_auth_token).catch(() => signInAnonymously(auth));
            } else {
                signInAnonymously(auth).catch((err) => console.warn("Anonymous auth fallback warning:", err));
            }
        }
        authInitialized = true;
    });
}

export async function signInWithGoogle() {
    if (!auth) {
        showToast("Firebase Authentication not initialized.");
        return;
    }
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.result?.user || result.user;
        if (user) {
            const googleName = user.displayName || user.email.split('@')[0];
            const nameEl = document.getElementById('login-user-name');
            
            if (nameEl && !nameEl.value.trim()) {
                nameEl.value = googleName;
            }
            
            updateGoogleProfileUI(user);
            showToast(`Authenticated as ${googleName}`);
        }
    } catch (err) {
        console.error("Google Auth error:", err);
        showToast(`Google Auth error: ${err.message || 'Failed'}`);
    }
}

export async function handleGoogleSignOut() {
    if (!auth) return;
    try {
        await signOut(auth);
        showToast("Signed out of Google account.");
        updateGoogleProfileUI(null);
        await signInAnonymously(auth);
    } catch (err) {
        console.error("Google Sign-Out error:", err);
        showToast(`Sign out error: ${err.message || 'Failed'}`);
    }
}

export function clearUserLocalSession() {
    localStorage.removeItem('dateMatch_savedUserName');
    localStorage.removeItem('dateMatch_rememberMe');
    
    const nameEl = document.getElementById('login-user-name');
    const remBox = document.getElementById('remember-me-checkbox');
    if (nameEl) nameEl.value = '';
    if (remBox) remBox.checked = false;

    showToast("Local user session & preferences cleared!");
}

export function ensureAuthenticated() {
    if (!auth) return Promise.resolve(false);
    if (auth.currentUser) {
        updateGoogleProfileUI(auth.currentUser);
        return Promise.resolve(true);
    }
    
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                unsubscribe();
                resolve(true);
            }
        });
    });
}