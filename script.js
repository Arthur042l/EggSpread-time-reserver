// Default Mock Database State
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

// App Runtime State
let db = loadDatabase();
let currentSecretCode = null;
let currentUserName = null;
let mySelectedDates = new Set();
let calCurrentDate = new Date(2026, 7, 1); // Default Aug 2026

// Local Storage Handler
function loadDatabase() {
    const saved = localStorage.getItem('dateMatch_db');
    if (saved) {
        try { return JSON.parse(saved); } catch(e){}
    }
    return DEFAULT_DATABASE;
}

function saveDatabase() {
    localStorage.setItem('dateMatch_db', JSON.stringify(db));
}

// Initialize App
window.onload = function() {
    lucide.createIcons();
    checkRememberedUser();
};

function checkRememberedUser() {
    const savedUser = localStorage.getItem('dateMatch_savedUser');
    if (savedUser) {
        try {
            const parsed = JSON.parse(savedUser);
            document.getElementById('login-secret-code').value = parsed.code || '';
            document.getElementById('login-user-name').value = parsed.name || '';
        } catch(e){}
    }
}

function quickFill(code, name) {
    document.getElementById('login-secret-code').value = code;
    document.getElementById('login-user-name').value = name;
}

// Handle Login / Join Event
function handleLoginSubmit(e) {
    e.preventDefault();
    const codeInput = document.getElementById('login-secret-code').value.trim().toUpperCase();
    const nameInput = document.getElementById('login-user-name').value.trim();
    const rememberMe = document.getElementById('remember-me-checkbox').checked;

    if (!codeInput || !nameInput) return;

    // Save Remember Me
    if (rememberMe) {
        localStorage.setItem('dateMatch_savedUser', JSON.stringify({ code: codeInput, name: nameInput }));
    } else {
        localStorage.removeItem('dateMatch_savedUser');
    }

    // Create Event if not exists
    if (!db[codeInput]) {
        db[codeInput] = {
            name: `${codeInput} Event`,
            code: codeInput,
            groupSize: 5,
            responses: {}
        };
        saveDatabase();
        showToast(`Created new event code: ${codeInput}`);
    }

    currentSecretCode = codeInput;
    currentUserName = nameInput;

    // Load user's previously submitted free dates if any
    const existingUserDates = db[currentSecretCode].responses[currentUserName] || [];
    mySelectedDates = new Set(existingUserDates);

    // Update Header User Info
    document.getElementById('user-avatar-initial').innerText = currentUserName.charAt(0).toUpperCase();
    document.getElementById('user-name-display').innerText = currentUserName;
    document.getElementById('user-info-pill').classList.remove('hidden');
    document.getElementById('user-info-pill').classList.add('flex');
    document.getElementById('header-event-badge').innerText = currentSecretCode;

    navigate('calendar');
    showToast(`Welcome back, ${currentUserName}!`);
}

function logout() {
    currentSecretCode = null;
    currentUserName = null;
    mySelectedDates.clear();
    document.getElementById('user-info-pill').classList.add('hidden');
    document.getElementById('user-info-pill').classList.remove('flex');
    navigate('login');
}

// Navigation Switcher
function navigate(page) {
    if (page !== 'login' && (!currentSecretCode || !currentUserName)) {
        page = 'login';
    }

    document.getElementById('page-login').classList.toggle('hidden', page !== 'login');
    document.getElementById('page-calendar').classList.toggle('hidden', page !== 'calendar');
    document.getElementById('page-list').classList.toggle('hidden', page !== 'list');
    document.getElementById('page-admin').classList.toggle('hidden', page !== 'admin');

    // Update Nav buttons style
    ['calendar', 'list', 'admin'].forEach(p => {
        const btn = document.getElementById(`tab-${p}`);
        if (btn) {
            if (p === page) {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-teal-400 bg-slate-700 shadow";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-slate-300 hover:text-white";
            }
        }
    });

    if (page === 'calendar') renderCalendar();
    if (page === 'list') renderMemberList();
    if (page === 'admin') renderAdminPage();
}

// ================= CALENDAR RENDERING =================
function changeCalMonth(delta) {
    calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + delta, 1);
    renderCalendar();
}

function resetCalToToday() {
    calCurrentDate = new Date();
    renderCalendar();
}

function toggleDateSelection(dateStr) {
    if (mySelectedDates.has(dateStr)) {
        mySelectedDates.delete(dateStr);
    } else {
        mySelectedDates.add(dateStr);
    }
    renderCalendar();
}

function submitFreeDays() {
    if (!currentSecretCode || !currentUserName) return;

    db[currentSecretCode].responses[currentUserName] = Array.from(mySelectedDates);
    saveDatabase();
    showToast("Your free days have been saved! 🎉");
    renderCalendar();

    // Trigger confetti if any date is 100% all free
    checkAndTriggerConfetti();
}

