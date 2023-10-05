const { db } = require("./deployDB.js");
const { collection, onSnapshot, where } = require("firebase/firestore");

const lockedTokensEvents = [];

const colRef = collection(
  db,
  "events"
  // where("eventType", "==", "Lock"),
  // where("isClaimed", "==", false)
);
onSnapshot(colRef, (snapshot) => {
  snapshot.docs.forEach((doc) => {
    const eventType = doc.data().eventType;
    const isClaimed = doc.data().isClaimed;
    if (eventType === "Lock" && !isClaimed) {
      lockedTokensEvents.push({ ...doc.data(), id: doc.id });
    }
  });
});

module.exports = { lockedTokensEvents };
