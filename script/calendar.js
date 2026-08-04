import { setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { db, getEventDocRef } from "./firebase.js";
import { showToast, getIsCompactMode } from "./ui.js";
import { ensureAuthenticated } from "./auth.js";
import { getText } from "./localize/dictionary.js";

let activeEventData = null;
let currentSecretCode = null;
let currentUserName = null;
let mySelectedDates = new Set();
let submittedDates = new Set();
let calCurrentDate = new Date();
let eventUnsubscribe = null;
let isRegisterMode = false;

const SVG_ICONS = {
    checkSquare: `<svg class="w-4 h-4 text-teal-600 inline-block pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
    square: `<svg class="w-4 h-4 text-slate-300 inline-block pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`,
    checkSquareGold: `<svg class="w-4 h-4 text-slate-900 font-bold inline-block pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
    squareGold: `<svg class="w-4 h-4 text-slate-700 hover:text-slate-900 inline-block pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`,
    checkSaved: `<svg class="w-3 h-3 text-white inline-block pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    arrowRight: `<svg class="w-4 h-4 text-slate-400 inline-block pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
};

function hasUnsavedChanges() {
    if (mySelectedDates.size !== submittedDates.size) return true;
    for (let d of mySelectedDates) {
        if (!submittedDates.has(d)) return true;
    }
    return false;
}

export async function listenToCloudEvent(code, preFetchedSnap = null) {
    if (eventUnsubscribe) eventUnsubscribe();

    const isAuth = await ensureAuthenticated();
    let docRef = getEventDocRef(code);

    if (!isAuth || !docRef) {
        showToast("Cloud connection unavailable.");
        return;
    }

    try {
        let targetRef = (preFetchedSnap && preFetchedSnap.exists()) ? preFetchedSnap.ref : docRef;

        eventUnsubscribe = onSnapshot(targetRef, (docSnap) => {
            activeEventData = docSnap.exists() ? docSnap.data() : null;
            updateUserStateFromActiveData();
            renderCurrentPage();
        }, (error) => {
            console.error("Firestore snapshot error:", error);
        });
    } catch (err) {
        console.error("Cloud listener error:", err);
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

export async function syncEventToCloud(code, updatedEventData) {
    activeEventData = updatedEventData;
    renderCurrentPage();

    const isAuth = await ensureAuthenticated();
    const docRef = getEventDocRef(code);
    if (!isAuth || !docRef) return;

    try {
        await setDoc(docRef, updatedEventData, { merge: true });
    } catch (e) {
        console.error("Cloud sync failed:", e);
    }
}

export function setAuthMode(mode) {
    isRegisterMode = (mode === 'create');
    const regFields = document.getElementById('register-extra-fields');
    const submitText = document.getElementById('login-submit-btn-text');
    const desc = document.getElementById('login-subtitle-desc');
    const tabJoin = document.getElementById('auth-tab-join');
    const tabCreate = document.getElementById('auth-tab-create');

    if (isRegisterMode) {
        if (regFields) regFields.classList.remove('hidden');
        if (submitText) submitText.innerText = getText('btn_register');
        if (desc) desc.innerText = getText('login_desc_create');
        if (tabJoin) tabJoin.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-800 transition-all";
        if (tabCreate) tabCreate.className = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-teal-700 shadow transition-all";
    } else {
        if (regFields) regFields.classList.add('hidden');
        if (submitText) submitText.innerText = getText('btn_enter');
        if (desc) desc.innerText = getText('login_desc_join');
        if (tabJoin) tabJoin.className = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-teal-700 shadow transition-all";
        if (tabCreate) tabCreate.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-800 transition-all";
    }
}

function setLoading(loading) {
    const btn = document.getElementById('login-submit-btn');
    const spinner = document.getElementById('login-spinner');
    const icon = document.getElementById('login-btn-icon');

    if (btn) btn.disabled = loading;
    if (spinner) spinner.classList.toggle('hidden', !loading);
    if (icon) icon.classList.toggle('hidden', loading);
}

export async function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const codeInput = document.getElementById('login-secret-code').value.trim().toUpperCase();
    const nameInput = document.getElementById('login-user-name').value.trim();
    const rememberMe = document.getElementById('remember-me-checkbox')?.checked;

    if (!codeInput || !nameInput) return false;

    setLoading(true);

    if (rememberMe) {
        localStorage.setItem('dateMatch_savedUserName', nameInput);
        localStorage.setItem('dateMatch_rememberMe', 'true');
    } else {
        localStorage.removeItem('dateMatch_savedUserName');
        localStorage.removeItem('dateMatch_rememberMe');
    }

    currentSecretCode = codeInput;
    currentUserName = nameInput;

    let eventSnap = null;
    try {
        const isAuth = await ensureAuthenticated();
        if (!isAuth || !db) throw new Error("MISSING_CONFIG");
        eventSnap = await getDoc(getEventDocRef(currentSecretCode));
    } catch (err) {
        setLoading(false);
        showToast(err.message === "MISSING_CONFIG" ? "No Firebase Config Detected!" : "Failed to connect to Cloud Storage.");
        return false;
    }

    const eventExists = eventSnap && eventSnap.exists();

    if (!isRegisterMode && !eventExists) {
        setLoading(false);
        showToast(`Cannot find Event Code "${currentSecretCode}". Create or check code.`);
        return false;
    } else if (isRegisterMode) {
        if (eventExists) {
            setLoading(false);
            showToast(`Event Code "${currentSecretCode}" already exists. Joining event...`);
            setAuthMode('join');
            return false;
        } else {
            const eventNameInput = document.getElementById('register-event-name')?.value.trim() || `${currentSecretCode} Event`;
            const rawGroupSize = parseInt(document.getElementById('register-group-size')?.value, 10);
            const groupSizeInput = (!isNaN(rawGroupSize) && rawGroupSize > 0) ? rawGroupSize : 5;

            await syncEventToCloud(currentSecretCode, {
                name: eventNameInput,
                code: currentSecretCode,
                groupSize: groupSizeInput,
                responses: {}
            });
        }
    }

    mySelectedDates.clear();
    submittedDates.clear();
    await listenToCloudEvent(currentSecretCode, eventSnap);

    setLoading(false);

    document.getElementById('user-avatar-initial').innerText = currentUserName.charAt(0).toUpperCase();
    document.getElementById('user-name-display').innerText = currentUserName;
    document.getElementById('header-event-badge').innerText = currentSecretCode;

    navigate('calendar');
    showToast(`Welcome, ${currentUserName}! You've entered the Event.`);
    return false;
}

export function logout() {
    if (eventUnsubscribe) eventUnsubscribe();
    currentSecretCode = null;
    currentUserName = null;
    activeEventData = null;
    mySelectedDates.clear();
    submittedDates.clear();

    setAuthMode('join');
    navigate('login');
}

let activePage = 'login';
export function navigate(page) {
    if (page !== 'login' && (!currentSecretCode || !currentUserName)) {
        showToast("Please enter the Event Code and your name.");
        page = 'login';
    }
    activePage = page;

    const navTabs = document.getElementById('main-nav-tabs');
    if (navTabs) {
        if (currentSecretCode && currentUserName && page !== 'login') {
            navTabs.classList.remove('hidden');
            navTabs.classList.add('flex');
        } else {
            navTabs.classList.add('hidden');
            navTabs.classList.remove('flex');
        }
    }

    const userInfoPill = document.getElementById('user-info-pill');
    if (userInfoPill) {
        if (page === 'login') {
            userInfoPill.classList.add('hidden');
            userInfoPill.classList.remove('flex');
        } else {
            userInfoPill.classList.remove('hidden');
            userInfoPill.classList.add('flex');
        }
    }

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
}

export function renderCurrentPage() {
    if (activePage === 'calendar') renderCalendar();
    if (activePage === 'list') renderMemberList();
    if (activePage === 'admin') renderAdminPage();
}

export function changeCalMonth(delta) {
    calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + delta, 1);
    renderCalendar();
}

export function resetCalToToday() {
    calCurrentDate = new Date();
    renderCalendar();
}

export function toggleDateSelection(dateStr, e = null) {
    if (e) e.stopPropagation();
    if (mySelectedDates.has(dateStr)) {
        mySelectedDates.delete(dateStr);
    } else {
        mySelectedDates.add(dateStr);
    }
    renderCalendar();
}

export async function submitFreeDays() {
    if (!currentSecretCode || !currentUserName || !activeEventData) return;

    const updatedResponses = {
        ...(activeEventData.responses || {}),
        [currentUserName]: Array.from(mySelectedDates)
    };

    submittedDates = new Set(mySelectedDates);
    await syncEventToCloud(currentSecretCode, {
        ...activeEventData,
        responses: updatedResponses
    });

    showToast("Your Free Days have been saved! 🎉");
    if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
}

export function openDateDetailModal(dateStr, event = null) {
    if (event) event.stopPropagation();

    const modal = document.getElementById('date-detail-modal');
    if (!modal || !activeEventData) return;

    const freeMembers = [];
    Object.entries(activeEventData.responses || {}).forEach(([mName, mDates]) => {
        if (mDates.includes(dateStr)) freeMembers.push(mName);
    });

    document.getElementById('modal-date-title').innerText = dateStr;
    document.getElementById('modal-free-count').innerText = `${freeMembers.length} / ${activeEventData.groupSize || 1} ${getText('members_unit')} free`;

    const membersContainer = document.getElementById('modal-members-list');
    membersContainer.innerHTML = '';

    if (freeMembers.length === 0) {
        membersContainer.innerHTML = `<p class="text-xs text-slate-400 italic py-3 text-center">No members available on this day.</p>`;
    } else {
        freeMembers.forEach(m => {
            const pill = document.createElement('div');
            pill.className = "flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800";
            pill.innerHTML = `
                <div class="w-6 h-6 rounded-full bg-teal-600 text-white text-[10px] font-black flex items-center justify-center">
                    ${m.charAt(0).toUpperCase()}
                </div>
                <span>${m} ${m === currentUserName ? '(You)' : ''}</span>
            `;
            membersContainer.appendChild(pill);
        });
    }

    const toggleBtn = document.getElementById('modal-toggle-free-btn');
    const isSelected = mySelectedDates.has(dateStr);
    toggleBtn.innerText = isSelected ? getText('btn_remove_free') : getText('btn_mark_free');
    toggleBtn.className = isSelected 
        ? "w-full py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold text-xs rounded-xl transition-all"
        : "w-full py-2 bg-teal-600 text-white hover:bg-teal-700 font-bold text-xs rounded-xl shadow transition-all";

    toggleBtn.onclick = async () => {
        toggleDateSelection(dateStr);
        await submitFreeDays();
        openDateDetailModal(dateStr);
    };

    modal.classList.remove('hidden');
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

    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const prevMonthDays = new Date(year, month, 0).getDate();

    let allFreeDatesCount = 0;
    const isCompactMode = getIsCompactMode();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const dCell = document.createElement('div');
        dCell.className = "aspect-square rounded-xl bg-slate-100/40 opacity-30 p-1 flex flex-col justify-between border border-transparent";
        dCell.innerHTML = `<span class="text-[10px] sm:text-xs text-slate-400 font-bold">${dayNum}</span>`;
        daysGrid.appendChild(dCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isTodayDate = (dateStr === todayStr);

        const freeMembers = [];
        Object.entries(eventObj.responses || {}).forEach(([mName, mDates]) => {
            if (mDates.includes(dateStr)) freeMembers.push(mName);
        });

        const isDraftSelected = mySelectedDates.has(dateStr);
        const isSubmittedResponse = submittedDates.has(dateStr);
        const isAllFree = freeMembers.length >= eventObj.groupSize && eventObj.groupSize > 0;
        
        if (isAllFree) allFreeDatesCount++;

        const dCell = document.createElement('div');
        dCell.onclick = (e) => toggleDateSelection(dateStr, e);

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
                const visible = freeMembers.slice(0, 1);
                const overflowCount = freeMembers.length - 1;

                avatarBadgesHtml = `
                    <div class="flex items-center gap-1 mt-1 max-h-[20px] w-full overflow-hidden">
                        ${visible.map(m => `
                            <span class="text-[8px] w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center font-bold ${
                                isAllFree ? 'bg-slate-900 text-amber-300' : (m === currentUserName ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700')
                            }" title="${m}">${m.charAt(0).toUpperCase()}</span>
                        `).join('')}
                        ${overflowCount >= 1 ? `<span class="text-[8px] px-1.5 py-0.2 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm bg-slate-200 text-slate-700 font-bold">+${overflowCount}</span>` : ''}
                    </div>
                `;
            } else {
                const visible = freeMembers.slice(0, 2);
                const overflowCount = freeMembers.length - 2;

                avatarBadgesHtml = `
                    <div onclick="openDateDetailModal('${dateStr}', event)" class="flex flex-wrap gap-1 mt-1 max-h-[42px] overflow-hidden items-center">
                        ${visible.map(m => `
                            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-bold truncate max-w-[55px] ${
                                isAllFree ? 'bg-slate-900/90 text-amber-300' : (m === currentUserName ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200/80 text-slate-700')
                            }" title="${m}">${m}</span>
                        `).join('')}
                        ${overflowCount >= 1 ? `<span class="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900 text-teal-300 font-extrabold shadow-sm">+${overflowCount}</span>` : ''}
                    </div>
                `;
            }
        }

        let statusIndicator = isAllFree 
            ? (isDraftSelected ? SVG_ICONS.checkSquareGold : SVG_ICONS.squareGold)
            : (isSubmittedResponse && isDraftSelected ? SVG_ICONS.checkSaved : (isDraftSelected ? SVG_ICONS.checkSquare : SVG_ICONS.square));

        const dateDisplayHtml = isTodayDate 
            ? `<span class="w-5 h-5 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shadow-sm">${day}</span>`
            : `<span class="text-xs sm:text-sm font-bold ${isSubmittedResponse && isDraftSelected && !isAllFree ? 'text-white' : 'text-slate-800'}">${day}</span>`;

        dCell.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-1">${dateDisplayHtml}</div>
                ${statusIndicator}
            </div>
            ${avatarBadgesHtml}
        `;

        daysGrid.appendChild(dCell);
    }

    const allFreeBadge = document.getElementById('all-free-count-badge');
    if (allFreeBadge) {
        allFreeBadge.classList.toggle('hidden', allFreeDatesCount === 0);
        allFreeBadge.classList.toggle('flex', allFreeDatesCount > 0);
        const badgeNum = document.getElementById('all-free-count-num');
        if (badgeNum) badgeNum.innerText = allFreeDatesCount;
    }

    renderLeaderboard('leaderboard-container-home');
    updateSaveButtonState();
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
        container.innerHTML = `<div class="col-span-2 text-center py-8 text-xs text-slate-400">No member responses submitted yet.</div>`;
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
                        <div class="text-[11px] text-slate-500">${dates.length} Free Days selected</div>
                    </div>
                </div>
                <span class="text-xs font-mono font-bold px-2 py-1 bg-teal-100 text-teal-800 rounded-lg">
                    ${dates.length} Days free
                </span>
            </div>
            <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60">
                ${dates.length > 0 
                    ? dates.map(d => `<span class="text-[11px] px-2 py-0.5 bg-white border border-slate-200 text-slate-700 font-mono font-semibold rounded-md">${d}</span>`).join('')
                    : '<span class="text-xs text-slate-400 italic">No Free Days marked.</span>'
                }
            </div>
        `;
        container.appendChild(card);
    });
}