function checkAndTriggerConfetti() {
    const eventObj = db[currentSecretCode];
    const groupGoal = eventObj.groupSize || 1;
    const responses = eventObj.responses || {};

    // Count availability per date
    const dateCounts = {};
    Object.values(responses).forEach(userDates => {
        userDates.forEach(d => {
            dateCounts[d] = (dateCounts[d] || 0) + 1;
        });
    });

    const hasAllFreeDate = Object.values(dateCounts).some(count => count >= groupGoal);
    if (hasAllFreeDate && typeof confetti === 'function') {
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function renderCalendar() {
    if (!currentSecretCode) return;

    const eventObj = db[currentSecretCode];
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

    // Padding previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const dCell = document.createElement('div');
        dCell.className = "aspect-square rounded-2xl bg-slate-100/40 opacity-40 p-1.5 flex flex-col justify-between border border-transparent";
        dCell.innerHTML = `<span class="text-xs text-slate-400 font-bold">${dayNum}</span>`;
        daysGrid.appendChild(dCell);
    }

    // Current Month Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Find all people free on this date
        const freeMembers = [];
        Object.entries(eventObj.responses || {}).forEach(([mName, mDates]) => {
            if (mDates.includes(dateStr)) {
                freeMembers.push(mName);
            }
        });

        const isMySelected = mySelectedDates.has(dateStr);
        const isAllFree = freeMembers.length >= eventObj.groupSize && eventObj.groupSize > 0;
        
        if (isAllFree) allFreeDatesCount++;

        const dCell = document.createElement('div');
        dCell.onclick = () => toggleDateSelection(dateStr);

        let cardBgClass = "bg-white hover:bg-teal-50/50 border-slate-200/80";
        if (isAllFree) {
            cardBgClass = "all-free-glow text-slate-900";
        } else if (isMySelected) {
            cardBgClass = "bg-teal-500 text-white border-teal-600 shadow-md shadow-teal-500/20";
        }

        dCell.className = `aspect-square rounded-2xl p-1.5 sm:p-2 flex flex-col justify-between border transition-all cursor-pointer relative overflow-hidden ${cardBgClass}`;

        // Inner HTML content
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

    // Update All-Free Badge
    const allFreeBadge = document.getElementById('all-free-count-badge');
    if (allFreeDatesCount > 0) {
        allFreeBadge.classList.remove('hidden');
        allFreeBadge.classList.add('flex');
        document.getElementById('all-free-count-num').innerText = allFreeDatesCount;
    } else {
        allFreeBadge.classList.add('hidden');
        allFreeBadge.classList.remove('flex');
    }

    lucide.createIcons();
}

// ================= MEMBER LIST VIEW =================
function renderMemberList() {
    if (!currentSecretCode) return;

    const eventObj = db[currentSecretCode];
    const responses = eventObj.responses || {};
    const container = document.getElementById('members-cards-container');
    container.innerHTML = '';

    const members = Object.keys(responses);
    document.getElementById('member-list-count').innerText = `${members.length} / ${eventObj.groupSize} members responded`;

    if (members.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center py-8 text-xs text-slate-400">No members have submitted their availability yet.</div>`;
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

// ================= ADMIN & SETTINGS =================
function renderAdminPage() {
    if (!currentSecretCode) return;

    const eventObj = db[currentSecretCode];
    document.getElementById('setting-event-name').value = eventObj.name;
    document.getElementById('setting-event-code').value = eventObj.code;
    document.getElementById('setting-group-size').value = eventObj.groupSize || 5;

    // Render Leaderboard
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

function handleSaveSettings(e) {
    e.preventDefault();
    if (!currentSecretCode) return;

    const newName = document.getElementById('setting-event-name').value.trim();
    const newCode = document.getElementById('setting-event-code').value.trim().toUpperCase();
    const newSize = parseInt(document.getElementById('setting-group-size').value, 10);

    if (!newName || !newCode || isNaN(newSize)) return;

    // Update record
    const oldData = db[currentSecretCode];
    delete db[currentSecretCode];

    db[newCode] = {
        ...oldData,
        name: newName,
        code: newCode,
        groupSize: newSize
    };

    currentSecretCode = newCode;
    document.getElementById('header-event-badge').innerText = currentSecretCode;
    saveDatabase();
    showToast("Event settings saved!");
    renderAdminPage();
}

function clearEventResponses() {
    if (!confirm("Are you sure you want to clear all member date submissions for this event?")) return;
    if (!currentSecretCode) return;

    db[currentSecretCode].responses = {};
    mySelectedDates.clear();
    saveDatabase();
    showToast("Member responses reset!");
    renderAdminPage();
}

// Export / Import JSON
function exportEventJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `DateMatch_Events_Backup.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast("Data exported as JSON!");
}

function triggerImportJSON() {
    document.getElementById('import-json-file').click();
}

function importEventJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            db = imported;
            saveDatabase();
            showToast("Database successfully imported!");
            navigate('calendar');
        } catch(err) {
            showToast("Error reading JSON file format.");
        }
    };
    reader.readAsText(file);
}

// Toast Helper
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-16', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-16', 'opacity-0');
    }, 3000);
}