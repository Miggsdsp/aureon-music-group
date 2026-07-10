# Phase 2 — Firebase Connection and Admin Control Center

The Aureon website is connected to Firebase Authentication, Firestore and Storage.

## First administrator activation

1. In Firebase Console, open Authentication > Users.
2. Add the owner email and a strong temporary password.
3. Copy the new user's UID.
4. Open Firestore Database and create collection `admins`.
5. Create a document whose document ID is exactly the Authentication UID.
6. Add fields:
   - `email` (string): owner email
   - `name` (string): Miguel Pinho
   - `role` (string): superAdmin
   - `active` (boolean): true
7. Open `https://aureonmusicgroup.com/admin/login` and sign in.

## Deploy security rules

The repository includes `firestore.rules`, `storage.rules` and `firebase.json`.
Deploy them with Firebase CLI from a trusted local machine:

```bash
npm install -g firebase-tools
firebase login
firebase use aureon-music-group
firebase deploy --only firestore:rules,storage
```

Do not make the `admins` collection publicly writable. Additional admin users must be created by a future secure server-side admin-user workflow.

## Admin routes included

- `/admin/login`
- `/admin`
- `/admin/artists`
- `/admin/albums`
- `/admin/songs`
- `/admin/videos`
- `/admin/news`
- `/admin/products`
- `/admin/orders`
- `/admin/pages`
- `/admin/analytics`
- `/admin/settings`

Phase 3 will replace the connected module placeholders with full Firestore CRUD forms, media uploads and audit logging.
