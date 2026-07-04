document.addEventListener("DOMContentLoaded", async () => {
    const statusSection = document.getElementById("status-section");
    const registrationForm = document.getElementById("registration-form");
    const formMessage = document.getElementById("form-message");
    
    // Check Backend Status
    try {
        const response = await fetch("http://localhost:5000/api/health");
        const data = await response.json();
        statusSection.innerHTML = `<p>Backend Status: <span style="color: green;">Online</span></p>`;
    } catch (error) {
        statusSection.innerHTML = `<p style="color: red;">Backend Status: Offline</p>`;
    }

    // Handle Form Submission
    registrationForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent page reload
        formMessage.style.color = "black";
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
                formMessage.style.color = "green";
                formMessage.innerText = data.message;
                registrationForm.reset(); // Clear the form
            } else {
                formMessage.style.color = "red";
                formMessage.innerText = "Registration failed!";
            }
        } catch (error) {
            formMessage.style.color = "red";
            formMessage.innerText = "Error connecting to server.";
        }
    });
    // Handle Dashboard Loading
    const loadDashboardBtn = document.getElementById("load-dashboard-btn");
    const dashboardContent = document.getElementById("dashboard-content");

    loadDashboardBtn.addEventListener("click", async () => {
        dashboardContent.innerHTML = "<p>Loading students...</p>";
        
        try {
            // 1. Fetch the list of registered students
            const studentsResponse = await fetch("http://localhost:5000/api/students");
            const students = await studentsResponse.json();
            
            if (students.length === 0) {
                dashboardContent.innerHTML = "<p>No students registered yet.</p>";
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
                    let leetText = `<span style="color: gray;">LeetCode Data Unavailable</span>`;
                    try {
                        const leetResponse = await fetch(`http://localhost:5000/api/leetcode?username=${student.leetcode}`);
                        if (leetResponse.ok) {
                            const leetData = await leetResponse.json();
                            if (leetData.totalSolved !== undefined) {
                                leetText = `Total Solved: <strong>${leetData.totalSolved}</strong> (Easy: ${leetData.easySolved}, Med: ${leetData.mediumSolved}, Hard: ${leetData.hardSolved})`;
                            }
                        } else {
                            leetText = `<span style="color: #d73a49;">Failed to load LeetCode data.</span>`;
                        }
                    } catch (e) {
                        console.error("LeetCode fetch error:", e);
                    }
                    
                    // Fetch Kaggle
                    let kaggleText = `<span style="color: gray;">Kaggle Data Unavailable</span>`;
                    try {
                        const kaggleResponse = await fetch(`http://localhost:5000/api/kaggle?username=${student.kaggle}`);
                        if (kaggleResponse.ok) {
                            const kaggleData = await kaggleResponse.json();
                            kaggleText = `Competitions: <strong>${kaggleData.competitions}</strong> | Datasets: <strong>${kaggleData.datasets}</strong> | Notebooks: <strong>${kaggleData.notebooks}</strong>`;
                        } else {
                            kaggleText = `<span style="color: #d73a49;">Failed to load Kaggle data.</span>`;
                        }
                    } catch (e) {
                        console.error("Kaggle fetch error:", e);
                    }
                    
                    // Fetch Analytics (Focus & Consistency)
                    let analyticsText = `<span style="color: gray;">Analytics Unavailable</span>`;
                    try {
                        const analyticsResponse = await fetch(`http://localhost:5000/api/analytics?github=${student.github}&leetcode=${student.leetcode}`);
                        if (analyticsResponse.ok) {
                            const analyticsData = await analyticsResponse.json();
                            let focusColor = "#0366d6"; // blue
                            if (analyticsData.focus === "DSA Focused") focusColor = "#6f42c1"; // purple
                            else if (analyticsData.focus === "Project Focused") focusColor = "#e36209"; // orange
                            
                            let consistencyColor = "gray";
                            if (analyticsData.consistency === "Active") consistencyColor = "#2ea44f"; // green
                            else if (analyticsData.consistency === "Inactive") consistencyColor = "#d73a49"; // red
                            
                            analyticsText = `Focus: <strong style="color: ${focusColor};">${analyticsData.focus}</strong> | Consistency: <strong style="color: ${consistencyColor};">${analyticsData.consistency}</strong>`;
                        }
                    } catch (e) {
                        console.error("Analytics fetch error:", e);
                    }
                    
                    card.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <img src="${gitData.avatar_url}" alt="Avatar" width="60" style="border-radius: 50%; border: 2px solid #e1e4e8;">
                            <div>
                                <h3 style="margin: 0;">${student.name}</h3>
                                <a href="${gitData.html_url}" target="_blank" style="font-size: 0.9em; color: #586069; text-decoration: none;">@${gitData.login}</a>
                            </div>
                        </div>
                        <div style="line-height: 1.5;">
                            <p style="margin: 5px 0;"><strong>GitHub:</strong> Repos: ${gitData.public_repos} | Followers: ${gitData.followers}</p>
                            <p style="margin: 5px 0;"><strong>LeetCode:</strong> ${leetText}</p>
                            <p style="margin: 5px 0;"><strong>Kaggle:</strong> ${kaggleText}</p>
                        </div>
                        <p class="ai-insights"><strong>🤖 AI Insights:</strong><br>${analyticsText}</p>
                    `;
                } catch (err) {
                    card.innerHTML = `
                        <h3 style="margin: 0;">${student.name}</h3>
                        <p style="color: red;">Error fetching data for ${student.name}: ${err.message}</p>
                    `;
                }
                
                dashboardContent.appendChild(card);
            }
            
        } catch (error) {
            dashboardContent.innerHTML = `<p style="color: red;">Error loading dashboard: ${error.message}</p>`;
        }
    });
});
