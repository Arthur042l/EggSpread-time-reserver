// Shared Configuration for DateMatch App & Admin Portal

export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export const defaultFirebaseConfig = {
    apiKey: "AIzaSyDm0L6F6CGmrbsESTMLhOek74a5ttySP04",
    authDomain: "eggspread-time-reserver.firebaseapp.com",
    projectId: "eggspread-time-reserver",
    storageBucket: "eggspread-time-reserver.firebasestorage.app",
    messagingSenderId: "792367749553",
    appId: "1:792367749553:web:365c504ae65ccc7fcf4590",
    measurementId: "G-LLG556KH52"
};

// Verified Google Account UIDs allowed to access the Admin Portal Dashboard
export const VERIFIED_UIDS = [
    // Add authorized Google Account UIDs here, e.g.:
    "zGEBC62mZQQLS1gv5c125CrQJXr2"
];