import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import './App.css';

const PIE_COLORS = ['#312e81', '#3730a3', '#4338ca', '#4f46e5', '#6366f1', '#818cf8'];

// SVG Icons
const GithubIcon = () => (
  <svg height="24" viewBox="0 0 16 16" width="24" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
  </svg>
);

const LeetcodeIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.939 5.939 0 0 0 1.271 1.543l3.995 3.737.76.653 2.731 2.36a1.271 1.271 0 0 0 1.936-.23 1.289 1.289 0 0 0-.036-1.485c-.019-.026-1.045-1.01-1.045-1.01l-2.653-2.3-1.92-1.655a1.85 1.85 0 0 1-.57-1.04 1.743 1.743 0 0 1 .45-1.39l7.075-7.381c.596-.641.567-1.694-.058-2.315z"></path>
    <path d="M21.173 13.065H11.59a1.152 1.152 0 0 0-1.144 1.152v.002c0 .643.504 1.15 1.144 1.15h9.583a1.15 1.15 0 0 0 1.15-1.152v-.002a1.152 1.152 0 0 0-1.15-1.15Z"></path>
  </svg>
);

const KaggleIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.248l-5.178-6.009-1.448 1.374v4.614c0 .188-.082.269-.246.269H5.666c-.164 0-.246-.081-.246-.269V.269C5.42.082 5.502 0 5.666 0h2.375c.164 0 .246.082.246.269v15.35l6.321-6.196c.117-.117.269-.175.457-.175h3.315c.187 0 .269.07.246.211-.024.046-.059.093-.106.14l-5.711 5.54 5.924 8.52c.07.117.105.187.105.211z"></path>
  </svg>
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState('');

  // Platform Setup & Dashboard states
  const [hasSetup, setHasSetup] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [history, setHistory] = useState([]);
  const [github, setGithub] = useState('');
  const [leetcode, setLeetcode] = useState('');
  const [kaggleUser, setKaggleUser] = useState('');
  const [kaggleKey, setKaggleKey] = useState('');
  const [setupStatus, setSetupStatus] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkStudentSetup(currentUser.email);
      } else {
        setHasSetup(null);
        setDashboardData(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const checkStudentSetup = async (userEmail) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/student/${userEmail}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setHasSetup(true);
        // Fetch historical snapshots for Phase 4
        const histRes = await fetch(`http://127.0.0.1:5000/api/student/${userEmail}/history`);
        if (histRes.ok) {
          const histData = await histRes.json();
          // Format for Recharts using Date
          const formatted = histData.map(snap => {
             const date = new Date(snap.timestamp);
             const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
             return {
                time: dateStr,
                LeetCode: snap.metrics?.leetcode?.totalSolved || 0,
                GitHubRepos: snap.metrics?.github?.repos || 0
             };
          });
          setHistory(formatted);
        }
      } else {
        setHasSetup(false);
      }
    } catch (err) {
      console.error("Failed to check setup:", err);
      setHasSetup(false);
    }
    setLoading(false);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleKaggleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setSetupStatus('Parsing Kaggle API key...');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/kaggle-upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setKaggleUser(data.username);
        setKaggleKey(data.key);
        setSetupStatus('✅ Kaggle API key parsed successfully!');
      } else {
        setSetupStatus('❌ Error parsing Kaggle JSON: ' + data.error);
      }
    } catch (err) {
      setSetupStatus('❌ Kaggle upload failed. Make sure the backend is running.');
    }
  };

  const handlePlatformSetup = async () => {
    setSetupStatus('Linking platforms...');
    try {
      const payload = {
         name: user.email,
         github: github,
         leetcode: leetcode,
         kaggle: kaggleUser,
         kaggle_key: kaggleKey
      };
      
      const res = await fetch('http://127.0.0.1:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
         setSetupStatus('✅ Platforms linked successfully!');
         // Re-check to load dashboard
         setTimeout(() => checkStudentSetup(user.email), 1000);
      } else {
         setSetupStatus('❌ Failed to link platforms.');
      }
    } catch (err) {
      setSetupStatus('❌ Request failed. Make sure the Flask backend is running on port 5000.');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>Loading Dashboard...</div>;
  }

  // --- RENDER AUTH SCREEN ---
  if (!user) {
    return (
      <div className="App" style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', maxWidth: '400px', margin: '4rem auto', textAlign: 'left', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.5rem', color: '#111827' }}>Student Analytics</h1>
        <h2>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
        
        {authError && <p style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem' }}>{authError}</p>}
        
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" style={{ padding: '0.75rem', cursor: 'pointer', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', marginTop: '0.5rem' }}>
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        
        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', textAlign: 'center', color: '#6b7280' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: '500' }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    );
  }

  // --- RENDER SETUP SCREEN ---
  if (hasSetup === false) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'left', background: 'white', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0 }}>Platform Setup</h2>
          <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: '500' }}>
            Sign Out
          </button>
        </div>
        
        <p style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '2rem' }}>
          Welcome, <strong>{user.email}</strong>! Link your developer profiles to generate your analytics dashboard.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>GitHub Username</label>
            <input 
              type="text" 
              value={github} 
              onChange={(e) => setGithub(e.target.value)} 
              placeholder="e.g. torvalds"
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>LeetCode Username</label>
            <input 
              type="text" 
              value={leetcode} 
              onChange={(e) => setLeetcode(e.target.value)} 
              placeholder="e.g. tourist"
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>

            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.9rem' }}>Kaggle Integration (Optional)</label>
              <ol style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.75rem', paddingLeft: '1.25rem', marginBottom: '1rem' }}>
                <li>Go to Kaggle.com -&gt; Settings</li>
                <li>Under the API section, click <strong>Create Legacy API Key</strong></li>
                <li>Upload the downloaded <code>kaggle.json</code> file below</li>
              </ol>
            <input 
              type="file" 
              accept=".json"
              onChange={handleKaggleUpload}
              style={{ fontSize: '0.85rem' }}
            />
            {kaggleUser && <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.75rem', fontWeight: '500' }}>✅ Detected Kaggle Username: {kaggleUser}</p>}
          </div>

          {setupStatus && (
            <div style={{ padding: '1rem', background: setupStatus.includes('✅') ? '#d1fae5' : '#fee2e2', color: setupStatus.includes('✅') ? '#065f46' : '#991b1b', borderRadius: '6px', fontSize: '0.9rem' }}>
              {setupStatus}
            </div>
          )}

          <button 
            onClick={handlePlatformSetup} 
            style={{ padding: '0.75rem', cursor: 'pointer', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 'bold', marginTop: '1rem' }}
          >
            Save & Generate Dashboard
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD SCREEN ---
  const { student, metrics } = dashboardData || {};

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'white', padding: '1.5rem 2rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>Student Dashboard</h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{student?.name}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setHasSetup(false)} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontWeight: '500' }}>
              Edit Profiles
            </button>
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </header>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
          
          {/* GitHub Card */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #111827' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <GithubIcon /> GitHub
            </h2>
            {metrics?.github ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Repos</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>{metrics.github.repos}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Followers</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>{metrics.github.followers}</p>
                  </div>
                  {metrics.github.totalCommits !== undefined && (
                    <>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Commits (Yr)</p>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{metrics.github.totalCommits}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Streak</p>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{metrics.github.currentStreak} 🔥</p>
                      </div>
                    </>
                  )}
                </div>

                {metrics.github.topProjects && metrics.github.topProjects.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#374151', fontWeight: 'bold' }}>Top Projects</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {metrics.github.topProjects.map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', padding: '0.75rem', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                           <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h4>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                             <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{width: '8px', height: '8px', borderRadius: '50%', background: p.color || '#ccc'}}></span> {p.language}</span>
                             <span>⭐ {p.stars}</span>
                           </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontStyle: 'italic' }}>{student?.github ? 'Loading data...' : 'Not Connected'}</p>
            )}
          </div>

          {/* LeetCode Card */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <LeetcodeIcon /> LeetCode
            </h2>
            {metrics?.leetcode ? (
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Solved</p>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '3rem', fontWeight: 'bold', color: '#111827', lineHeight: '1' }}>{metrics.leetcode.totalSolved}</p>
                </div>
                
                {/* Visual Difficulty Breakdown */}
                <div style={{ width: '150px', height: '150px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Easy', value: metrics.leetcode.easy, color: '#10b981' },
                          { name: 'Medium', value: metrics.leetcode.medium, color: '#f59e0b' },
                          { name: 'Hard', value: metrics.leetcode.hard, color: '#ef4444' }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {
                          [{ color: '#10b981' }, { color: '#f59e0b' }, { color: '#ef4444' }].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))
                        }
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Text Tags */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', minWidth: '100px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#065f46', background: '#d1fae5', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: '600' }}>
                    <span>Easy</span><span>{metrics.leetcode.easy}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#92400e', background: '#fef3c7', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: '600' }}>
                    <span>Med</span><span>{metrics.leetcode.medium}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#991b1b', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: '600' }}>
                    <span>Hard</span><span>{metrics.leetcode.hard}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontStyle: 'italic' }}>{student?.leetcode ? 'Loading data...' : 'Not Connected'}</p>
            )}
          </div>

          {/* Kaggle Card */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <KaggleIcon /> Kaggle
            </h2>
            {metrics?.kaggle && metrics.kaggle.status === 'Linked' ? (
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datasets</p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>{metrics.kaggle.datasets}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notebooks</p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>{metrics.kaggle.notebooks || 0}</p>
                </div>
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontStyle: 'italic' }}>{student?.kaggle ? 'Loading data...' : 'Not Connected'}</p>
            )}
          </div>

        </div>
        
        {/* Analytics Row: Languages and History */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
          
          {/* GitHub Languages Graph */}
          {metrics?.github?.languages && metrics.github.languages.length > 0 && (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #8b5cf6' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#374151' }}>Languages Used (Across Repos)</h3>
              <div style={{ height: 250, width: '100%' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={metrics.github.languages.slice(0, 5)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {metrics.github.languages.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Historical Timeline - GitHub */}
          {history.length > 0 && (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #111827' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#374151' }}>GitHub Growth (Repos)</h3>
              <div style={{ height: 250, width: '100%' }}>
                <ResponsiveContainer>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorGitHub" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#111827" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="GitHubRepos" name="Repositories" stroke="#111827" strokeWidth={3} fillOpacity={1} fill="url(#colorGitHub)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Historical Timeline - LeetCode */}
          {history.length > 0 && (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #f59e0b' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#374151' }}>LeetCode Growth (Solves)</h3>
              <div style={{ height: 250, width: '100%' }}>
                <ResponsiveContainer>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorLeetCode" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="LeetCode" name="Total Solved" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorLeetCode)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
        
        {/* Background Sync Notice */}
        {(!metrics?.github || !metrics?.leetcode) && (
          <p style={{ textAlign: 'center', marginTop: '2rem', color: '#6b7280', fontSize: '0.9rem' }}>
            ⏳ The backend snapshot worker is fetching your data... refresh in a few seconds.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
