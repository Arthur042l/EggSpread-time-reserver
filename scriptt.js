import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";  
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
 
const firebaseConfig = {
  apiKey: "AIzaSyDm0L6F6CGmrbsESTMLhOek74a5ttySP04",
  authDomain: "eggspread-time-reserver.firebaseapp.com",
  projectId: "eggspread-time-reserver",
  storageBucket: "eggspread-time-reserver.firebasestorage.app",
  messagingSenderId: "792367749553",
  appId: "1:792367749553:web:2983034ea8cc356bcf4590",
  measurementId: "G-454RH7QCTB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 
const analytics = getAnalytics(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Default Fallback Database
const DEFAULT_DATABASE = {
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

// App State
let localDb = loadLocalDatabase();
let currentSecretCode = null;
let currentUserName = null;
let mySelectedDates = new Set();
let calCurrentDate = new Date(2026, 7, 1);
let eventUnsubscribe = null;
let isCloudActive = false;

// Authenticate on load
async function initAuth() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        isCloudActive = true;
    } catch (e) {
        console.warn("Cloud auth notice: Operating in offline/local fallback mode.", e);
        isCloudActive = false;
    }
}

function loadLocalDatabase() {
    const saved = localStorage.getItem('dateMatch_db');
    if (saved) {
        try { return JSON.parse(saved); } catch(e){}
    }
    return DEFAULT_DATABASE;
}

function saveLocalDatabase() {
    localStorage.setItem('dateMatch_db', JSON.stringify(localDb));
}

// Firestore Real-time Listener
function listenToCloudEvent(code) {
    if (eventUnsubscribe) eventUnsubscribe();
    if (!isCloudActive) return;

    const eventDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', code);
    
    eventUnsubscribe = onSnapshot(eventDocRef, (docSnap) => {
        if (docSnap.exists()) {
            localDb[code] = docSnap.data();
        } else {
            const seedData = localDb[code] || {
                name: `${code} Event`,
                code: code,
                groupSize: 5,
                responses: {}
            };
            setDoc(eventDocRef, seedData, { merge: true });
            localDb[code] = seedData;
        }
        saveLocalDatabase();
        renderCurrentPage();
    }, (error) => {
        console.warn("Firestore snapshot error:", error);
    });
}

// Sync Local State to Firestore
async function syncEventToCloud(code) {
    saveLocalDatabase();
    if (!isCloudActive || !code) return;

    try {
        const eventDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', code);
        await setDoc(eventDocRef, localDb[code], { merge: true });
    } catch (e) {
        console.error("Firestore sync failed:", e);
    }
}

// Bind Functions to Window object for HTML Onclick Handlers
window.quickFill = function(code, name) {
    document.getElementById('login-secret-code').value = code;
    document.getElementById('login-user-name').value = name;
};

window.handleLoginSubmit = function(e) {
    e.preventDefault();
    const codeInput = document.getElementById('login-secret-code').value.trim().toUpperCase();
    const nameInput = document.getElementById('login-user-name').value.trim();
    const rememberMe = document.getElementById('remember-me-checkbox').checked;

    if (!codeInput || !nameInput) return;

    if (rememberMe) {
        localStorage.setItem('dateMatch_savedUser', JSON.stringify({ code: codeInput, name: nameInput }));
    } else {
        localStorage.removeItem('dateMatch_savedUser');
    }

    if (!localDb[codeInput]) {
        localDb[codeInput] = {
            name: `${codeInput} Event`,
            code: codeInput,
            groupSize: 5,
            responses: {}
        };
    }

    currentSecretCode = codeInput;
    currentUserName = nameInput;

    listenToCloudEvent(currentSecretCode);

    const existingUserDates = (localDb[currentSecretCode].responses && localDb[currentSecretCode].responses[currentUserName]) || [];
    mySelectedDates = new Set(existingUserDates);

    document.getElementById('user-avatar-initial').innerText = currentUserName.charAt(0).toUpperCase();
    document.getElementById('user-name-display').innerText = currentUserName;
    document.getElementById('user-info-pill').classList.remove('hidden');
    document.getElementById('user-info-pill').classList.add('flex');
    document.getElementById('header-event-badge').innerText = currentSecretCode;

    window.navigate('calendar');
    window.showToast(`Welcome, ${currentUserName}! Session active.`);
};

window.logout = function() {
    if (eventUnsubscribe) eventUnsubscribe();
    currentSecretCode = null;
    currentUserName = null;
    mySelectedDates.clear();
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
                ? "px-3 py-1.5 rounded-lg text-teal-400 bg-slate-700 shadow"
                : "px-3 py-1.5 rounded-lg text-slate-300 hover:text-white";
        }
    });

    renderCurrentPage();
};

