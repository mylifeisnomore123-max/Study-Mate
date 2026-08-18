const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']; // JS getDay() order

exports.checkRoutineAndNotify = functions
  .region('asia-southeast1') // change if your project's functions region differs
  .pubsub.schedule('every 1 minutes')
  .timeZone('Asia/Dhaka')
  .onRun(async () => {
    const now = new Date();
    let hour24 = now.getHours();
    const min = String(now.getMinutes() - (now.getMinutes() % 15)).padStart(2, '0'); // matches 15-min steps used in the app
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const hourStr = String(hour12).padStart(2, '0');
    const todayKey = DAY_KEYS[now.getDay()];

    const snap = await db.collectionGroup('routine')
      .where('hour', '==', hourStr)
      .where('min', '==', min)
      .where('ampm', '==', ampm)
      .where('days', 'array-contains', todayKey)
      .get();

    if (snap.empty) {
      console.log('No routines matched at', hourStr, min, ampm, todayKey);
      return null;
    }

    const sends = [];
    for (const docSnap of snap.docs) {
      const routine = docSnap.data();
      const userRef = docSnap.ref.parent.parent; // users/{uid}
      if (!userRef) continue;

      const tokensSnap = await userRef.collection('fcmTokens').get();
      if (tokensSnap.empty) continue;
      const tokens = tokensSnap.docs.map(d => d.id);

      const message = {
        notification: {
          title: 'পড়ার সময় হয়ে গেছে 📖',
          body: `${routine.subject} পড়ার সময়। শুরু করে দাও!`
        },
        tokens
      };
      sends.push(
        admin.messaging().sendEachForMulticast(message).then(async (resp) => {
          // clean up invalid/expired tokens
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
    return null;
  });
