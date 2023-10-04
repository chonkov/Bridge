const { db } = require("./deployDB.js");
const { collection, onSnapshot } = require("firebase/firestore");

const events = [];

const colRef = collection(db, "events");
onSnapshot(colRef, (snapshot) => {
  snapshot.docs.forEach((doc) => {
    events.push({ ...doc.data(), id: doc.id });
  });
  console.log(events);
});

module.exports = { events };
