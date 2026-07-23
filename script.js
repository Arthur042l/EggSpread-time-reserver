import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Safe Firebase Initialization
let app = null;
let auth = null;
let db = null;
let authPromise = null;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase
try {
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
        apiKey: "AIzaSyDm0L6F6CGmrbsESTMLhOek74a5ttySP04",
        authDomain: "eggspread-time-reserver.firebaseapp.com",
        projectId: "eggspread-time-reserver",
        storageBucket: "eggspread-time-reserver.firebasestorage.app",
        messagingSenderId: "792367749553",
        appId: "1:792367749553:web:365c504ae65ccc7fcf4590",
        measurementId: "G-LLG556KH52"
    };

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (err) {
    console.warn("Firebase initialization warning:", err);
}

// Automatic Device Mode Detection (Compact vs Wide)
let isCompactMode = window.innerWidth < 768;

function checkDeviceMode() {
    isCompactMode = window.innerWidth < 768;
    if (document.body) {
        document.body.classList.toggle('mode-compact', isCompactMode);
        document.body.classList.toggle('mode-wide', !isCompactMode);
    }
}

window.addEventListener('resize', () => {
    const wasCompact = isCompactMode;
    checkDeviceMode();
    if (wasCompact !== isCompactMode) {
        renderCurrentPage();
    }
});

// Authenticate with Firebase before Firestore operations
async function initAuth() {
    if (!auth) return false;
    if (auth.currentUser) return true;

    if (!authPromise) {
        authPromise = (async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
                return true;
            } catch (e) {
                console.warn("Cloud Auth Notice: Operating in local mode.", e);
                return false;
            }
        })();
    }
    return await authPromise;
}

// Default Fallback Template for local preview testing
const DEFAULT_EVENT_TEMPLATE = {
    "BBQ2026": {
        name: "Weekend BBQ Party",
        code: "BBQ2026",
        groupSize: 4,
        responses: {
            "Alex": ["2026-08-08", "2026-08-09", "2026-08-15", "2026-08-16", "2026-08-22"],
            "Chris": ["2026-08-08", "2026-08-15", "2026-08-16", "2026-08-23"],
            "Sam": ["2026-08-08", "2026-08-09", "2026-08-15", "2026-08-16", "2026-08-29"],
            "Taylor": ["2026-08-08", "2026-08-15", "2026-08-16"]
        }
    },
    "CAMP2026": {
        name: "Summer Camp 2026",
        code: "CAMP2026",
        groupSize: 3,
        responses: {
            "Sam": ["2026-08-10", "2026-08-11", "2026-08-12"]
        }
    }
};

// In-Memory App State
let activeEventData = null;
let currentSecretCode = null;
let currentUserName = null;
let mySelectedDates = new Set(); 
let submittedDates = new Set();  
let calCurrentDate = new Date(2026, 7, 1);
let eventUnsubscribe = null;
let isRegisterMode = false;

// Real-time Firestore Listener
async function listenToCloudEvent(code) {
    if (eventUnsubscribe) eventUnsubscribe();

    const isAuthenticated = await initAuth();
    if (!isAuthenticated || !db) {
        if (!activeEventData) {
            activeEventData = DEFAULT_EVENT_TEMPLATE[code] || {
                name: `${code} Event`,
                code: code,
                groupSize: 5,
                responses: {}
            };
        }
        updateUserStateFromActiveData();
        renderCurrentPage();
        return;
    }

    try {
        const eventDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', code);
        
        eventUnsubscribe = onSnapshot(eventDocRef, (docSnap) => {
            if (docSnap.exists()) {
                activeEventData = docSnap.data();
            } else if (!activeEventData) {
                const initialData = DEFAULT_EVENT_TEMPLATE[code] || {
                    name: `${code} Event`,
                    code: code,
                    groupSize: 5,
                    responses: {}
                };
                activeEventData = initialData;
            }

            updateUserStateFromActiveData();
            renderCurrentPage();
        }, (error) => {
            console.warn("Firestore snapshot error:", error);
        });
    } catch (err) {
        console.warn("Unable to attach Cloud listener:", err);
    }
}

