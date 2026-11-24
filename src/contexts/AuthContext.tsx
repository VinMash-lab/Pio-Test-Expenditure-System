import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import {
  checkIsAdminUser,
  setCloudSyncContext,
  subscribeFirestoreErrors,
  syncAuthenticatedUserProfile,
  FirestoreErrorInfo,
} from '../services/firestoreSync';
import { DatabaseService } from '../services/db';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isSyncingCloud: boolean;
  authError: string | null;
  cloudError: FirestoreErrorInfo | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
  clearCloudError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; onCloudSynced?: () => void }> = ({
  children,
  onCloudSynced,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    const unsubErrors = subscribeFirestoreErrors((errInfo) => {
      setCloudError(errInfo);
    });
    return unsubErrors;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);

      if (!firebaseUser) {
        setCloudSyncContext(null);
        setUser(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      setUser(firebaseUser);
      setIsSyncingCloud(true);

      try {
        const adminFlag = await checkIsAdminUser(
          firebaseUser.uid,
          firebaseUser.email,
          firebaseUser.emailVerified
        );
        setIsAdmin(adminFlag);
        setCloudSyncContext({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          isAdmin: adminFlag,
        });

        if (firebaseUser.emailVerified && firebaseUser.email) {
          await syncAuthenticatedUserProfile({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            avatarUrl: firebaseUser.photoURL,
            isAdmin: adminFlag,
          });
          await DatabaseService.syncWithCloud();
          onCloudSynced?.();
        }
      } catch (err: any) {
        console.error('Firebase auth/sync initialization error:', err);
        setAuthError(err?.message || 'Unable to synchronize user workspace with Firestore.');
      } finally {
        setIsSyncingCloud(false);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing Google authentication.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Browser blocked the Google sign-in popup. Please allow popups for this site and try again.');
      } else {
        setAuthError(err?.message || 'Google Sign-In failed. Please try again.');
      }
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    setCloudError(null);
    setCloudSyncContext(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAdmin,
        isSyncingCloud,
        authError,
        cloudError,
        signInWithGoogle,
        signOutUser,
        clearAuthError: () => setAuthError(null),
        clearCloudError: () => setCloudError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return ctx;
}
