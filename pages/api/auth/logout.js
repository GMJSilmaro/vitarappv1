import { getAuth } from 'firebase/auth';
import { app } from '@/firebase';
import { SessionManager } from '@/utils/sessionManager';

const COOKIE_OPTIONS = {
  path: '/',
  secure: true,
  sameSite: 'lax',
  httpOnly: true,
  expires: new Date(0)
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = getAuth(app);

  try {
    // Get user email from request cookies or body
    const userEmail = req.cookies.email || req.body.email;
    
    // End user session in Firestore
    if (userEmail) {
      await SessionManager.endSession(userEmail);
    }

    // Sign out from Firebase
    await auth.signOut();

    // List of all cookies to clear
    const cookiesToClear = [
      'customToken',
      'email',
      'isAdmin',
      'uid',
      'workerId'
    ];

    // Clear all cookies with consistent options
    const cookieStrings = cookiesToClear.map(cookieName => {
      const options = {
        ...COOKIE_OPTIONS,
        httpOnly: ['customToken'].includes(cookieName)
      };

      return `${cookieName}=; Path=/; ${options.httpOnly ? 'HttpOnly;' : ''} Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });

    res.setHeader('Set-Cookie', cookieStrings);

    return res.status(200).json({ 
      message: 'Logout successful',
      cleared: cookiesToClear,
      sessionEnded: !!userEmail
    });
  } catch (error) {
    console.error('Logout error:', error);
  
    // Attempt to clear cookies even if logout fails
    const emergencyCookieClear = [
      'customToken=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ];
    res.setHeader('Set-Cookie', emergencyCookieClear);

    // Try to end session even if other parts fail
    try {
      const userEmail = req.cookies.email || req.body.email;
      if (userEmail) {
        await SessionManager.endSession(userEmail);
      }
    } catch (sessionError) {
      console.error('Session cleanup error:', sessionError);
    }

    return res.status(500).json({ 
      message: 'Partial logout completed with errors', 
      error: error.message,
      sessionCleanupAttempted: true
    });
  }
}
