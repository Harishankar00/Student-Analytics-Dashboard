document.addEventListener("DOMContentLoaded", async () => {
    const statusText = document.getElementById("backend-status-text");
    const statusDot = document.querySelector(".status-dot");
    const registrationForm = document.getElementById("registration-form");
    const formMessage = document.getElementById("form-message");
    
    // Check Backend Status
    try {
        const response = await fetch("http://localhost:5000/api/health");
        if (response.ok) {
            statusText.innerText = "Online";
            statusText.style.color = "#10b981";
            statusDot.classList.add("online");
        } else {
            throw new Error("Offline");
        }
    } catch (error) {
        statusText.innerText = "Offline";
        statusText.style.color = "#ef4444";
        statusDot.classList.remove("online");
    }

    // Handle Form Submission
    registrationForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent page reload
        formMessage.style.color = "var(--text-main)";
        formMessage.innerText = "Registering...";

        const studentData = {
            name: document.getElementById("name").value,
            github: document.getElementById("github").value,
            leetcode: document.getElementById("leetcode").value,
            kaggle: document.getElementById("kaggle").value
        };

        try {
            const response = await fetch("http://localhost:5000/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(studentData)
            });

            const data = await response.json();
            
            if (response.ok) {
                formMessage.style.color = "#10b981";
                formMessage.innerText = data.message;
                registrationForm.reset(); // Clear the form
            } else {
                formMessage.style.color = "#ef4444";
                formMessage.innerText = "Registration failed!";
            }
        } catch (error) {
            formMessage.style.color = "#ef4444";
            formMessage.innerText = "Error connecting to server.";
        }
    });
    // Handle Dashboard Loading
    const loadDashboardBtn = document.getElementById("load-dashboard-btn");
    const dashboardContent = document.getElementById("dashboard-content");

    loadDashboardBtn.addEventListener("click", async () => {
        dashboardContent.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: var(--text-muted);'>Loading students...</p>";
        
        try {
            // 1. Fetch the list of registered students
            const studentsResponse = await fetch("http://localhost:5000/api/students");
            const students = await studentsResponse.json();
            
            if (students.length === 0) {
                dashboardContent.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: var(--text-muted);'>No students registered yet.</p>";
                return;
            }

            dashboardContent.innerHTML = ""; // clear loading text

            // 2. Fetch data for each student
            for (const student of students) {
                const card = document.createElement("div");
                card.className = "student-card";
                
                try {
                    // Fetch GitHub
                    const gitResponse = await fetch(`http://localhost:5000/api/github?username=${student.github}`);
                    if (!gitResponse.ok) throw new Error(`GitHub profile '${student.github}' not found`);
                    const gitData = await gitResponse.json();
                    
                    // Fetch LeetCode
                    let leetHTML = `<div class="stat-item"><span class="stat-label">Status</span><span class="stat-value" style="color: #ef4444;">Unavailable</span></div>`;
                    try {
                        const leetResponse = await fetch(`http://localhost:5000/api/leetcode?username=${student.leetcode}`);
                        if (leetResponse.ok) {
                            const leetData = await leetResponse.json();
                            if (leetData.totalSolved !== undefined) {
                                leetHTML = `
                                    <div class="stat-item"><span class="stat-label">Total</span><span class="stat-value">${leetData.totalSolved}</span></div>
                                    <div class="stat-item"><span class="stat-label" style="color: #10b981;">Easy</span><span class="stat-value">${leetData.easySolved}</span></div>
                                    <div class="stat-item"><span class="stat-label" style="color: #f59e0b;">Med</span><span class="stat-value">${leetData.mediumSolved}</span></div>
                                    <div class="stat-item"><span class="stat-label" style="color: #ef4444;">Hard</span><span class="stat-value">${leetData.hardSolved}</span></div>
                                `;
                            }
                        } else {
                            leetHTML = `<div class="stat-item"><span class="stat-label">Status</span><span class="stat-value" style="color: #ef4444;">Failed</span></div>`;
                        }
                    } catch (e) {
                        console.error("LeetCode fetch error:", e);
                    }
                    
                    // Fetch Kaggle
                    let kaggleHTML = `<div class="stat-item"><span class="stat-label">Status</span><span class="stat-value" style="color: #ef4444;">Unavailable</span></div>`;
                    try {
                        const kaggleResponse = await fetch(`http://localhost:5000/api/kaggle?username=${student.kaggle}`);
                        if (kaggleResponse.ok) {
                            const kaggleData = await kaggleResponse.json();
                            kaggleHTML = `
                                <div class="stat-item"><span class="stat-label">Competitions</span><span class="stat-value">${kaggleData.competitions}</span></div>
                                <div class="stat-item"><span class="stat-label">Datasets</span><span class="stat-value">${kaggleData.datasets}</span></div>
                                <div class="stat-item"><span class="stat-label">Notebooks</span><span class="stat-value">${kaggleData.notebooks}</span></div>
                            `;
                        } else {
                            kaggleHTML = `<div class="stat-item"><span class="stat-label">Status</span><span class="stat-value" style="color: #ef4444;">Failed</span></div>`;
                        }
                    } catch (e) {
                        console.error("Kaggle fetch error:", e);
                    }
                    
                    // Fetch Analytics (Focus & Consistency)
                    let analyticsHTML = `<span class="ai-badge" style="background: #f3f4f6; color: #6b7280;">Analytics Unavailable</span>`;
                    let adviceHTML = "";
                    try {
                        const analyticsResponse = await fetch(`http://localhost:5000/api/analytics?github=${student.github}&leetcode=${student.leetcode}`);
                        if (analyticsResponse.ok) {
                            const analyticsData = await analyticsResponse.json();
                            
                            let focusClass = "focus-balanced";
                            if (analyticsData.focus === "DSA Focused") focusClass = "focus-dsa";
                            else if (analyticsData.focus === "Project Focused") focusClass = "focus-project";
                            
                            let consistencyClass = "consistency-inactive";
                            if (analyticsData.consistency === "Active") consistencyClass = "consistency-active";
                            
                            analyticsHTML = `
                                <span class="ai-badge ${focusClass}">${analyticsData.focus}</span>
                                <span class="ai-badge ${consistencyClass}">${analyticsData.consistency}</span>
                            `;
                            adviceHTML = `<span class="ai-advice">"${analyticsData.advice}"</span>`;
                        }
                    } catch (e) {
                        console.error("Analytics fetch error:", e);
                    }
                    
                    card.innerHTML = `
                        <div class="card-header">
                            <img src="${gitData.avatar_url}" alt="Avatar" class="avatar">
                            <div>
                                <h3>${student.name}</h3>
                                <a href="${gitData.html_url}" target="_blank" class="github-link">@${gitData.login}</a>
                            </div>
                        </div>
                        
                        <div class="metric-group">
                            <div class="metric-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                GitHub
                            </div>
                            <div class="metric-stats">
                                <div class="stat-item"><span class="stat-label">Repositories</span><span class="stat-value">${gitData.public_repos}</span></div>
                                <div class="stat-item"><span class="stat-label">Followers</span><span class="stat-value">${gitData.followers}</span></div>
                            </div>
                        </div>
                        
                        <div class="metric-group">
                            <div class="metric-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                                LeetCode
                            </div>
                            <div class="metric-stats">
                                ${leetHTML}
                            </div>
                        </div>
                        
                        <div class="metric-group">
                            <div class="metric-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                Kaggle
                            </div>
                            <div class="metric-stats">
                                ${kaggleHTML}
                            </div>
                        </div>
                        
                        <div class="ai-insights">
                            <div class="metric-title" style="color: #4f46e5;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                                AI Insights
                            </div>
                            <div style="margin-top: 0.5rem;">
                                ${analyticsHTML}
                                ${adviceHTML}
                            </div>
                        </div>
                    `;
                } catch (err) {
                    card.innerHTML = `
                        <div class="card-header">
                            <div>
                                <h3 style="color: #ef4444;">${student.name}</h3>
                                <p style="font-size: 0.875rem; color: #ef4444; margin-top: 0.5rem;">Error loading profile: ${err.message}</p>
                            </div>
                        </div>
                    `;
                }
                
                dashboardContent.appendChild(card);
            }
            
        } catch (error) {
            dashboardContent.innerHTML = `<p style="grid-column: 1/-1; color: #ef4444; text-align: center;">Error loading dashboard: ${error.message}</p>`;
        }
    });
});
