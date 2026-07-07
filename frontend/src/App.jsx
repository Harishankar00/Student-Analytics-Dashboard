import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
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
  
  // Goal Tracking states
  const [goals, setGoals] = useState([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('leetcode_total');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalStatusMsg, setGoalStatusMsg] = useState('');

  // Admin View states
  const [isAdminView, setIsAdminView] = useState(false);
  const [cohortData, setCohortData] = useState(null);
  const [studentsList, setStudentsList] = useState([]);
  const [selectedCompareEmails, setSelectedCompareEmails] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const handleToggleSelectStudent = (email) => {
    setSelectedCompareEmails(prev => {
      if (prev.includes(email)) {
        return prev.filter(e => e !== email);
      } else {
        return [...prev, email];
      }
    });
  };

  const handleCompareSelected = async () => {
    if (selectedCompareEmails.length < 2) return;
    setComparisonLoading(true);
    try {
      const results = [];
      for (const email of selectedCompareEmails) {
        const res = await fetch(`http://127.0.0.1:5000/api/student/${email}`);
        if (res.ok) {
          const data = await res.json();
          results.push(data);
        }
      }
      setComparisonData(results);
    } catch (err) {
      console.error("Error comparing students:", err);
    }
    setComparisonLoading(false);
  };

  // Sync state
  const [syncing, setSyncing] = useState(false);

  const downloadStudentPDF = () => {
    if (!dashboardData) return;
    const { student, metrics, evaluation } = dashboardData;
    const leet = metrics?.leetcode || {};
    const git = metrics?.github || {};
    const kag = metrics?.kaggle || {};
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Student Analytics Report - ${student.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.5; padding: 2rem; margin: 0; }
            .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 1.75rem; color: #111827; }
            .header p { margin: 0.25rem 0 0 0; color: #4b5563; font-size: 0.9rem; }
            .metadata { margin-bottom: 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f9fafb; padding: 1.25rem; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 0.9rem; }
            .section { margin-bottom: 2.5rem; }
            .section-title { font-size: 1.2rem; font-weight: bold; color: #1e1b4b; border-left: 4px solid #4f46e5; padding-left: 0.75rem; margin: 0 0 1rem 0; text-transform: uppercase; letter-spacing: 0.05em; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem; }
            th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
            th { background: #f3f4f6; font-weight: bold; color: #374151; }
            .progress-bar-container { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
            .progress-bar-label { min-width: 180px; font-weight: 600; font-size: 0.9rem; }
            .progress-bar { flex: 1; height: 10px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
            .progress-fill { height: 100%; background: #4f46e5; border-radius: 999px; }
            .progress-value { font-weight: bold; min-width: 40px; text-align: right; }
            .recommendations-card { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 1.5rem; margin-top: 1rem; }
            .recommendations-card p { font-style: italic; margin: 0 0 1rem 0; font-size: 0.95rem; }
            .recommendations-card ul { margin: 0; padding-left: 1.25rem; }
            .recommendations-card li { margin-bottom: 0.5rem; font-size: 0.9rem; color: #4c1d95; }
            .footer { margin-top: 3rem; text-align: center; font-size: 0.75rem; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Student Performance Analytics</h1>
              <p>Individual Student Summary Report</p>
            </div>
            <div style="text-align: right;">
              <p style="font-weight: bold;">Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div class="metadata">
            <div>
              <p><strong>Student Email:</strong> ${student.name}</p>
              <p><strong>GitHub Profile:</strong> ${student.github || 'Not Connected'}</p>
            </div>
            <div>
              <p><strong>LeetCode Profile:</strong> ${student.leetcode || 'Not Connected'}</p>
              <p><strong>Kaggle Profile:</strong> ${student.kaggle || 'Not Connected'}</p>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Platform Statistics</h2>
            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Metric Name</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowspan="3" style="font-weight: bold;">GitHub</td>
                  <td>Repositories Count</td>
                  <td>${git.repos || 0}</td>
                </tr>
                <tr>
                  <td>Total Commits (Year)</td>
                  <td>${git.totalCommits || 0}</td>
                </tr>
                <tr>
                  <td>Activity Streak</td>
                  <td>${git.currentStreak || 0} days</td>
                </tr>
                <tr>
                  <td rowspan="4" style="font-weight: bold;">LeetCode</td>
                  <td>Total Problems Solved</td>
                  <td>${leet.totalSolved || 0}</td>
                </tr>
                <tr>
                  <td>Easy Problems</td>
                  <td>${leet.easy || 0}</td>
                </tr>
                <tr>
                  <td>Medium Problems</td>
                  <td>${leet.medium || 0}</td>
                </tr>
                <tr>
                  <td>Hard Problems</td>
                  <td>${leet.hard || 0}</td>
                </tr>
                <tr>
                  <td rowspan="4" style="font-weight: bold;">Kaggle</td>
                  <td>Datasets Published</td>
                  <td>${kag.datasets || 0}</td>
                </tr>
                <tr>
                  <td>Notebooks Created</td>
                  <td>${kag.notebooks || 0}</td>
                </tr>
                <tr>
                  <td>Badge Level</td>
                  <td>${kag.badge || 'Novice'}</td>
                </tr>
                <tr>
                  <td>Medals (Gold / Silver / Bronze)</td>
                  <td>${kag.medals?.gold || 0} G / ${kag.medals?.silver || 0} S / ${kag.medals?.bronze || 0} B</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2 class="section-title">Competency Evaluation</h2>
            <div class="progress-bar-container">
              <div class="progress-bar-label">Problem Solving (LeetCode)</div>
              <div class="progress-bar"><div class="progress-fill" style="width: ${evaluation.problem_solving}%;"></div></div>
              <div class="progress-value">${evaluation.problem_solving}%</div>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-label">Development (GitHub)</div>
              <div class="progress-bar"><div class="progress-fill" style="width: ${evaluation.development}%;"></div></div>
              <div class="progress-value">${evaluation.development}%</div>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-label">Data Science (Kaggle)</div>
              <div class="progress-bar"><div class="progress-fill" style="width: ${evaluation.data_science}%;"></div></div>
              <div class="progress-value">${evaluation.data_science}%</div>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-label">Consistency Score</div>
              <div class="progress-bar"><div class="progress-fill" style="width: ${evaluation.consistency}%;"></div></div>
              <div class="progress-value">${evaluation.consistency}%</div>
            </div>
          </div>

          ${aiSummary ? `
          <div class="section">
            <h2 class="section-title">AI Coding Coach Recommendations</h2>
            <div class="recommendations-card">
              <p>"${aiSummary}"</p>
              ${aiRecs.length > 0 ? `
              <ul>
                ${aiRecs.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
              ` : ''}
            </div>
          </div>
          ` : ''}

          ${goals.length > 0 ? `
          <div class="section">
            <h2 class="section-title">Active Goals Tracker</h2>
            <table>
              <thead>
                <tr>
                  <th>Goal Description</th>
                  <th>Category</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                ${goals.map(g => `
                  <tr>
                    <td>${g.title}</td>
                    <td>${g.category.replace('_', ' ').toUpperCase()}</td>
                    <td>${g.target}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>Generated automatically via Student Analytics Dashboard. Professional Report.</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadCohortPDF = () => {
    if (!cohortData) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cohort Analytics Report - Overview</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.5; padding: 2rem; margin: 0; }
            .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 1.75rem; color: #111827; }
            .header p { margin: 0.25rem 0 0 0; color: #4b5563; font-size: 0.9rem; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
            .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; text-align: center; }
            .stat-card p { margin: 0; font-size: 0.8rem; color: #6b7280; text-transform: uppercase; font-weight: bold; }
            .stat-card h3 { margin: 0.25rem 0 0 0; font-size: 1.5rem; color: #111827; font-weight: bold; }
            .section { margin-bottom: 2.5rem; }
            .section-title { font-size: 1.2rem; font-weight: bold; color: #1e1b4b; border-left: 4px solid #4f46e5; padding-left: 0.75rem; margin: 0 0 1rem 0; text-transform: uppercase; letter-spacing: 0.05em; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem; }
            th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
            th { background: #f3f4f6; font-weight: bold; color: #374151; }
            .advisor-card { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 1.5rem; margin-top: 1rem; }
            .advisor-card p { font-style: italic; margin: 0 0 1rem 0; font-size: 0.95rem; }
            .advisor-card ul { margin: 0; padding-left: 1.25rem; }
            .advisor-card li { margin-bottom: 0.5rem; font-size: 0.9rem; color: #4c1d95; }
            .footer { margin-top: 3rem; text-align: center; font-size: 0.75rem; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Cohort Analytics Overview</h1>
              <p>Class Dashboard Summary Report</p>
            </div>
            <div style="text-align: right;">
              <p style="font-weight: bold;">Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <p>Total Students</p>
              <h3>${cohortData.totalStudents}</h3>
            </div>
            <div class="stat-card">
              <p>Active Ratio</p>
              <h3>${cohortData.activeRatio}%</h3>
            </div>
            <div class="stat-card">
              <p>Avg LeetCode Solves</p>
              <h3>${cohortData.averages?.avgLeetCode || 0}</h3>
            </div>
            <div class="stat-card">
              <p>Avg GitHub Commits</p>
              <h3>${cohortData.averages?.avgGitHubCommits || 0}</h3>
            </div>
          </div>

          ${adminAiSummary ? `
          <div class="section">
            <h2 class="section-title">Cohort AI Advisor Recommendations</h2>
            <div class="advisor-card">
              <p>"${adminAiSummary}"</p>
              ${adminAiRecs.length > 0 ? `
              <ul>
                ${adminAiRecs.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <div class="section">
            <h2 class="section-title">Student Directory Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Student Email</th>
                  <th>GitHub Link Status</th>
                  <th>LeetCode Link Status</th>
                  <th>Kaggle Link Status</th>
                </tr>
              </thead>
              <tbody>
                ${studentsList.map(s => `
                  <tr>
                    <td>${s.name}</td>
                    <td>${s.github ? 'Connected' : 'Not Connected'}</td>
                    <td>${s.leetcode ? 'Connected' : 'Not Connected'}</td>
                    <td>${s.kaggle ? 'Connected' : 'Not Connected'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Generated automatically via Student Analytics Dashboard. Professional Cohort Report.</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSyncData = async () => {
    if (!user || !user.email) return;
    setSyncing(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/student/${user.email}/sync`, {
        method: 'POST'
      });
      if (res.ok) {
        await checkStudentSetup(user.email);
        alert("Metrics synchronized successfully");
      } else {
        alert("Failed to sync metrics. Please verify credentials");
      }
    } catch (err) {
      console.error("Error syncing student data:", err);
      alert("Error syncing metrics");
    }
    setSyncing(false);
  };

  // AI Recommendation states
  const [aiSummary, setAiSummary] = useState('');
  const [aiRecs, setAiRecs] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const [adminAiSummary, setAdminAiSummary] = useState('');
  const [adminAiRecs, setAdminAiRecs] = useState([]);
  const [adminAiLoading, setAdminAiLoading] = useState(false);

  const fetchAiSummary = async (userEmail) => {
    setAiLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/student/${userEmail}/ai-summary`);
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
        setAiRecs(data.recommendations);
      }
    } catch (err) {
      console.error("Error fetching AI summary:", err);
    }
    setAiLoading(false);
  };

  const fetchAdminAiSummary = async () => {
    setAdminAiLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/cohort/ai-summary');
      if (res.ok) {
        const data = await res.json();
        setAdminAiSummary(data.summary);
        setAdminAiRecs(data.recommendations);
      }
    } catch (err) {
      console.error("Error fetching admin AI summary:", err);
    }
    setAdminAiLoading(false);
  };

  const fetchCohortData = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/cohort');
      if (res.ok) {
        const data = await res.json();
        setCohortData(data);
      }
    } catch (err) {
      console.error("Error fetching cohort data:", err);
    }
  };

  const fetchStudentsList = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/students');
      if (res.ok) {
        const data = await res.json();
        setStudentsList(data);
      }
    } catch (err) {
      console.error("Error fetching students list:", err);
    }
  };



  useEffect(() => {
    if (isAdminView) {
      fetchCohortData();
      fetchStudentsList();
      fetchAdminAiSummary();
    }
  }, [isAdminView]);

  const fetchGoals = async (userEmail) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/student/${userEmail}/goals`);
      if (res.ok) {
        const data = await res.json();
        setGoals(data);
      }
    } catch (err) {
      console.error("Error fetching goals:", err);
    }
  };

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!goalTitle || !goalTarget) return;
    setGoalStatusMsg('Adding goal...');
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/student/${user.email}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goalTitle,
          category: goalCategory,
          target: parseInt(goalTarget)
        })
      });
      if (res.ok) {
        setGoalStatusMsg('Goal added!');
        setGoalTitle('');
        setGoalTarget('');
        fetchGoals(user.email);
        setTimeout(() => setGoalStatusMsg(''), 2000);
      } else {
        setGoalStatusMsg('❌ Failed to add goal.');
      }
    } catch (err) {
      setGoalStatusMsg('❌ Request failed.');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/student/${user.email}/goals/${goalId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchGoals(user.email);
      }
    } catch (err) {
      console.error("Error deleting goal:", err);
    }
  };

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
        fetchGoals(userEmail);
        fetchAiSummary(userEmail);
        // Fetch historical snapshots for Phase 4
        const histRes = await fetch(`http://127.0.0.1:5000/api/student/${userEmail}/history`);
        if (histRes.ok) {
          const histData = await histRes.json();
          setHistory(histData);
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
        setSetupStatus('Kaggle API key parsed successfully!');
      } else {
        setSetupStatus('Error parsing Kaggle JSON: ' + data.error);
      }
    } catch (err) {
      setSetupStatus('Kaggle upload failed. Make sure the backend is running.');
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
         setSetupStatus('Platforms linked successfully!');
         // Re-check to load dashboard
         setTimeout(() => checkStudentSetup(user.email), 1000);
      } else {
         setSetupStatus('Failed to link platforms.');
      }
    } catch (err) {
      setSetupStatus('Request failed. Make sure the Flask backend is running on port 5000.');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>Loading Dashboard...</div>;
  }

  // --- RENDER AUTH SCREEN ---
  if (!user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)', fontFamily: 'Inter, sans-serif', padding: '1rem', boxSizing: 'border-box' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '100%', maxWidth: '420px', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: '800', color: '#1e1b4b' }}>Student Analytics</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Analyze coding profiles & track progress</p>
          </div>
          
          <h2 style={{ fontSize: '1.25rem', color: '#111827', margin: '0 0 1.5rem 0', fontWeight: '700' }}>
            {isLogin ? 'Sign In to Dashboard' : 'Create Student Account'}
          </h2>
          
          {authError && (
            <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid #fca5a5' }}>
              {authError}
            </div>
          )}
          
          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                placeholder="you@university.edu"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', display: 'block', marginBottom: '0.35rem' }}>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>
            <button 
              type="submit" 
              style={{ 
                padding: '0.85rem', 
                cursor: 'pointer', 
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: 'bold', 
                fontSize: '0.95rem',
                boxShadow: '0 4px 6px rgba(79, 70, 229, 0.25)',
                marginTop: '0.5rem'
              }}
            >
              {isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
          
          <p style={{ marginTop: '1.75rem', fontSize: '0.875rem', textAlign: 'center', color: '#6b7280' }}>
            {isLogin ? "New to the platform? " : "Already registered? "}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
            >
              {isLogin ? 'Create account' : 'Sign in here'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER SETUP SCREEN ---
  if (hasSetup === false) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)', fontFamily: 'Inter, sans-serif', padding: '2rem 1rem', boxSizing: 'border-box' }}>
        <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', width: '100%', maxWidth: '640px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#1e1b4b' }}>Platform Setup</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Link your developer profiles to analyze metrics</p>
            </div>
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#f3f4f6', color: '#4b5563', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem' }}>
              Sign Out
            </button>
          </div>
          
          <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '2rem' }}>
            Welcome! We will track your achievements across GitHub, LeetCode, and Kaggle. Please enter your usernames below:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ fontWeight: '700', color: '#374151', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>GitHub Username</label>
              <input 
                type="text" 
                value={github} 
                onChange={(e) => setGithub(e.target.value)} 
                placeholder="e.g. torvalds"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: '700', color: '#374151', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>LeetCode Username</label>
              <input 
                type="text" 
                value={leetcode} 
                onChange={(e) => setLeetcode(e.target.value)} 
                placeholder="e.g. tourist"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>

            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontWeight: '700', color: '#374151', fontSize: '0.875rem', display: 'block' }}>Kaggle Integration (Optional)</label>
              <ol style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem', paddingLeft: '1.25rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                <li>Go to <a href="https://www.kaggle.com" target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontWeight: '600' }}>Kaggle.com</a> -&gt; Settings</li>
                <li>Under the API section, click <strong>Create Legacy API Key</strong></li>
                <li>Upload the downloaded <code>kaggle.json</code> file below</li>
              </ol>
              <input 
                type="file" 
                accept=".json"
                onChange={handleKaggleUpload}
                style={{ fontSize: '0.85rem', color: '#4b5563' }}
              />
              {kaggleUser && (
                <div style={{ fontSize: '0.85rem', color: '#065f46', background: '#d1fae5', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '1rem', fontWeight: '500', display: 'inline-block' }}>
                  Detected Kaggle: <strong>{kaggleUser}</strong>
                </div>
              )}
            </div>

            {setupStatus && (
              <div style={{ padding: '1rem', background: setupStatus.toLowerCase().includes('success') ? '#d1fae5' : '#fee2e2', color: setupStatus.toLowerCase().includes('success') ? '#065f46' : '#991b1b', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid', borderColor: setupStatus.toLowerCase().includes('success') ? '#a7f3d0' : '#fca5a5' }}>
                {setupStatus}
              </div>
            )}

            <button 
              onClick={handlePlatformSetup} 
              style={{ 
                padding: '0.85rem', 
                cursor: 'pointer', 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '1rem', 
                fontWeight: 'bold', 
                marginTop: '1rem',
                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.25)'
              }}
            >
              Save & Generate Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD SCREEN ---
  const { student, metrics, evaluation } = dashboardData || {};

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'white', padding: '1.5rem 2rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>
              {isAdminView ? 'Admin Analytics Portal' : 'Student Dashboard'}
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
              {isAdminView ? 'Class Cohort Analytics & Directory' : student?.name}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {!isAdminView && (
              <button 
                onClick={handleSyncData} 
                disabled={syncing}
                style={{ 
                  padding: '0.5rem 1rem', 
                  cursor: 'pointer', 
                  background: '#ecfdf5', 
                  color: '#059669', 
                  border: '1px solid #a7f3d0', 
                  borderRadius: '6px', 
                  fontWeight: '600', 
                  fontSize: '0.9rem' 
                }}
              >
                {syncing ? 'Syncing...' : 'Sync Profiles'}
              </button>
            )}
            <button 
              onClick={() => setIsAdminView(!isAdminView)} 
              style={{ 
                padding: '0.5rem 1rem', 
                cursor: 'pointer', 
                background: isAdminView ? '#4f46e5' : '#e0e7ff', 
                color: isAdminView ? 'white' : '#4f46e5', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              {isAdminView ? 'Student View' : 'Admin Portal'}
            </button>
            {isAdminView ? (
              cohortData && (
                <button 
                  onClick={downloadCohortPDF} 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    cursor: 'pointer', 
                    background: '#f0fdf4', 
                    color: '#16a34a', 
                    border: '1px solid #bbf7d0', 
                    borderRadius: '6px', 
                    fontWeight: '600', 
                    fontSize: '0.9rem' 
                  }}
                >
                  Download PDF Report
                </button>
              )
            ) : (
              dashboardData && (
                <button 
                  onClick={downloadStudentPDF} 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    cursor: 'pointer', 
                    background: '#f0fdf4', 
                    color: '#16a34a', 
                    border: '1px solid #bbf7d0', 
                    borderRadius: '6px', 
                    fontWeight: '600', 
                    fontSize: '0.9rem' 
                  }}
                >
                  Download PDF Report
                </button>
              )
            )}
            <button onClick={() => setHasSetup(false)} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
              Edit Profiles
            </button>
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
              Sign Out
            </button>
          </div>
        </header>
 
        {isAdminView ? (
          <div>
            {adminAiSummary && (
              <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 15px rgba(49, 46, 129, 0.15)' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  Cohort AI Advisor Recommendations
                </h3>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', fontStyle: 'italic', opacity: 0.9 }}>
                  "{adminAiSummary}"
                </p>
                {adminAiRecs.length > 0 && (
                  <ul style={{ margin: '1rem 0 0 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                    {adminAiRecs.map((rec, idx) => (
                      <li key={idx} style={{ opacity: 0.85 }}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Cohort Overview Row */}
            {cohortData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #4f46e5' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Enrolled Students</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '2.25rem', fontWeight: 'bold', color: '#111827' }}>{cohortData.totalStudents}</p>
                </div>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #10b981' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Avg Commits per Student</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '2.25rem', fontWeight: 'bold', color: '#10b981' }}>{cohortData.averages?.avgGitHubCommits || 0}</p>
                </div>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #f59e0b' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Avg LeetCode Solves</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '2.25rem', fontWeight: 'bold', color: '#f59e0b' }}>{cohortData.averages?.avgLeetCode || 0}</p>
                </div>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Class Activity Rate</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '2.25rem', fontWeight: 'bold', color: '#3b82f6' }}>{cohortData.activeRatio || 0}%</p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>Loading cohort overview...</p>
            )}

            {/* Directory Table and Comparison Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>
              
              {/* Directory Card */}
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#374151' }}>Student Directory</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                        <th style={{ padding: '0.75rem', width: '60px' }}>Select</th>
                        <th style={{ padding: '0.75rem' }}>Email</th>
                        <th style={{ padding: '0.75rem' }}>GitHub</th>
                        <th style={{ padding: '0.75rem' }}>LeetCode</th>
                        <th style={{ padding: '0.75rem' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsList.map((stud) => (
                        <tr key={stud.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={selectedCompareEmails.includes(stud.name)}
                              onChange={() => handleToggleSelectStudent(stud.name)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem', fontWeight: '500', color: '#111827' }}>{stud.name}</td>
                          <td style={{ padding: '0.75rem', color: '#4b5563' }}>{stud.github}</td>
                          <td style={{ padding: '0.75rem', color: '#4b5563' }}>{stud.leetcode}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <button 
                              onClick={async () => {
                                await checkStudentSetup(stud.name);
                                setIsAdminView(false);
                              }}
                              style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center' }}>
                  <button 
                    onClick={handleCompareSelected}
                    disabled={selectedCompareEmails.length < 2}
                    style={{ padding: '0.65rem 1.25rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', opacity: selectedCompareEmails.length < 2 ? 0.5 : 1 }}
                  >
                    Compare Selected ({selectedCompareEmails.length})
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedCompareEmails([]);
                      setComparisonData([]);
                    }}
                    style={{ padding: '0.65rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              {/* Multi-Student Comparison Panel Card */}
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#374151' }}>Student Comparison Panel</h3>
                
                {comparisonLoading && (
                  <p style={{ color: '#4b5563', fontSize: '0.9rem', fontStyle: 'italic' }}>Loading comparison details...</p>
                )}

                {!comparisonLoading && comparisonData.length === 0 && (
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontStyle: 'italic' }}>Select 2 or more students in the directory to compare metrics.</p>
                )}

                {!comparisonLoading && comparisonData.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', background: '#f8fafc' }}>
                          <th style={{ padding: '0.65rem', fontWeight: '700' }}>Metric / Score</th>
                          {comparisonData.map(c => (
                            <th key={c.student.name} style={{ padding: '0.65rem', fontWeight: '700', color: '#4f46e5' }}>{c.student.github || c.student.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '600', color: '#374151' }}>GitHub Repositories</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem' }}>{c.metrics?.github?.repos || 0}</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '600', color: '#374151' }}>GitHub Commits</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem' }}>{c.metrics?.github?.totalCommits || 0}</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '600', color: '#374151' }}>LeetCode Total Solved</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem' }}>{c.metrics?.leetcode?.totalSolved || 0}</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '600', color: '#374151' }}>LeetCode Easy / Med / Hard</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem' }}>
                              {c.metrics?.leetcode?.easy || 0} / {c.metrics?.leetcode?.medium || 0} / {c.metrics?.leetcode?.hard || 0}
                            </td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '600', color: '#374151' }}>Kaggle Notebooks</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem' }}>{c.metrics?.kaggle?.notebooks || 0}</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '600', color: '#374151' }}>Kaggle Datasets</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem' }}>{c.metrics?.kaggle?.datasets || 0}</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '700', color: '#374151' }}>Problem Solving Score</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem', fontWeight: '700' }}>{c.evaluation?.problem_solving || 0}%</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '700', color: '#374151' }}>Development Score</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem', fontWeight: '700' }}>{c.evaluation?.development || 0}%</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '700', color: '#374151' }}>Data Science Score</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem', fontWeight: '700' }}>{c.evaluation?.data_science || 0}%</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem', fontWeight: '700', color: '#374151' }}>Consistency Score</td>
                          {comparisonData.map(c => (
                            <td key={c.student.name} style={{ padding: '0.65rem', fontWeight: '700' }}>{c.evaluation?.consistency || 0}%</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div>
            {aiSummary && (
              <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 15px rgba(49, 46, 129, 0.15)' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  Personalized AI Coach Analysis
                </h3>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', fontStyle: 'italic', opacity: 0.9 }}>
                  "{aiSummary}"
                </p>
                {aiRecs.length > 0 && (
                  <ul style={{ margin: '1rem 0 0 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                    {aiRecs.map((rec, idx) => (
                      <li key={idx} style={{ opacity: 0.85 }}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{metrics.github.currentStreak} days</p>
                      </div>
                    </>
                  )}
                </div>

                {metrics.github.topProjects && metrics.github.topProjects.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#374151', fontWeight: 'bold' }}>Top Projects (by Commits)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {metrics.github.topProjects.map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', padding: '0.75rem', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                           <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h4>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                             <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{width: '8px', height: '8px', borderRadius: '50%', background: p.color || '#ccc'}}></span> {p.language}</span>
                             <span>Stars: {p.stars}</span>
                           </div>
                           <div style={{ fontSize: '0.7rem', color: '#4b5563', marginTop: '0.25rem', textAlign: 'right' }}>
                             Commits: {p.commits || 0}
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
                
                {/* Solved Topics Tags */}
                {metrics.leetcode.skills && metrics.leetcode.skills.length > 0 && (
                  <div style={{ width: '100%', borderTop: '1px solid #f3f4f6', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Top Solved Topics</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {metrics.leetcode.skills.map((skill, index) => (
                        <div key={index} style={{ fontSize: '0.75rem', background: '#f3f4f6', color: '#374151', padding: '0.35rem 0.65rem', borderRadius: '999px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>{skill.name}</span>
                          <span style={{ background: '#e5e7eb', padding: '0.1rem 0.35rem', borderRadius: '999px', fontSize: '0.7rem', color: '#6b7280' }}>{skill.solved}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontStyle: 'italic' }}>{student?.leetcode ? 'Loading data...' : 'Not Connected'}</p>
            )}
          </div>

          {/* Kaggle Card */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <KaggleIcon /> Kaggle
            </h2>
            {metrics?.kaggle && metrics.kaggle.status === 'Linked' ? (
              <div>
                {metrics.kaggle.badge && (
                  <div style={{ 
                    display: 'inline-block', 
                    background: metrics.kaggle.badge === 'Master' ? '#fae8ff' : metrics.kaggle.badge === 'Expert' ? '#ffedd5' : metrics.kaggle.badge === 'Contributor' ? '#ccfbf1' : '#f1f5f9', 
                    color: metrics.kaggle.badge === 'Master' ? '#86198f' : metrics.kaggle.badge === 'Expert' ? '#c2410c' : metrics.kaggle.badge === 'Contributor' ? '#0f766e' : '#475569', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '999px', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold', 
                    textTransform: 'uppercase', 
                    marginBottom: '1rem' 
                  }}>
                    Badge Level: {metrics.kaggle.badge}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datasets</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.75rem', fontWeight: 'bold', color: '#111827' }}>{metrics.kaggle.datasets}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notebooks</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.75rem', fontWeight: 'bold', color: '#111827' }}>{metrics.kaggle.notebooks || 0}</p>
                  </div>
                </div>
                {metrics.kaggle.medals && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#b59410' }}>
                      Gold Medals: {metrics.kaggle.medals.gold || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8' }}>
                      Silver Medals: {metrics.kaggle.medals.silver || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#b45309' }}>
                      Bronze Medals: {metrics.kaggle.medals.bronze || 0}
                    </div>
                  </div>
                )}
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
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#374151' }}>GitHub Daily Commits</h3>
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
                    <Area type="monotone" dataKey="commits" name="Commits" stroke="#111827" strokeWidth={3} fillOpacity={1} fill="url(#colorGitHub)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
 
          {/* Historical Timeline - LeetCode */}
          {history.length > 0 && (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #f59e0b' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#374151' }}>LeetCode Daily Solves</h3>
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
                    <Area type="monotone" dataKey="solves" name="Problems Solved" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorLeetCode)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Goals & Evaluation Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
          
          {/* Goal Tracker Card */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #10b981' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#374151' }}>Goal Tracker</h3>
            
            {/* Create Goal Form */}
            <form onSubmit={handleAddGoal} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Target goal description" 
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                required
                style={{ flex: 2, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
              <select 
                value={goalCategory} 
                onChange={(e) => setGoalCategory(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem', background: 'white', color: '#1f2937' }}
              >
                <option value="leetcode_total">LeetCode Solved</option>
                <option value="leetcode_easy">LeetCode Easy</option>
                <option value="leetcode_medium">LeetCode Med</option>
                <option value="leetcode_hard">LeetCode Hard</option>
                <option value="github_commits">GitHub Commits</option>
                <option value="github_repos">GitHub Repos</option>
                <option value="kaggle_datasets">Kaggle Datasets</option>
                <option value="kaggle_notebooks">Kaggle Notebooks</option>
              </select>
              <input 
                type="number" 
                placeholder="Target" 
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                required
                min="1"
                style={{ width: '80px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.875rem' }}>
                Add
              </button>
            </form>
            {goalStatusMsg && <p style={{ fontSize: '0.85rem', marginTop: '-1rem', marginBottom: '1rem', color: '#374151' }}>{goalStatusMsg}</p>}
            
            {/* Goals List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '280px', overflowY: 'auto' }}>
              {goals.length === 0 ? (
                <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem', margin: 0 }}>No active goals. Set a goal above to get started!</p>
              ) : (
                goals.map((g) => {
                  const percent = Math.min(100, Math.round((g.current / g.target) * 100)) || 0;
                  const isDone = g.status === 'Completed';
                  return (
                    <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>{g.title}</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '4px', 
                            fontWeight: 'bold', 
                            color: isDone ? '#065f46' : '#1e3a8a', 
                            background: isDone ? '#d1fae5' : '#dbeafe' 
                          }}>
                            {g.status}
                          </span>
                          <button onClick={() => handleDeleteGoal(g.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', padding: '0.25rem' }} title="Delete goal">
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${percent}%`, height: '100%', background: isDone ? '#10b981' : '#3b82f6', borderRadius: '999px', transition: 'width 0.3s ease' }}></div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: '500', minWidth: '65px', textAlign: 'right' }}>
                          {g.current}/{g.target} ({percent}%)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Multi-Dimensional Skill Matrix Card */}
          {evaluation && (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #8b5cf6' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#374151' }}>Coding Competency Matrix</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
                
                {/* Left: Radar Chart */}
                <div style={{ height: 260, display: 'flex', justifyContent: 'center' }}>
                  <ResponsiveContainer>
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={[
                      { subject: 'Problem Solving', A: evaluation.problem_solving, fullMark: 100 },
                      { subject: 'Development', A: evaluation.development, fullMark: 100 },
                      { subject: 'Data Science', A: evaluation.data_science, fullMark: 100 },
                      { subject: 'Consistency', A: evaluation.consistency, fullMark: 100 }
                    ]}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af' }} />
                      <Radar name="Skills" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Right: Competency Explanation Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Problem Solving */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>
                      <span>Problem Solving (LeetCode)</span>
                      <span>{evaluation.problem_solving}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${evaluation.problem_solving}%`, height: '100%', background: '#8b5cf6', borderRadius: '999px' }}></div>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Algorithms practice. Based on solves weighted by difficulty (Easy=5, Med=15, Hard=30).</p>
                  </div>

                  {/* Development */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>
                      <span>Development (GitHub)</span>
                      <span>{evaluation.development}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${evaluation.development}%`, height: '100%', background: '#8b5cf6', borderRadius: '999px' }}></div>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Software construction. Calculated from repository count and commit activity volume.</p>
                  </div>

                  {/* Data Science */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>
                      <span>Data Science (Kaggle)</span>
                      <span>{evaluation.data_science}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${evaluation.data_science}%`, height: '100%', background: '#8b5cf6', borderRadius: '999px' }}></div>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Data analytics capability. Based on notebook publications and datasets.</p>
                  </div>

                  {/* Consistency */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>
                      <span>Consistency (Platform Activity)</span>
                      <span>{evaluation.consistency}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${evaluation.consistency}%`, height: '100%', background: '#8b5cf6', borderRadius: '999px' }}></div>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Active coding habits. Tracks active streaks and regular codebase updates.</p>
                  </div>

                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    )}
        
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
