import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Cole aqui o firebaseConfig do Console do Firebase:
// Configurações do projeto > Seus aplicativos > app Web
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCtMC4QgDNpToEcPbEI_PRmWXCirxaPH5g",
  authDomain: "calculoimc-cee3e.firebaseapp.com",
  projectId: "calculoimc-cee3e",
  storageBucket: "calculoimc-cee3e.firebasestorage.app",
  messagingSenderId: "971742216838",
  appId: "1:971742216838:web:cece16fc393d94c4618707",
  measurementId: "G-N65G67V1DH"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
