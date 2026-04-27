/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Firebase Initialization
   ───────────────────────────────────────────────────────────────────
   Depends on: (Firebase SDK from CDN)
   Originally lines 11412–11564 of index.html
═══════════════════════════════════════════════════════════════════ */

// Load Firebase scripts with fallback support
  (function() {
    const SOURCES = [
      'https://www.gstatic.com/firebasejs/8.10.1/',
      'https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/',
      'https://cdn.jsdelivr.net/npm/firebase@8.10.1/'
    ];
    const FILES = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'];

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve(src);
        s.onerror = () => reject(src);
        document.head.appendChild(s);
      });
    }

    async function loadWithFallback(file) {
      for (const base of SOURCES) {
        try {
          await loadScript(base + file);
          return true;
        } catch (e) {
          window.Logger?.warn?.('Failed:', base + file);
        }
      }
      return false;
    }

    (async function() {
      for (const file of FILES) {
        const ok = await loadWithFallback(file);
        if (!ok) {
          window.Logger?.error?.('Could not load ' + file + ' from any CDN');
          return;
        }
      }

      // All loaded, now initialize
      try {
        const firebaseConfig = {
          apiKey: "AIzaSyB2GzbIFGbvb6keWuBu5XsYVXy-qfeE6Og",
          authDomain: "tadbeer-f76e4.firebaseapp.com",
          projectId: "tadbeer-f76e4",
          storageBucket: "tadbeer-f76e4.firebasestorage.app",
          messagingSenderId: "721485864761",
          appId: "1:721485864761:web:b45d21ec24b6fc090652e8"
        };

        if (typeof firebase === 'undefined') {
          window.Logger?.error?.('Firebase object missing after script load');
          return;
        }

        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        window.FB = {
          auth, db,
          signIn: (a, email, pass) => auth.signInWithEmailAndPassword(email, pass),
          signUp: (a, email, pass) => auth.createUserWithEmailAndPassword(email, pass),
          signOut: (a) => auth.signOut(),
          onAuthStateChanged: (a, cb) => auth.onAuthStateChanged(cb),
          googleProvider: new firebase.auth.GoogleAuthProvider(),
          signInWithPopup: (a, provider) => auth.signInWithPopup(provider),
          sendPasswordResetEmail: (a, email) => auth.sendPasswordResetEmail(email),
          updateProfile: (user, data) => user.updateProfile(data),
          doc: function() {
            // يدعم أنماط متعددة:
            //   doc(db, 'users', uid)                          → /users/uid
            //   doc(db, 'users', uid, 'friends', fid)          → /users/uid/friends/fid
            //   doc(db, 'chats', cid, 'messages', mid)         → /chats/cid/messages/mid
            //   doc(collRef)                                   → مرجع جاهز
            //   doc(db, pathSegment)                           → db.doc(pathSegment)
            var args = Array.prototype.slice.call(arguments);
            if (args.length === 1) return args[0];
            if (args.length === 2) {
              // doc(db, 'collection/id') أو doc(collRef, 'id')
              if (args[0] && typeof args[0].doc === 'function') return args[0].doc(args[1]);
              return args[0];
            }
            // 3+ وسائط: (db, coll1, id1, coll2, id2, ...)
            var db = args[0];
            var ref = db;
            for (var i = 1; i < args.length; i += 2) {
              var coll = args[i];
              var id = args[i + 1];
              if (ref.collection) {
                ref = ref.collection(coll);
              } else {
                return null;
              }
              if (id != null) {
                ref = ref.doc(id);
              }
            }
            return ref;
          },
          setDoc: (docRef, data, options) => {
            if (options && options.merge) {
              return docRef.set(data, { merge: true });
            }
            return docRef.set(data);
          },
          getDoc: async (docRef) => {
            const snap = await docRef.get();
            return {
              exists: () => snap.exists,
              data: () => snap.data(),
              id: snap.id,
              ref: snap.ref
            };
          },
          updateDoc: (docRef, data) => docRef.update(data),
          deleteDoc: (docRef) => docRef.delete(),
          collection: function() {
            // يدعم:
            //   collection(db, 'users')                        → /users
            //   collection(db, 'users', uid, 'friends')        → /users/uid/friends
            //   collection(db, 'chats', cid, 'messages')       → /chats/cid/messages
            var args = Array.prototype.slice.call(arguments);
            if (args.length < 2) return args[0];
            var ref = args[0];
            for (var i = 1; i < args.length; i += 2) {
              var coll = args[i];
              var id = args[i + 1];
              if (ref.collection) ref = ref.collection(coll);
              if (id != null && ref.doc) ref = ref.doc(id);
            }
            return ref;
          },
          query: (collRef, ...filters) => {
            let q = collRef;
            filters.forEach(f => { if (f && f._apply) q = f._apply(q); });
            return q;
          },
          where: (field, op, val) => ({ _apply: (q) => q.where(field, op, val) }),
          orderBy: (field, dir) => ({ _apply: (q) => q.orderBy(field, dir) }),
          limit: (n) => ({ _apply: (q) => q.limit(n) }),
          getDocs: (q) => q.get(),
          onSnapshot: (q, cb, errCb) => q.onSnapshot(cb, errCb),
          addDoc: (collRef, data) => collRef.add(data),
          writeBatch: () => db.batch(),
          serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp(),
          ready: true
        };

        window.dispatchEvent(new CustomEvent('fb-ready'));
        } catch (err) {
        window.Logger?.error?.('Firebase init error:', err.message || err);
      }
    })();
  })();