function renderCurrentPage() {
    if (activePage === 'calendar') renderCalendar();
    if (activePage === 'list') renderMemberList();
    if (activePage === 'admin') renderAdminPage();
}

// Calendar Navigation & Toggles
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

window.submitFreeDays = async function() {
    if (!currentSecretCode || !currentUserName) return;

    if (!localDb[currentSecretCode].responses) {
        localDb[currentSecretCode].responses = {};
    }

    localDb[currentSecretCode].responses[currentUserName] = Array.from(mySelectedDates);
    await syncEventToCloud(currentSecretCode);

    window.showToast("Your free days saved & synced online! 🎉");
    renderCalendar();
    checkAndTriggerConfetti();
};

function checkAndTriggerConfetti() {
    const eventObj = localDb[currentSecretCode];
    if (!eventObj) return;

    const groupGoal = eventObj.groupSize || 1;
    const responses = eventObj.responses || {};

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
    if (!currentSecretCode || !localDb[currentSecretCode]) return;

    const eventObj = localDb[currentSecretCode];
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
        dCell.className = "aspect-square rounded-2xl bg-slate-100/40 opacity-40 p-1.5 flex flex-col justify-between border border-transparent";
        dCell.innerHTML = `<span class="text-xs text-slate-400 font-bold">${dayNum}</span>`;
        daysGrid.appendChild(dCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const freeMembers = [];
        Object.entries(eventObj.responses || {}).forEach(([mName, mDates]) => {
            if (mDates.includes(dateStr)) freeMembers.push(mName);
        });

        const isMySelected = mySelectedDates.has(dateStr);
        const isAllFree = freeMembers.length >= eventObj.groupSize && eventObj.groupSize > 0;
        
        if (isAllFree) allFreeDatesCount++;

        const dCell = document.createElement('div');
        dCell.onclick = () => window.toggleDateSelection(dateStr);

        let cardBgClass = "bg-white hover:bg-teal-50/50 border-slate-200/80";
        if (isAllFree) {
            cardBgClass = "all-free-glow text-slate-900";
        } else if (isMySelected) {
            cardBgClass = "bg-teal-500 text-white border-teal-600 shadow-md shadow-teal-500/20";
        }

        dCell.className = `aspect-square rounded-2xl p-1.5 sm:p-2 flex flex-col justify-between border transition-all cursor-pointer relative overflow-hidden ${cardBgClass}`;

        let avatarBadgesHtml = '';
        if (freeMembers.length > 0) {
            avatarBadgesHtml = `
                <div class="flex flex-wrap gap-1 mt-1 max-h-[42px] overflow-hidden">
                    ${freeMembers.map(m => `
                        <span class="text-[10px] px-1.5 py-0.5 rounded-md font-bold truncate max-w-[55px] ${
                            isAllFree 
                                ? 'bg-slate-900/90 text-amber-300' 
                                : (m === currentUserName ? 'bg-emerald-700 text-white' : 'bg-slate-200/80 text-slate-700')
                        }" title="${m}">
                            ${m}
                        </span>
                    `).join('')}
                </div>
            `;
        }

        dCell.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <span class="text-xs sm:text-sm font-bold ${isMySelected && !isAllFree ? 'text-white' : 'text-slate-800'}">${day}</span>
                ${isAllFree ? '<span class="text-[10px] font-black tracking-tighter px-1 py-0.5 bg-slate-900 text-amber-300 rounded-md">ALL FREE</span>' : ''}
                ${isMySelected && !isAllFree ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>' : ''}
            </div>
            ${avatarBadgesHtml}
        `;

        daysGrid.appendChild(dCell);
    }

    const allFreeBadge = document.getElementById('all-free-count-badge');
    if (allFreeDatesCount > 0) {
        allFreeBadge.classList.remove('hidden');
        allFreeBadge.classList.add('flex');
        document.getElementById('all-free-count-num').innerText = allFreeDatesCount;
    } else {
        allFreeBadge.classList.add('hidden');
        allFreeBadge.classList.remove('flex');
    }

    if (window.lucide) window.lucide.createIcons();
}

function renderMemberList() {
    if (!currentSecretCode || !localDb[currentSecretCode]) return;

    const eventObj = localDb[currentSecretCode];
    const responses = eventObj.responses || {};
    const container = document.getElementById('members-cards-container');
    container.innerHTML = '';

    const members = Object.keys(responses);
    document.getElementById('member-list-count').innerText = `${members.length} / ${eventObj.groupSize} members responded`;

    if (members.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center py-8 text-xs text-slate-400">No members have submitted availability yet.</div>`;
        return;
    }

    members.forEach(mName => {
        const dates = responses[mName] || [];
        const card = document.createElement('div');
        card.className = "bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between gap-3";

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
    if (!currentSecretCode || !localDb[currentSecretCode]) return;

    const eventObj = localDb[currentSecretCode];
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
                <div class="w-32 bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
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
    e.preventDefault();
    if (!currentSecretCode) return;

    const newName = document.getElementById('setting-event-name').value.trim();
    const newCode = document.getElementById('setting-event-code').value.trim().toUpperCase();
    const newSize = parseInt(document.getElementById('setting-group-size').value, 10);

    if (!newName || !newCode || isNaN(newSize)) return;

    const oldData = localDb[currentSecretCode];
    delete localDb[currentSecretCode];

    localDb[newCode] = {
        ...oldData,
        name: newName,
        code: newCode,
        groupSize: newSize
    };

    currentSecretCode = newCode;
    document.getElementById('header-event-badge').innerText = currentSecretCode;
    await syncEventToCloud(currentSecretCode);
    window.showToast("Event settings saved!");
    renderAdminPage();
};

window.clearEventResponses = async function() {
    if (!confirm("Are you sure you want to clear all member responses for this event?")) return;
    if (!currentSecretCode) return;

    localDb[currentSecretCode].responses = {};
    mySelectedDates.clear();
    await syncEventToCloud(currentSecretCode);
    window.showToast("Member responses reset!");
    renderAdminPage();
};

window.exportEventJSON = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localDb, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `DateMatch_Backup.json`);
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
            localDb = imported;
            if (currentSecretCode) await syncEventToCloud(currentSecretCode);
            window.showToast("Database successfully imported!");
            window.navigate('calendar');
        } catch(err) {
            window.showToast("Error reading JSON file format.");
        }
    };
    reader.readAsText(file);
};

window.showToast = function(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-16', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-16', 'opacity-0');
    }, 3000);
};

// Start Auth Setup on Window Load
window.onload = function() {
    if (window.lucide) window.lucide.createIcons();
    const savedUser = localStorage.getItem('dateMatch_savedUser');
    if (savedUser) {
        try {
            const parsed = JSON.parse(savedUser);
            document.getElementById('login-secret-code').value = parsed.code || '';
            document.getElementById('login-user-name').value = parsed.name || '';
        } catch(e){}
    }
    initAuth();
};
