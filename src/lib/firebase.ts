import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyAPuIIeKCBmW0hQtN6Sw7pCxtXXvWgsW2Y",
  authDomain: "finance-api-2a3f5.firebaseapp.com",
  projectId: "finance-api-2a3f5",
  storageBucket: "finance-api-2a3f5.firebasestorage.app",
  messagingSenderId: "360869318933",
  appId: "1:360869318933:web:0faaea377f942b59be191c",
  measurementId: "G-6LCENNGGSS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);