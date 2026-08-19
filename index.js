const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']; // JS getDay() order

function currentTimeParts(now){
  let hour24 = now.getHours();
  const minute = now.getMinutes() - (now.getMinutes() % 15); // matches 15-min steps used in the app
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12; if(hour12 === 0) hour12 = 12;
  return {
    hourStr: String(hour12).padStart(2, '0'),
    minStr: String(minute).padStart(2, '0'),
    ampm,
    dayKey: DAY_KEYS[now.getDay()]
  };
}

async function sendToMatchingRoutines(field, message) {
  const { hourStr, minStr, ampm, dayKey } = currentTimeParts(new Date());

  const snap = await db.collectionGroup('routine')
    .where(`${field}Hour`, '==', hourStr)
    .where(`${field}Min`, '==', minStr)
    .where(`${field}Ampm`, '==', ampm)
    .where('days', 'array-contains', dayKey)
    .get();

  if (snap.empty) return;

  const sends = [];
  for (const docSnap of snap.docs) {
    const routine = docSnap.data();
    const userRef = docSnap.ref.parent.parent; // users/{uid}
    if (!userRef) continue;

    const tokensSnap = await userRef.collection('fcmTokens').get();
    if (tokensSnap.empty) continue;
    const tokens = tokensSnap.docs.map(d => d.id);

    const body = message(routine.subject);
    const msg = {
      notification: { title: 'StudyMate', body },
      tokens
    };
    sends.push(
      admin.messaging().sendEachForMulticast(msg).then(async (resp) => {
        const toDelete = [];
        resp.responses.forEach((r, i) => {
          if (!r.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error?.code)) {
            toDelete.push(tokens[i]);
          }
        });
        await Promise.all(toDelete.map(t => userRef.collection('fcmTokens').doc(t).delete()));
      })
    );
  }
  await Promise.all(sends);
}

exports.checkRoutineAndNotify = functions
  .region('asia-southeast1') // change if your project's functions region differs
  .pubsub.schedule('every 1 minutes')
  .timeZone('Asia/Dhaka')
  .onRun(async () => {
    await sendToMatchingRoutines('start', (subject) => `${subject} পড়ার সময় শুরু! 📖`);
    await sendToMatchingRoutines('end', (subject) => `${subject} এর সময় শেষ!`);
    return null;
  });
