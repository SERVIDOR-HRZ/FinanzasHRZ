import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAi6HCy4Ci5L94YVZxxOXHkrJxkDPljnCA",
    authDomain: "finanzashrz.firebaseapp.com",
    projectId: "finanzashrz",
    storageBucket: "finanzashrz.firebasestorage.app",
    messagingSenderId: "1064703862612",
    appId: "1:1064703862612:web:535b29d8e966fc07f5cac1",
    measurementId: "G-DQFGVBXE1R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
export const IMGBB_API_KEY = 'c55ec5f8b5911300d4f514464a765dc7';