function renderLeaderboard(containerId) {
    if (!currentSecretCode || !activeEventData) return;

    const eventObj = activeEventData;
    const container = document.getElementById(containerId);
    if (!container) return;

    const dateCounts = {};
    Object.values(eventObj.responses || {}).forEach(userDates => {
        userDates.forEach(d => {
            dateCounts[d] = (dateCounts[d] || 0) + 1;
        });
    });

    const sortedDates = Object.entries(dateCounts).sort((a,b) => b[1] - a[1]);
    container.innerHTML = '';

    if (sortedDates.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-400 italic py-4 text-center">No submissions yet.</div>`;
        return;
    }

    sortedDates.forEach(([dateStr, count]) => {
        const isAllFree = count >= eventObj.groupSize;
        const percent = Math.min(100, Math.round((count / eventObj.groupSize) * 100));

        const item = document.createElement('div');
        item.className = `p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer hover:border-teal-400 ${
            isAllFree ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-slate-50 border-slate-200'
        }`;

        item.onclick = (e) => openDateDetailModal(dateStr, e);

        item.innerHTML = `
            <div>
                <div class="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
                    <span>${dateStr}</span>
                    ${isAllFree ? `<span class="px-1.5 py-0.2 bg-amber-400 text-slate-900 font-sans text-[9px] rounded font-black">${getText('all_free_badge')}</span>` : ''}
                </div>
                <div class="w-24 sm:w-32 bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div class="bg-teal-500 h-full rounded-full" style="width: ${percent}%"></div>
                </div>
            </div>
            <div class="text-right flex items-center gap-2">
                <div>
                    <span class="text-xs sm:text-sm font-black text-slate-800">${count}</span>
                    <span class="text-[11px] text-slate-500">/ ${eventObj.groupSize} Free</span>
                </div>
                ${SVG_ICONS.arrowRight}
            </div>
        `;
        container.appendChild(item);
    });
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById('save-response-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    if (!saveBtn || !saveBtnText) return;

    const unsaved = hasUnsavedChanges();

    if (unsaved) {
        saveBtn.className = "save-response-btn unsaved-glow px-3.5 py-2 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all flex-shrink-0";
        saveBtnText.innerHTML = `${getText('btn_save_response')} <span class="ml-1 px-1.5 py-0.2 bg-amber-300 text-slate-900 text-[10px] rounded-full font-black animate-bounce inline-block">!</span>`;
    } else {
        saveBtn.className = "save-response-btn px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all flex-shrink-0";
        saveBtnText.innerText = getText('btn_save_response');
    }
}

function renderAdminPage() {
    if (!currentSecretCode || !activeEventData) return;

    const eventObj = activeEventData;
    document.getElementById('setting-event-name').value = eventObj.name;
    document.getElementById('setting-event-code').value = eventObj.code;
    document.getElementById('setting-group-size').value = eventObj.groupSize || 5;
}

export async function handleSaveSettings(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentSecretCode || !activeEventData) return false;

    const newName = document.getElementById('setting-event-name').value.trim();
    const newCode = document.getElementById('setting-event-code').value.trim().toUpperCase();
    const newSize = parseInt(document.getElementById('setting-group-size').value, 10);

    if (!newName || !newCode || isNaN(newSize)) return false;

    currentSecretCode = newCode;
    document.getElementById('header-event-badge').innerText = currentSecretCode;
    
    await syncEventToCloud(currentSecretCode, {
        ...activeEventData,
        name: newName,
        code: newCode,
        groupSize: newSize
    });
    
    showToast("Event Settings saved to Cloud!");
    renderAdminPage();
    return false;
}

export async function clearEventResponses() {
    if (!confirm("Are you sure you would like to clear all member responses?")) return;
    if (!currentSecretCode || !activeEventData) return;

    mySelectedDates.clear();
    submittedDates.clear();
    await syncEventToCloud(currentSecretCode, {
        ...activeEventData,
        responses: {}
    });
    showToast("Reset all responses successfully.");
    renderAdminPage();
}

export function exportEventJSON() {
    if (!activeEventData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ [currentSecretCode]: activeEventData }, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `DateMatch_${currentSecretCode}_Backup.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

export function triggerImportJSON() {
    document.getElementById('import-json-file').click();
}

export function importEventJSON(e) {
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
            showToast("Data imported successfully.");
            navigate('calendar');
        } catch(err) {
            showToast("Failed to read JSON file.");
        }
    };
    reader.readAsText(file);
}