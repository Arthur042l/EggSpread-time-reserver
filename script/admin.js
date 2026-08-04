import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { appId, VERIFIED_UIDS } from "./config.js";
import { showToast, refreshLucideIcons } from "./ui.js";

let allEventsMap = {};
let activeInspectCode = null;

export function isVerifiedAdmin(user) {
    if (!user || user.isAnonymous) return false;
    const isGoogleUser = user.providerData && user.providerData.some(p => p.providerId === 'google.com');
    if (!isGoogleUser) return false;

    if (VERIFIED_UIDS.length > 0) {
        return VERIFIED_UIDS.includes(user.uid);
    }
    return true;
}

export function updateAdminAuthUI(user) {
    const loggedOutUI = document.getElementById('login-logged-out-view');
    const loggedInUI = document.getElementById('login-logged-in-view');
    const photoEl = document.getElementById('admin-user-photo');
    const nameEl = document.getElementById('admin-user-name');
    const emailEl = document.getElementById('admin-user-email');
    const uidEl = document.getElementById('admin-user-uid');
    const badgeEl = document.getElementById('admin-access-badge');
    const deniedBanner = document.getElementById('admin-denied-banner');
    const enterBtn = document.getElementById('enter-dashboard-btn');

    const isGoogleUser = user && !user.isAnonymous && user.providerData && user.providerData.some(p => p.providerId === 'google.com');

    if (isGoogleUser) {
        if (loggedOutUI) loggedOutUI.classList.add('hidden');
        if (loggedInUI) loggedInUI.classList.remove('hidden');
        if (photoEl) photoEl.src = user.photoURL || './material/pinguVibeCode.png';
        if (nameEl) nameEl.innerText = user.displayName || 'Google User';
        if (emailEl) emailEl.innerText = user.email || '';
        if (uidEl) uidEl.innerText = user.uid || '--';

        const isVerified = isVerifiedAdmin(user);

        if (badgeEl) {
            badgeEl.innerText = isVerified ? 'Verified Admin ✓' : 'Unauthorized ✗';
            badgeEl.className = isVerified 
                ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300';
        }

        if (deniedBanner) deniedBanner.classList.toggle('hidden', isVerified);
        if (enterBtn) enterBtn.disabled = !isVerified;
    } else {
        if (loggedOutUI) loggedOutUI.classList.remove('hidden');
        if (loggedInUI) loggedInUI.classList.add('hidden');
        if (deniedBanner) deniedBanner.classList.add('hidden');
    }
}

export async function signInWithGoogleAdmin() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        if (result.user) {
            showToast(`Signed in as ${result.user.displayName || result.user.email}`);
            updateAdminAuthUI(result.user);
        }
    } catch (err) {
        console.error("Google Auth Error:", err);
        showToast(`Sign in error: ${err.message}`);
    }
}

export async function handleAdminSignOut() {
    try {
        await signOut(auth);
        showToast("Signed out.");
        updateAdminAuthUI(null);
        document.getElementById('admin-login-screen').classList.remove('hidden');
        document.getElementById('admin-dashboard-container').classList.add('hidden');
    } catch (err) {
        console.error("Sign Out Error:", err);
    }
}

export function enterDashboard() {
    if (!isVerifiedAdmin(auth.currentUser)) {
        showToast("Access Restricted: Google Account UID not authorized.");
        return;
    }
    document.getElementById('admin-login-screen').classList.add('hidden');
    document.getElementById('admin-dashboard-container').classList.remove('hidden');
    initRealtimeEvents();
}

export function initRealtimeEvents() {
    if (!isVerifiedAdmin(auth.currentUser)) return;

    const eventsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');

    onSnapshot(eventsColRef, (snapshot) => {
        allEventsMap = {};
        snapshot.forEach(docSnap => {
            allEventsMap[docSnap.id] = docSnap.data();
        });
        renderAdminDashboard();
    }, (error) => {
        console.error("Firestore Snapshot Error:", error);
        showToast("Failed to load events from database.");
    });
}

function renderAdminDashboard() {
    const keys = Object.keys(allEventsMap);
    let totalResponders = 0;
    let totalGoal = 0;

    keys.forEach(k => {
        const ev = allEventsMap[k];
        totalResponders += Object.keys(ev.responses || {}).length;
        totalGoal += (ev.groupSize || 5);
    });

    document.getElementById('stat-total-events').innerText = keys.length;
    document.getElementById('stat-total-responders').innerText = totalResponders;
    document.getElementById('stat-avg-goal').innerText = keys.length ? Math.round(totalGoal / keys.length) : 0;

    filterEvents();
    refreshLucideIcons();
}

