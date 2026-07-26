import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDquliZrgOXZCNSqLSWiKMcvasRBIkPnZ4",
  authDomain: "finanzashrz-3efac.firebaseapp.com",
  projectId: "finanzashrz-3efac",
  storageBucket: "finanzashrz-3efac.firebasestorage.app",
  messagingSenderId: "3856315799",
  appId: "1:3856315799:web:f219c89d73b73999ee00d2",
  measurementId: "G-6ZCBEJ4DTN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
