const { db } = require("./deployDB.js");
const {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} = require("firebase/firestore");

const colRef = collection(db, "events");
const burnedTokensEvents = [];

onSnapshot(colRef, async () => {
  burnedTokensEvents.length = 0;

  const q = query(
    colRef,
    where("eventType", "==", "Burn"),
    where("isReleased", "==", false)
  );
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach((doc) => {
    burnedTokensEvents.push({ ...doc.data(), id: doc.id });
  });
});

module.exports = { burnedTokensEvents };
