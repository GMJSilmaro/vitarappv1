import { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { SessionManager } from '@/utils/sessionManager';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const [workerId, setWorkerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
 // const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
  let activityTimer;
  const router = useRouter();

  // Add this useEffect to check cookies on mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        // Check for existing session
        const session = Cookies.get('session');
        const email = Cookies.get('email');
        const userRole = Cookies.get('userRole');
        const workerId = Cookies.get('workerId');
        const isAdmin = Cookies.get('isAdmin') === 'true';

        if (session && email) {
          setCurrentUser({ email });
          setUserRole(userRole);
          setWorkerId(workerId);
          setIsAdmin(isAdmin);
          
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Sign in with session management
  const signIn = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        await Swal.fire({
          icon: 'error',
          title: 'Authentication Failed',
          text: data.message || 'Failed to sign in. Please try again.',
          confirmButtonColor: '#1e40a6'
        });
        return false;
      }

      // Set user state based on the response
      setCurrentUser({ email });
      setIsAdmin(data.user.isAdmin);
      setUserRole(data.user.userRole);
      setWorkerId(data.user.workerId);

      // Store auth state in cookies
      Cookies.set('session', 'true', { secure: true });
      Cookies.set('email', email, { secure: true });
      Cookies.set('userRole', data.user.userRole, { secure: true });
      Cookies.set('workerId', data.user.workerId, { secure: true });
      Cookies.set('isAdmin', data.user.isAdmin, { secure: true });

      // Redirect based on user type
      if (data.user.isAdmin) {
        router.push('/');
      } else {
        router.push(`/dashboard/user/${data.user.workerId}`);
      }

      return true;
    } catch (error) {
      console.error('Sign in error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Sign In Error',
        text: error.message || 'An unexpected error occurred. Please try again.',
        confirmButtonColor: '#1e40a6'
      });
      return false;
    }
  };

  // Sign out with session cleanup
  const signOut = async () => {
    try {
      // Call logout API endpoint
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: currentUser?.email })
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      if (currentUser) {
        await SessionManager.endSession(currentUser.email);
      }
      
      // Clear all cookies
      Cookies.remove('session');
      Cookies.remove('email');
      Cookies.remove('userRole');
      Cookies.remove('workerId');
      Cookies.remove('isAdmin');

      setCurrentUser(null);
      setUserRole(null);
      setWorkerId(null);
      setIsAdmin(null);

      // Show success message
      await Swal.fire({
        icon: 'success',
        title: 'Signed Out Successfully',
        text: 'You have been safely logged out.',
        timer: 2000,
        showConfirmButton: false
      });

      router.push('/authentication/sign-in');
    } catch (error) {
      console.error('Sign out error:', error);
      // Show error message
      await Swal.fire({
        icon: 'error',
        title: 'Sign Out Error',
        text: 'There was a problem signing you out. Please try again.',
        confirmButtonColor: '#1e40a6'
      });
      throw error;
    }
  };

  // Handle user activity
  const handleUserActivity = () => {
    if (currentUser) {
      SessionManager.updateLastActive(currentUser.email);
      clearTimeout(activityTimer);
     // activityTimer = setTimeout(handleIdle, IDLE_TIMEOUT);
    }
  };

  // Handle idle timeout
  const handleIdle = async () => {
    if (currentUser) {
      await SessionManager.endSession(currentUser.email);
      await Swal.fire({
        icon: 'warning',
        title: 'Session Expired',
        text: 'Your session has expired due to inactivity. Please sign in again.',
        confirmButtonColor: '#1e40a6',
        timer: 5000,
        timerProgressBar: true,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      await signOut();
    }
  };

  // Set up activity listeners
  useEffect(() => {
    if (currentUser) {
      window.addEventListener('mousemove', handleUserActivity);
      window.addEventListener('keydown', handleUserActivity);
      //activityTimer = setTimeout(handleIdle, IDLE_TIMEOUT);
    }

    return () => {
      if (currentUser) {
        SessionManager.endSession(currentUser.email);
      }
      clearTimeout(activityTimer);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [currentUser]);

  // Initialize loading state
  useEffect(() => {
    setLoading(false);
  }, []);

  const value = {
    currentUser,
    userRole,
    workerId,
    isAdmin,
    loading,
    error,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : <div>Loading...</div>}
    </AuthContext.Provider>
  );
}