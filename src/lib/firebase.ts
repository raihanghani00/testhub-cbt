import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB1FxKkC-3snZ_FzSXo12GgDnovieJSx1M',
  authDomain: 'testhubcbt1.firebaseapp.com',
  projectId: 'testhubcbt1',
  storageBucket: 'testhubcbt1.firebasestorage.app',
  messagingSenderId: '643760735248',
  appId: '1:643760735248:web:9d0def4469409f434bf695',
  measurementId: 'G-5805TTPC9J',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
