import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
export const db = getFirestore(app);
