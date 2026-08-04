import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { defaultFirebaseConfig, appId } from "./config.js";

let app = null;
let auth = null;
let db = null;

try {
    const firebaseConfig = (typeof __firebase_config !== 'undefined' && __firebase_config) 
        ? JSON.parse(__firebase_config) 
        : defaultFirebaseConfig;

    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    }
} catch (err) {
    console.warn("Firebase initialization warning:", err);
}

export { app, auth, db };

// Helper to construct Firestore document reference for events
export function getEventDocRef(code) {
    if (!db) return null;
    const cleanCode = code.trim().toUpperCase();
    return doc(db, 'artifacts', appId, 'public', 'data', 'events', cleanCode);
}