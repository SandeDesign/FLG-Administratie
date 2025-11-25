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

interface CreateUserResult {
  success: boolean;
  alreadyExists: boolean;
  uid?: string;
  error?: string;
}

/**
 * Creates a new Firebase Authentication user using the REST API
 * @param email Email address for the new user
 * @param password Password for the new user (defaults to standard password)
 * @returns Object with success status and UID if created
 */
export async function createFirebaseUser(
  email: string,
  password: string = DEFAULT_PASSWORD
): Promise<CreateUserResult> {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;

  try {
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

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (data.error?.message === 'EMAIL_EXISTS') {
        return {
          success: true,
          alreadyExists: true,
        };
      }

      return {
        success: false,
        alreadyExists: false,
        error: data.error?.message || 'Failed to create user',
      };
    }

    return {
      success: true,
      alreadyExists: false,
      uid: data.localId,
    };
  } catch (error: any) {
    return {
      success: false,
      alreadyExists: false,
      error: error.message || 'Network error',
    };
  }
}
