import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration provided in the user request
const firebaseConfig = {
  apiKey: "AIzaSyDcdccUD9eola63kVvcg25Zw3dhAUq4fOg",
  authDomain: "desplin-a1ac8.firebaseapp.com",
  projectId: "desplin-a1ac8",
  storageBucket: "desplin-a1ac8.firebasestorage.app",
  messagingSenderId: "1066919443353",
  appId: "1:1066919443353:web:f09210a0a038533191f108",
  measurementId: "G-2L6KB63YXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