function updateUserStateFromActiveData() {
    if (activeEventData && activeEventData.responses && activeEventData.responses[currentUserName]) {
        const cloudDates = activeEventData.responses[currentUserName] || [];
        submittedDates = new Set(cloudDates);
        if (mySelectedDates.size === 0) {
            mySelectedDates = new Set(cloudDates);
        }
    }
}

// Sync Event Data to Firestore Cloud
async function syncEventToCloud(code, updatedEventData) {
    activeEventData = updatedEventData;
    renderCurrentPage();

    const isAuthenticated = await initAuth();
    if (!isAuthenticated || !db || !code) return;

    try {
        const eventDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', code);
        await setDoc(eventDocRef, updatedEventData, { merge: true });
    } catch (e) {
        console.error("Firestore cloud sync failed:", e);
    }
}

// Show / Hide Sample Codes Toggle
window.toggleSampleCodes = function() {
    const box = document.getElementById('sample-codes-box');
    const text = document.getElementById('sample-code-toggle-text');
    const icon = document.getElementById('sample-code-icon');

    if (box) {
        const isHidden = box.classList.contains('hidden');
        box.classList.toggle('hidden', !isHidden);
        box.classList.toggle('flex', isHidden);
        if (text) text.innerText = isHidden ? 'Hide Sample Codes' : 'Show Sample Codes';
        if (icon && window.lucide) {
            icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
            window.lucide.createIcons();
        }
    }
};

window.quickFill = function(code, name) {
    const codeEl = document.getElementById('login-secret-code');
    const nameEl = document.getElementById('login-user-name');
    if (codeEl) codeEl.value = code;
    if (nameEl) nameEl.value = name;
};

// Handle Login with Strict Single-Time Registration & Remember Name Only
window.handleLoginSubmit = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const codeInput = document.getElementById('login-secret-code').value.trim().toUpperCase();
    const nameInput = document.getElementById('login-user-name').value.trim();
    const rememberMe = document.getElementById('remember-me-checkbox')?.checked;

    if (!codeInput || !nameInput) return false;

    // REMEMBER ME: Only save user's Name in LocalStorage
    if (rememberMe) {
        localStorage.setItem('dateMatch_savedUserName', nameInput);
    } else {
        localStorage.removeItem('dateMatch_savedUserName');
    }

    currentSecretCode = codeInput;
    currentUserName = nameInput;

    const isAuthenticated = await initAuth();

    // Check if event code exists in Firestore or local defaults
    let exists = false;
    if (DEFAULT_EVENT_TEMPLATE[currentSecretCode]) {
        exists = true;
    } else if (isAuthenticated && db) {
        try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', currentSecretCode);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) exists = true;
        } catch (err) {
            console.warn("Doc check error:", err);
        }
    }

    // LOGIN MODE: Event must exist
    if (!isRegisterMode) {
        if (!exists) {
            // Event does not exist -> Automatically switch UI to Register Mode
            isRegisterMode = true;
            const regFields = document.getElementById('register-extra-fields');
            const submitText = document.getElementById('login-submit-btn-text');
            const desc = document.getElementById('login-subtitle-desc');

            if (regFields) regFields.classList.remove('hidden');
            if (submitText) submitText.innerText = 'Register & Join Event';
            if (desc) desc.innerText = 'Complete event details below to register!';

            window.showToast("Event code not found. Complete registration below!");
            return false;
        }
    } else {
        // REGISTER MODE: Check if event ALREADY exists to prevent re-registration
        if (exists) {
            window.showToast("This event code already exists! Logging in directly.");
            isRegisterMode = false;
            const regFields = document.getElementById('register-extra-fields');
            if (regFields) regFields.classList.add('hidden');
        } else {
            // Brand-new registration: save directly to Firestore
            const eventNameInput = document.getElementById('register-event-name')?.value.trim() || `${currentSecretCode} Event`;
            const groupSizeInput = parseInt(document.getElementById('register-group-size')?.value, 10) || 5;

            const newEventObj = {
                name: eventNameInput,
                code: currentSecretCode,
                groupSize: groupSizeInput,
                responses: {}
            };

            await syncEventToCloud(currentSecretCode, newEventObj);
            window.showToast(`Event "${eventNameInput}" created on Cloud! 🎉`);
        }
    }

    mySelectedDates.clear();
    submittedDates.clear();
    await listenToCloudEvent(currentSecretCode);

    document.getElementById('user-avatar-initial').innerText = currentUserName.charAt(0).toUpperCase();
    document.getElementById('user-name-display').innerText = currentUserName;
    document.getElementById('user-info-pill').classList.remove('hidden');
    document.getElementById('user-info-pill').classList.add('flex');
    document.getElementById('header-event-badge').innerText = currentSecretCode;

    window.navigate('calendar');
    window.showToast(`Welcome, ${currentUserName}!`);
    return false;
};

