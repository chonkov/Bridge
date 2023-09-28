const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyCa9IPhOXinFWPcsee5BEHQcRJN-BXutfE",
  authDomain: "bridge-d2101.firebaseapp.com",
  projectId: "bridge-d2101",
  storageBucket: "bridge-d2101.appspot.com",
  messagingSenderId: "90712161589",
  appId: "1:90712161589:web:adb078a0bc31cda1ffe07c",
  measurementId: "G-X6T0BF8L5W",
};

// Initialize Firebase
initializeApp(firebaseConfig);

const db = getFirestore();

module.exports = db;
