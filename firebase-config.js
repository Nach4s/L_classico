// ===================================
// FIREBASE CONFIGURATION
// L Clasico - Football League Website
// ===================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBjyswqlqf39MYTjcrENHrsJPwRIFlMnoI",
    authDomain: "l-clasico.firebaseapp.com",
    projectId: "l-clasico",
    storageBucket: "l-clasico.firebasestorage.app",
    messagingSenderId: "487830760301",
    appId: "1:487830760301:web:bdb5dd5e0cbf1b8b938864"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);

// Инициализация Firestore
const db = firebase.firestore();

// Инициализация Firebase Auth
const auth = firebase.auth();

// Включение offline persistence для работы без интернета
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Persistence failed: Multiple tabs open');
        } else if (err.code == 'unimplemented') {
            console.warn('Persistence not available in this browser');
        }
    });

// Экспорт для использования в app.js
window.db = db;
window.auth = auth;
