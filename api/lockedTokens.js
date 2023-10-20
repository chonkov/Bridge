const { db } = require("../event-listener/deployDB.js");
const {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} = require("firebase/firestore");

const colRef = collection(db, "events");
const lockedTokensEvents = [];

onSnapshot(colRef, async () => {
  lockedTokensEvents.length = 0;

  const q = query(
    colRef,
    where("eventType", "==", "Lock"),
    where("isClaimed", "==", false)
  );
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach((doc) => {
    lockedTokensEvents.push({ ...doc.data(), id: doc.id });
  });
});

module.exports = { lockedTokensEvents };