window.logout = function() {
    if (eventUnsubscribe) eventUnsubscribe();
    currentSecretCode = null;
    currentUserName = null;
    activeEventData = null;
    isRegisterMode = false;
    mySelectedDates.clear();
    submittedDates.clear();

    const regFields = document.getElementById('register-extra-fields');
    const submitText = document.getElementById('login-submit-btn-text');
    const desc = document.getElementById('login-subtitle-desc');
    if (regFields) regFields.classList.add('hidden');
    if (submitText) submitText.innerText = 'Enter Event Calendar';
    if (desc) desc.innerText = 'Enter your event secret code to log in';

    document.getElementById('user-info-pill').classList.add('hidden');
    document.getElementById('user-info-pill').classList.remove('flex');
    window.navigate('login');
};

let activePage = 'login';
window.navigate = function(page) {
    if (page !== 'login' && (!currentSecretCode || !currentUserName)) {
        page = 'login';
    }
    activePage = page;

    document.getElementById('page-login').classList.toggle('hidden', page !== 'login');
    document.getElementById('page-calendar').classList.toggle('hidden', page !== 'calendar');
    document.getElementById('page-list').classList.toggle('hidden', page !== 'list');
    document.getElementById('page-admin').classList.toggle('hidden', page !== 'admin');

    ['calendar', 'list', 'admin'].forEach(p => {
        const btn = document.getElementById(`tab-${p}`);
        if (btn) {
            btn.className = (p === page)
                ? "px-2.5 sm:px-3 py-1.5 rounded-lg text-teal-400 bg-slate-700 shadow"
                : "px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-300 hover:text-white";
        }
    });

    renderCurrentPage();
};

function renderCurrentPage() {
    if (activePage === 'calendar') renderCalendar();
    if (activePage === 'list') renderMemberList();
    if (activePage === 'admin') renderAdminPage();
}

// Calendar Controls
window.changeCalMonth = function(delta) {
    calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + delta, 1);
    renderCalendar();
};

window.resetCalToToday = function() {
    calCurrentDate = new Date();
    renderCalendar();
};

window.toggleDateSelection = function(dateStr) {
    if (mySelectedDates.has(dateStr)) {
        mySelectedDates.delete(dateStr);
    } else {
        mySelectedDates.add(dateStr);
    }
    renderCalendar();
};

// Save Response
window.submitFreeDays = async function() {
    if (!currentSecretCode || !currentUserName || !activeEventData) return;

    const updatedResponses = {
        ...(activeEventData.responses || {}),
        [currentUserName]: Array.from(mySelectedDates)
    };

    const updatedEvent = {
        ...activeEventData,
        responses: updatedResponses
    };

    submittedDates = new Set(mySelectedDates);
    await syncEventToCloud(currentSecretCode, updatedEvent);

    window.showToast("Response saved & submitted! 🎉");
    checkAndTriggerConfetti();
};

