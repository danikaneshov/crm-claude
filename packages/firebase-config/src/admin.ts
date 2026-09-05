// ==========================================
// Firebase Admin SDK — Server-side
// ==========================================
// Used by: API endpoints (Vercel Functions)
// Authentication: Service Account (env vars)

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;
let auth: Auth;

/**
 * Initialize Firebase Admin SDK (singleton).
 * Uses service account credentials from environment variables.
 */
export function getAdminApp(): App {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error(
        'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
      );
    }

    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  } else if (!app) {
    app = getApps()[0];
  }

  return app;
}

/**
 * Get Firestore instance (singleton).
 */
export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getAdminApp());
  }
  return db;
}

/**
 * Get Firebase Auth instance (singleton).
 */
export function getAdminAuth(): Auth {
  if (!auth) {
    auth = getAuth(getAdminApp());
  }
  return auth;
}
