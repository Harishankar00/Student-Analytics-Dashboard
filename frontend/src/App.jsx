import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="App" style={{ padding: '2rem', fontFamily: 'Inter, sans-serif' }}>
      <h1>Student Analytics Dashboard</h1>
      
      {!user ? (
        <div style={{ maxWidth: '300px', margin: '0 auto', textAlign: 'left' }}>
          <h2>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
          
          {error && <p style={{ color: 'red', fontSize: '0.9rem' }}>{error}</p>}
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </div>
            <div>
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </div>
            <button type="submit" style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px' }}>
              {isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
          
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      ) : (
        <div>
          <p>Welcome, {user.email}!</p>
          <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
