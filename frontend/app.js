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

            // 2. Fetch GitHub data for each student
            for (const student of students) {
                const card = document.createElement("div");
                card.style.border = "1px solid #ddd";
                card.style.padding = "15px";
                card.style.marginBottom = "15px";
                card.style.borderRadius = "5px";
                
                try {
                    const gitResponse = await fetch(`http://localhost:5000/api/github?username=${student.github}`);
                    if (!gitResponse.ok) throw new Error("GitHub profile not found");
                    
                    const gitData = await gitResponse.json();
                    
                    card.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="${gitData.avatar_url}" alt="Avatar" width="60" style="border-radius: 50%;">
                            <div>
                                <h3 style="margin: 0;">${student.name} (<a href="${gitData.html_url}" target="_blank">${gitData.login}</a>)</h3>
                                <p style="margin: 5px 0 0 0;">Public Repos: <strong>${gitData.public_repos}</strong> | Followers: <strong>${gitData.followers}</strong></p>
                            </div>
                        </div>
                    `;
                } catch (err) {
                    card.innerHTML = `
                        <h3 style="margin: 0;">${student.name}</h3>
                        <p style="color: red;">Error fetching GitHub data for ${student.github}</p>
                    `;
                }
                
                dashboardContent.appendChild(card);
            }
        } catch (error) {
            dashboardContent.innerHTML = `<p style="color: red;">Error loading dashboard: ${error.message}</p>`;
        }
    });
});
