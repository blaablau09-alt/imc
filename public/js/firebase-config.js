import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Cole aqui o firebaseConfig do Console do Firebase:
// Configurações do projeto > Seus aplicativos > app Web
const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "calculoimc.firebaseapp.com",
  projectId: "calculoimc",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
