document.addEventListener("DOMContentLoaded", async () => {
    const statusSection = document.getElementById("status-section");
    
    try {
        statusSection.innerHTML = "<p>Connecting to backend...</p>";
        const response = await fetch("http://localhost:5000/api/health");
        const data = await response.json();
        
        statusSection.innerHTML = `<p>Backend says: <strong>${data.message}</strong></p>`;
    } catch (error) {
        statusSection.innerHTML = `<p style="color: red;">Error connecting to backend: ${error.message}</p>`;
    }
});
