import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBPXKFLf1xPdo9H9Bw8w8KAPFGY0dYH-04',
  authDomain: 'zonestream-61ffe.firebaseapp.com',
  projectId: 'zonestream-61ffe',
  storageBucket: 'zonestream-61ffe.firebasestorage.app',
  messagingSenderId: '752723113015',
  appId: '1:752723113015:web:b79e8b4c354ed13d65bbb2',
  measurementId: 'G-KT5ZM623V5',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
