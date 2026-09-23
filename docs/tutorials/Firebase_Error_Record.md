# Firebase Error Record

## Firestore user profile was not created

**Symptom:** Authentication worked, but Firestore's **Data** tab showed no `users/{uid}` document after signing out and back in.

**Cause:** During `npx firebase init firestore`, `firestore.rules` was overwritten with the Console's default rule:

```txt
match /{document=**} {
  allow read, write: if false;
}
```

This denied the app permission to create the signed-in user's profile. The deny-all rule was then deployed successfully, so Firestore stayed empty.

## Fix performed

1. Restored `Project02/firestore.rules` with owner-only access for:
   - `users/{userId}`
   - `users/{userId}/configs/{configId}`
2. Deployed the corrected rules:

```powershell
npx firebase deploy --only firestore:rules
```

3. Confirmed the CLI compiled, uploaded, and released the corrected rules.
4. Restarted the app and signed in again so `ensureUserProfile()` could write `users/{uid}`.

## Verification

In Firebase Console, check:

```text
Firestore Database → Data → users → {signed-in UID}
```

The document should contain the user's email, display name/photo when available, and `lastLoginAt`.

## Prevention

When `firebase init firestore` asks whether to overwrite an existing `firestore.rules`, choose **No** unless you intentionally want the Console version.
