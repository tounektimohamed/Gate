import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, query, limit, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEMO_USERS, DEMO_INDIVIDUALS, classifyUnit, generatePinCode } from './utils';

export async function isDatabaseEmpty(): Promise<boolean> {
  try {
    const q = query(collection(db, 'users'), limit(1));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error('Error checking if db is empty:', error);
    return true; // Assume empty or needs initialization
  }
}

export async function seedDatabase(onProgress: (message: string) => void): Promise<void> {
  try {
    onProgress('جاري فحص الحسابات...');
    
    // 1. Create system users
    for (const demoUser of DEMO_USERS) {
      onProgress(`جاري تأسيس حساب: ${demoUser.name} (${demoUser.role})...`);
      let uid = '';
      try {
        // Try to create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, demoUser.email, demoUser.password);
        uid = userCredential.user.uid;
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          // If already exists, try to log in to get the UID, or just use a synthetic UID/overwrite.
          // Since we can't get UID easily without login, let's login with that user
          try {
            const userCredential = await signInWithEmailAndPassword(auth, demoUser.email, demoUser.password);
            uid = userCredential.user.uid;
          } catch (loginError: any) {
            if (loginError.code === 'auth/configuration-not-found') {
              console.warn(`Firebase Auth configuration-not-found when logging in demo user ${demoUser.email}, using local synthetic ID fallback.`);
            } else {
              console.error('Could not log in to existing user:', loginError);
            }
            // Fallback: use a deterministic ID or skip auth creation but we need Firestore record
            uid = demoUser.role + '_uid';
          }
        } else {
          if (error.code === 'auth/configuration-not-found') {
            console.warn(`Firebase Auth configuration-not-found when creating demo user ${demoUser.email}, using local synthetic ID fallback.`);
          } else {
            console.error(`Error creating auth user ${demoUser.email}:`, error);
          }
          uid = demoUser.role + '_uid';
        }
      }

      if (uid) {
        // Save user details to Firestore
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
          id: uid,
          email: demoUser.email,
          role: demoUser.role,
          name: demoUser.name,
          phone: demoUser.phone,
          ...(demoUser.unit ? { unit: demoUser.unit } : {}),
          createdAt: new Date()
        }, { merge: true });
      }
    }

    onProgress('جاري تسجيل الخروج لإتمام التأسيس...');
    await signOut(auth);

    // 2. Create individuals
    onProgress('جاري بذر بيانات الأفراد والطلائع كشفياً...');
    const batch = writeBatch(db);
    const existingPins: string[] = [];

    // Map system users (leaders) to individuals so they can also log exits
    const leadersToIndividuals = DEMO_USERS
      .filter(u => u.role !== 'gatekeeper')
      .map(u => ({
        fullName: u.name,
        birthDate: '1995-01-01',
        gender: 'male' as const,
        unit: 'قادة' as const
      }));

    const allIndividualsToSeed = [...DEMO_INDIVIDUALS];
    leadersToIndividuals.forEach(leaderInd => {
      if (!allIndividualsToSeed.some(ind => ind.fullName === leaderInd.fullName)) {
        allIndividualsToSeed.push({
          fullName: leaderInd.fullName,
          birthDate: leaderInd.birthDate,
          gender: leaderInd.gender
        });
      }
    });

    for (const item of allIndividualsToSeed) {
      const pinCode = generatePinCode(existingPins);
      existingPins.push(pinCode);
      const unit = classifyUnit(item.birthDate, item.gender);
      
      const individualRef = doc(collection(db, 'individuals'));
      batch.set(individualRef, {
        id: individualRef.id,
        fullName: item.fullName,
        birthDate: item.birthDate,
        gender: item.gender,
        unit: unit,
        pinCode: pinCode,
        status: 'inside', // default inside
        currentMovementId: null,
        createdAt: new Date()
      });
    }

    await batch.commit();
    onProgress('تم بذر البيانات وتجهيز النظام بنجاح!');
  } catch (error: any) {
    console.error('Error seeding database:', error);
    throw new Error(`فشل بذر البيانات: ${error.message || error}`);
  }
}
