/**
 * Firebase Auth REST API utility functions
 * Used for server-side operations like creating user accounts
 */

const FIREBASE_API_KEY = 'AIzaSyBAC-tl3pCXeUwGlw13tW2-vpwgsG9_jiI';
const DEFAULT_PASSWORD = 'DeInstallatie1234!!';

interface CreateUserResponse {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
}

/**
 * Creates a new Firebase Authentication user using the REST API
 * @param email Email address for the new user
 * @param password Password for the new user (defaults to standard password)
 * @returns The created user's UID
 */
export async function createFirebaseUser(
  email: string,
  password: string = DEFAULT_PASSWORD
): Promise<string> {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();

    // Handle specific error cases
    if (error.error?.message === 'EMAIL_EXISTS') {
      // User already exists, try to get their UID
      return await getUserIdByEmail(email);
    }

    throw new Error(error.error?.message || 'Failed to create user');
  }

  const data: CreateUserResponse = await response.json();
  return data.localId;
}

/**
 * Gets a user's UID by their email address
 * @param email Email address to look up
 * @returns The user's UID
 */
async function getUserIdByEmail(email: string): Promise<string> {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;

  // We need to sign in to get an ID token first
  const signInEndpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

  // Try signing in with default password
  try {
    const signInResponse = await fetch(signInEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: DEFAULT_PASSWORD,
        returnSecureToken: true,
      }),
    });

    if (signInResponse.ok) {
      const signInData = await signInResponse.json();
      return signInData.localId;
    }
  } catch (e) {
    // Ignore sign-in errors, account might exist with different password
  }

  // If we can't sign in, the account exists but we can't get the UID
  // Return a placeholder to indicate account exists
  throw new Error('ACCOUNT_EXISTS_DIFFERENT_PASSWORD');
}

/**
 * Checks if a Firebase user exists with the given email
 * @param email Email address to check
 * @returns true if user exists, false otherwise
 */
export async function checkUserExists(email: string): Promise<boolean> {
  try {
    await getUserIdByEmail(email);
    return true;
  } catch (error: any) {
    if (error.message === 'ACCOUNT_EXISTS_DIFFERENT_PASSWORD') {
      return true;
    }
    return false;
  }
}