export function filterEvents() {
    const query = (document.getElementById('admin-search-input')?.value || '').trim().toLowerCase();
    const container = document.getElementById('events-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const filteredKeys = Object.keys(allEventsMap).filter(k => {
        const ev = allEventsMap[k];
        const name = (ev.name || '').toLowerCase();
        const code = (ev.code || k).toLowerCase();
        return name.includes(query) || code.includes(query);
    });

    if (filteredKeys.length === 0) {
        container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs font-medium italic">No matching events found.</div>`;
        return;
    }

    filteredKeys.forEach(k => {
        const ev = allEventsMap[k];
        const responses = ev.responses || {};
        const responderCount = Object.keys(responses).length;
        const groupGoal = ev.groupSize || 5;

        const card = document.createElement('div');
        card.className = "bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-xl border border-white/50 space-y-4 flex flex-col justify-between";
        
        card.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <h3 class="font-black text-base text-slate-900 line-clamp-1">${ev.name || 'Untitled Event'}</h3>
                        <p class="text-[11px] text-slate-500 mt-0.5">Expected: <strong class="text-slate-800">${groupGoal}</strong></p>
                    </div>
                    <span class="text-xs font-mono font-bold bg-teal-100 text-teal-800 px-2.5 py-1 rounded-xl border border-teal-200">
                        ${ev.code || k}
                    </span>
                </div>

                <div class="p-3 bg-slate-50 border rounded-2xl space-y-1">
                    <div class="flex justify-between text-xs font-semibold">
                        <span class="text-slate-600">Submissions</span>
                        <span class="text-teal-600 font-bold">${responderCount} / ${groupGoal}</span>
                    </div>
                    <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-teal-500 h-full rounded-full" style="width: ${Math.min(100, Math.round((responderCount / groupGoal) * 100))}%"></div>
                    </div>
                </div>
            </div>

            <div class="pt-2 border-t flex items-center justify-between gap-2">
                <button onclick="openInspectModal('${ev.code || k}')" class="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs rounded-xl border border-teal-200 transition-all flex items-center gap-1 cursor-pointer">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i> Inspect
                </button>
                <button onclick="exportSingleEventJSON('${ev.code || k}')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border transition-all flex items-center gap-1 cursor-pointer">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i> JSON
                </button>
                <button onclick="triggerDeleteEvent('${ev.code || k}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 transition-all flex items-center gap-1 cursor-pointer">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    refreshLucideIcons();
}

export function openInspectModal(code) {
    const ev = allEventsMap[code];
    if (!ev) return;

    activeInspectCode = code;
    document.getElementById('inspect-event-name').innerText = ev.name || code;
    document.getElementById('inspect-event-code').innerText = ev.code || code;
    document.getElementById('inspect-edit-name').value = ev.name || '';
    document.getElementById('inspect-edit-goal').value = ev.groupSize || 5;

    const responses = ev.responses || {};
    const members = Object.keys(responses);
    document.getElementById('inspect-member-count').innerText = members.length;

    const listContainer = document.getElementById('inspect-members-list');
    listContainer.innerHTML = '';

    if (members.length === 0) {
        listContainer.innerHTML = `<p class="text-xs text-slate-400 italic py-3 text-center">No member responses submitted yet.</p>`;
    } else {
        members.forEach(m => {
            const dates = responses[m] || [];
            const div = document.createElement('div');
            div.className = "p-2.5 bg-slate-50 border rounded-xl flex items-center justify-between text-xs";
            div.innerHTML = `
                <span class="font-bold text-slate-800">${m}</span>
                <span class="font-mono text-teal-600 font-bold px-2 py-0.5 bg-teal-50 rounded-md border">${dates.length} days free</span>
            `;
            listContainer.appendChild(div);
        });
    }

    document.getElementById('inspect-delete-btn').onclick = () => triggerDeleteEvent(code);
    document.getElementById('event-inspect-modal').classList.remove('hidden');
}

export function closeInspectModal() {
    document.getElementById('event-inspect-modal').classList.add('hidden');
}

export async function handleAdminUpdateEvent(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!isVerifiedAdmin(auth.currentUser)) {
        showToast("Unauthorized operation.");
        return false;
    }
    if (!activeInspectCode || !allEventsMap[activeInspectCode]) return false;

    const newName = document.getElementById('inspect-edit-name').value.trim();
    const newGoal = parseInt(document.getElementById('inspect-edit-goal').value, 10);

    if (!newName || isNaN(newGoal)) return false;

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', activeInspectCode);
    await setDoc(docRef, {
        ...allEventsMap[activeInspectCode],
        name: newName,
        groupSize: newGoal
    }, { merge: true });

    showToast(`Updated event ${activeInspectCode} successfully.`);
    closeInspectModal();
    return false;
}

export function triggerDeleteEvent(code) {
    if (!isVerifiedAdmin(auth.currentUser)) {
        showToast("Unauthorized operation.");
        return;
    }
    activeInspectCode = code;
    document.getElementById('delete-event-code-display').innerText = code;
    document.getElementById('confirm-delete-submit-btn').onclick = () => executeDeleteEvent(code);
    document.getElementById('confirm-delete-modal').classList.remove('hidden');
}

export function closeConfirmDeleteModal() {
    document.getElementById('confirm-delete-modal').classList.add('hidden');
}

async function executeDeleteEvent(code) {
    if (!isVerifiedAdmin(auth.currentUser)) {
        showToast("Unauthorized operation.");
        return;
    }
    try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', code);
        await deleteDoc(docRef);
        showToast(`Deleted event ${code} from database.`);
        closeConfirmDeleteModal();
        closeInspectModal();
    } catch (err) {
        console.error("Delete Error:", err);
        showToast("Failed to delete event.");
    }
}

export function exportSingleEventJSON(code) {
    const ev = allEventsMap[code];
    if (!ev) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ [code]: ev }, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `DateMatch_Admin_Export_${code}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

export function exportAllDatabaseJSON() {
    if (!isVerifiedAdmin(auth.currentUser)) {
        showToast("Unauthorized operation.");
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allEventsMap, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `DateMatch_Full_Database_Backup.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast("Full database backup exported!");
}