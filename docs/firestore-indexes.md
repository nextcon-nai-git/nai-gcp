# Deploying Firestore indexes

Composite indexes are defined in the repository-level `firestore.indexes.json` and referenced by `firebase.json`. Deploy them with:

```sh
npx firebase-tools deploy --only firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
```

The production deployment workflow deploys the configured indexes together with Firestore rules after validation. New compound queries should add their required indexes here before deployment.
