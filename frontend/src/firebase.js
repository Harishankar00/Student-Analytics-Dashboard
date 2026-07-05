import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCeWVVLUfAw-COGAW6JqGo8UblqBdlQrr0",
  authDomain: "student-progress-analyze-efe6a.firebaseapp.com",
  projectId: "student-progress-analyze-efe6a",
  storageBucket: "student-progress-analyze-efe6a.firebasestorage.app",
  messagingSenderId: "337745363639",
  appId: "1:337745363639:web:2ecda159fc3e47d71ec332",
  measurementId: "G-0QDBRWNWJW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