function checkAndTriggerConfetti() {
    if (!activeEventData) return;

    const groupGoal = activeEventData.groupSize || 1;
    const responses = activeEventData.responses || {};

    const dateCounts = {};
    Object.values(responses).forEach(userDates => {
        userDates.forEach(d => {
            dateCounts[d] = (dateCounts[d] || 0) + 1;
        });
    });

    const hasAllFreeDate = Object.values(dateCounts).some(count => count >= groupGoal);
    if (hasAllFreeDate && typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
}

function renderCalendar() {
    if (!currentSecretCode || !activeEventData) return;

    const eventObj = activeEventData;
    document.getElementById('event-title-display').innerText = eventObj.name;
    document.getElementById('event-code-tag').innerText = eventObj.code;
    document.getElementById('event-group-goal').innerText = eventObj.groupSize;

    const totalMembersSubmitted = Object.keys(eventObj.responses || {}).length;
    document.getElementById('event-submitted-count').innerText = totalMembersSubmitted;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('cal-month-year').innerText = `${monthNames[calCurrentDate.getMonth()]} ${calCurrentDate.getFullYear()}`;

    const daysGrid = document.getElementById('calendar-days-grid');
    daysGrid.innerHTML = '';

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const prevMonthDays = new Date(year, month, 0).getDate();

    let allFreeDatesCount = 0;

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const dCell = document.createElement('div');
        dCell.className = "aspect-square rounded-xl bg-slate-100/40 opacity-30 p-1 flex flex-col justify-between border border-transparent";
        dCell.innerHTML = `<span class="text-[10px] sm:text-xs text-slate-400 font-bold">${dayNum}</span>`;
        daysGrid.appendChild(dCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const freeMembers = [];
        Object.entries(eventObj.responses || {}).forEach(([mName, mDates]) => {
            if (mDates.includes(dateStr)) freeMembers.push(mName);
        });

        const isDraftSelected = mySelectedDates.has(dateStr);
        const isSubmittedResponse = submittedDates.has(dateStr);
        const isAllFree = freeMembers.length >= eventObj.groupSize && eventObj.groupSize > 0;
        
        if (isAllFree) allFreeDatesCount++;

        const dCell = document.createElement('div');
        dCell.onclick = () => window.toggleDateSelection(dateStr);

        let cardBgClass = "bg-white hover:bg-teal-50/50 border-slate-200/80";

        if (isAllFree) {
            cardBgClass = "all-free-glow text-slate-900 font-bold";
        } else if (isSubmittedResponse && isDraftSelected) {
            cardBgClass = "bg-emerald-600 text-white font-bold border-emerald-700 shadow-sm";
        } else if (isDraftSelected) {
            cardBgClass = "bg-teal-50 border-2 border-teal-500 text-teal-900 font-semibold shadow-sm";
        }

        const cellPaddingClass = isCompactMode ? 'p-1 rounded-xl' : 'p-2 rounded-2xl';
        dCell.className = `aspect-square ${cellPaddingClass} flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${cardBgClass}`;

        let avatarBadgesHtml = '';
        if (freeMembers.length > 0) {
            if (isCompactMode) {
                avatarBadgesHtml = `
                    <div class="flex flex-wrap gap-0.5 mt-0.5 max-h-[22px] overflow-hidden">
                        ${freeMembers.map(m => `
                            <span class="text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold ${
                                isAllFree 
                                    ? 'bg-slate-900 text-amber-300' 
                                    : (m === currentUserName ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700')
                            }" title="${m}">
                                ${m.charAt(0).toUpperCase()}
                            </span>
                        `).join('')}
                    </div>
                `;
            } else {
                avatarBadgesHtml = `
                    <div class="flex flex-wrap gap-1 mt-1 max-h-[42px] overflow-hidden">
                        ${freeMembers.map(m => `
                            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-bold truncate max-w-[55px] ${
                                isAllFree 
                                    ? 'bg-slate-900/90 text-amber-300' 
                                    : (m === currentUserName 
                                        ? (isSubmittedResponse ? 'bg-emerald-900 text-emerald-100' : 'bg-teal-700 text-white') 
                                        : 'bg-slate-200/80 text-slate-700')
                            }" title="${m}">
                                ${m}
                            </span>
                        `).join('')}
                    </div>
                `;
            }
        }

        let statusIndicator = '';
        if (isAllFree) {
            statusIndicator = isCompactMode 
                ? '<span class="text-[8px] font-black bg-slate-900 text-amber-300 px-1 py-0.2 rounded">100%</span>' 
                : '<span class="text-[10px] font-black tracking-tighter px-1 py-0.5 bg-slate-900 text-amber-300 rounded-md">ALL FREE</span>';
        } else if (isSubmittedResponse && isDraftSelected) {
            statusIndicator = isCompactMode 
                ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>'
                : '<span class="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-800 text-emerald-100 rounded-md flex items-center gap-0.5"><i data-lucide="check" class="w-3 h-3"></i> Saved</span>';
        } else if (isDraftSelected) {
            statusIndicator = '<i data-lucide="check-square" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600"></i>';
        } else {
            statusIndicator = '<i data-lucide="square" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300"></i>';
        }

        dCell.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <span class="text-xs sm:text-sm font-bold ${isSubmittedResponse && isDraftSelected && !isAllFree ? 'text-white' : 'text-slate-800'}">${day}</span>
                ${statusIndicator}
            </div>
            ${avatarBadgesHtml}
        `;

        daysGrid.appendChild(dCell);
    }

    const allFreeBadge = document.getElementById('all-free-count-badge');
    if (allFreeBadge) {
        if (allFreeDatesCount > 0) {
            allFreeBadge.classList.remove('hidden');
            allFreeBadge.classList.add('flex');
            document.getElementById('all-free-count-num').innerText = allFreeDatesCount;
        } else {
            allFreeBadge.classList.add('hidden');
            allFreeBadge.classList.remove('flex');
        }
    }

    if (window.lucide) window.lucide.createIcons();
}

function renderMemberList() {
    if (!currentSecretCode || !activeEventData) return;

    const eventObj = activeEventData;
    const responses = eventObj.responses || {};
    const container = document.getElementById('members-cards-container');
    container.innerHTML = '';

    const members = Object.keys(responses);
    document.getElementById('member-list-count').innerText = `${members.length} / ${eventObj.groupSize} expected responded`;

    if (members.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center py-8 text-xs text-slate-400">No members have submitted availability yet.</div>`;
        return;
    }

    members.forEach(mName => {
        const dates = responses[mName] || [];
        const card = document.createElement('div');
        card.className = "bg-slate-50 border border-slate-200 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between gap-3";

        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                    <div class="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                        ${mName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-slate-800">${mName} ${mName === currentUserName ? '(You)' : ''}</div>
                        <div class="text-[11px] text-slate-500">${dates.length} days selected as free</div>
                    </div>
                </div>
                <span class="text-xs font-mono font-bold px-2 py-1 bg-teal-100 text-teal-800 rounded-lg">
                    ${dates.length} Free Days
                </span>
            </div>
            <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60">
                ${dates.length > 0 
                    ? dates.map(d => `<span class="text-[11px] px-2 py-0.5 bg-white border border-slate-200 text-slate-700 font-mono font-semibold rounded-md">${d}</span>`).join('')
                    : '<span class="text-xs text-slate-400 italic">No free dates marked.</span>'
                }
            </div>
        `;
        container.appendChild(card);
    });
}

function renderAdminPage() {
    if (!currentSecretCode || !activeEventData) return;

    const eventObj = activeEventData;
    document.getElementById('setting-event-name').value = eventObj.name;
    document.getElementById('setting-event-code').value = eventObj.code;
    document.getElementById('setting-group-size').value = eventObj.groupSize || 5;

    const dateCounts = {};
    Object.values(eventObj.responses || {}).forEach(userDates => {
        userDates.forEach(d => {
            dateCounts[d] = (dateCounts[d] || 0) + 1;
        });
    });

    const sortedDates = Object.entries(dateCounts).sort((a,b) => b[1] - a[1]);
    const leaderboard = document.getElementById('leaderboard-container');
    leaderboard.innerHTML = '';

    if (sortedDates.length === 0) {
        leaderboard.innerHTML = `<div class="text-xs text-slate-400 italic py-4 text-center">No date submissions yet.</div>`;
        return;
    }

    sortedDates.forEach(([dateStr, count]) => {
        const isAllFree = count >= eventObj.groupSize;
        const percent = Math.min(100, Math.round((count / eventObj.groupSize) * 100));

        const item = document.createElement('div');
        item.className = `p-3 rounded-2xl border flex items-center justify-between ${
            isAllFree ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
        }`;

        item.innerHTML = `
            <div>
                <div class="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
                    <span>${dateStr}</span>
                    ${isAllFree ? '<span class="px-1.5 py-0.2 bg-amber-400 text-slate-900 font-sans text-[10px] rounded font-black">100% ALL FREE</span>' : ''}
                </div>
                <div class="w-28 sm:w-32 bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div class="bg-teal-500 h-full rounded-full" style="width: ${percent}%"></div>
                </div>
            </div>
            <div class="text-right">
                <span class="text-sm font-black text-slate-800">${count}</span>
                <span class="text-xs text-slate-500">/ ${eventObj.groupSize} free</span>
            </div>
        `;
        leaderboard.appendChild(item);
    });
}

window.handleSaveSettings = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentSecretCode || !activeEventData) return false;

    const newName = document.getElementById('setting-event-name').value.trim();
    const newCode = document.getElementById('setting-event-code').value.trim().toUpperCase();
    const newSize = parseInt(document.getElementById('setting-group-size').value, 10);

    if (!newName || !newCode || isNaN(newSize)) return false;

    const updatedEvent = {
        ...activeEventData,
        name: newName,
        code: newCode,
        groupSize: newSize
    };

    currentSecretCode = newCode;
    document.getElementById('header-event-badge').innerText = currentSecretCode;
    await syncEventToCloud(currentSecretCode, updatedEvent);
    window.showToast("Event settings saved to Cloud!");
    renderAdminPage();
    return false;
};

window.clearEventResponses = async function() {
    if (!confirm("Are you sure you want to clear all member responses for this event?")) return;
    if (!currentSecretCode || !activeEventData) return;

    const updatedEvent = {
        ...activeEventData,
        responses: {}
    };

    mySelectedDates.clear();
    submittedDates.clear();
    await syncEventToCloud(currentSecretCode, updatedEvent);
    window.showToast("Member responses reset on Cloud!");
    renderAdminPage();
};

window.exportEventJSON = function() {
    if (!activeEventData) return;
    const exportObj = { [currentSecretCode]: activeEventData };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `DateMatch_${currentSecretCode}_Backup.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    window.showToast("Data exported as JSON!");
};

window.triggerImportJSON = function() {
    document.getElementById('import-json-file').click();
};

window.importEventJSON = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            if (imported && currentSecretCode && imported[currentSecretCode]) {
                await syncEventToCloud(currentSecretCode, imported[currentSecretCode]);
            } else if (imported) {
                const firstKey = Object.keys(imported)[0];
                if (firstKey) await syncEventToCloud(firstKey, imported[firstKey]);
            }
            window.showToast("Cloud Database successfully imported!");
            window.navigate('calendar');
        } catch(err) {
            window.showToast("Error reading JSON file format.");
        }
    };
    reader.readAsText(file);
};

window.showToast = function(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-16', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-16', 'opacity-0');
    }, 3000);
};

window.toggleAppInfoModal = function(show) {
    const modal = document.getElementById('app-info-modal');
    if (modal) modal.classList.toggle('hidden', !show);
};

window.onload = function() {
    if (window.lucide) window.lucide.createIcons();
    checkDeviceMode();

    // Check LocalStorage ONLY for saved user's Name
    const savedName = localStorage.getItem('dateMatch_savedUserName');
    if (savedName) {
        const nameEl = document.getElementById('login-user-name');
        if (nameEl) nameEl.value = savedName;
    }
    initAuth();
};
