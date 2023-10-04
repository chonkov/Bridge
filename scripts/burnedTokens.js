const { db } = require("./deployDB.js");
const { collection, onSnapshot } = require("firebase/firestore");

const burnedTokensEvents = [];

const colRef = collection(db, "events");
onSnapshot(colRef, (snapshot) => {
  snapshot.docs.forEach((doc) => {
    const eventType = doc.data().eventType;
    if (eventType === "Burn") {
      burnedTokensEvents.push({ ...doc.data(), id: doc.id });
    }
  });
});

module.exports = { burnedTokensEvents };
