import http.server
import socketserver
import json
import os
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs
import datetime
import threading
import time

PORT = 5000
DATA_FILE = 'students.json'
SNAPSHOTS_FILE = 'snapshots.json'

def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def load_snapshots():
    if not os.path.exists(SNAPSHOTS_FILE):
        return []
    with open(SNAPSHOTS_FILE, 'r') as f:
        return json.load(f)

def save_snapshots(data):
    with open(SNAPSHOTS_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def fetch_github(username):
    url = f"https://api.github.com/users/{username}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Student-Analytics-Dashboard'})
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching GitHub for {username}: {e}")
        return None

def fetch_leetcode(username):
    url = f"https://leetcode-api-faisalshohag.vercel.app/{username}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Student-Analytics-Dashboard'})
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching LeetCode for {username}: {e}")
        return None

def fetch_kaggle(username):
    return {
        "username": username,
        "competitions": 2,
        "datasets": 1,
        "notebooks": 5
    }

def take_system_snapshot():
    print(f"[{datetime.datetime.now().isoformat()}] Running automated snapshot...")
    students = load_data()
    if not students:
        print("No students registered. Skipping snapshot.")
        return

    current_snapshot_students = []
    for student in students:
        student_snap = {
            "name": student.get("name"),
            "github": student.get("github"),
            "leetcode": student.get("leetcode"),
            "kaggle": student.get("kaggle"),
            "metrics": {}
        }
        
        # GitHub
        git_data = fetch_github(student.get("github"))
        if git_data:
            student_snap["metrics"]["github"] = {
                "repos": git_data.get("public_repos", 0),
                "followers": git_data.get("followers", 0)
            }
        else:
            student_snap["metrics"]["github"] = None
            
        # LeetCode
        leet_data = fetch_leetcode(student.get("leetcode"))
        if leet_data and "totalSolved" in leet_data:
            student_snap["metrics"]["leetcode"] = {
                "totalSolved": leet_data.get("totalSolved", 0),
                "easy": leet_data.get("easySolved", 0),
                "medium": leet_data.get("mediumSolved", 0),
                "hard": leet_data.get("hardSolved", 0)
            }
        else:
            student_snap["metrics"]["leetcode"] = None
            
        # Kaggle
        kag_data = fetch_kaggle(student.get("kaggle"))
        student_snap["metrics"]["kaggle"] = {
            "competitions": kag_data.get("competitions", 0),
            "datasets": kag_data.get("datasets", 0),
            "notebooks": kag_data.get("notebooks", 0)
        }
        
        current_snapshot_students.append(student_snap)

    snapshots = load_snapshots()
    
    # Deduplication check
    if snapshots:
        last_snapshot_students = snapshots[-1].get("students", [])
        if current_snapshot_students == last_snapshot_students:
            print("No changes since last snapshot. Discarding duplicate.")
            return

    print("Changes detected! Saving new snapshot.")
    snapshot_entry = {
        'timestamp': datetime.datetime.now().isoformat(),
        'students': current_snapshot_students
    }
    snapshots.append(snapshot_entry)
    save_snapshots(snapshots)

def automated_snapshot_worker():
    # Wait 5 seconds on startup before first run
    time.sleep(5)
    while True:
        take_system_snapshot()
        # Sleep for 1 minute for testing
        time.sleep(60)

class SimpleHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        
        if parsed_url.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            response = {"status": "ok", "message": "Backend is running!"}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        elif parsed_url.path == '/api/students':
            students = load_data()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(students).encode('utf-8'))
            
        elif parsed_url.path == '/api/github':
            query_components = parse_qs(parsed_url.query)
            if 'username' not in query_components:
                self.send_response(400)
                self.end_headers()
                return
            username = query_components['username'][0]
            data = fetch_github(username)
            if data:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(data).encode('utf-8'))
            else:
                self.send_response(500)
                self.end_headers()
                
        elif parsed_url.path == '/api/leetcode':
            query_components = parse_qs(parsed_url.query)
            if 'username' not in query_components:
                self.send_response(400)
                self.end_headers()
                return
            username = query_components['username'][0]
            data = fetch_leetcode(username)
            if data:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(data).encode('utf-8'))
            else:
                self.send_response(500)
                self.end_headers()
                
        elif parsed_url.path == '/api/kaggle':
            query_components = parse_qs(parsed_url.query)
            if 'username' not in query_components:
                self.send_response(400)
                self.end_headers()
                return
            username = query_components['username'][0]
            data = fetch_kaggle(username)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
            
        elif parsed_url.path == '/api/analytics':
            query_components = parse_qs(parsed_url.query)
            if 'github' not in query_components or 'leetcode' not in query_components:
                self.send_response(400)
                self.end_headers()
                return
                
            github_user = query_components['github'][0]
            leetcode_user = query_components['leetcode'][0]
            
            # Get latest stats to calculate Focus
            git_data = fetch_github(github_user)
            leet_data = fetch_leetcode(leetcode_user)
            
            repos = git_data.get("public_repos", 0) if git_data else 0
            solved = leet_data.get("totalSolved", 0) if leet_data else 0
            
            # Calculate Focus
            # We use a simple ratio: Total Solved / (Total Solved + Repos * 5)
            # We weight a repo as roughly equal to 5 leetcode problems
            focus = "Balanced"
            if solved + repos == 0:
                focus = "Needs Activity"
            else:
                weighted_repos = repos * 5
                dsa_ratio = solved / (solved + weighted_repos)
                if dsa_ratio > 0.7:
                    focus = "DSA Focused"
                elif dsa_ratio < 0.3:
                    focus = "Project Focused"
                    
            # Calculate Consistency from Snapshots
            snapshots = load_snapshots()
            consistency = "Unknown"
            
            if len(snapshots) >= 2:
                # Compare oldest and newest snapshot for this user
                oldest = snapshots[0]
                newest = snapshots[-1]
                
                old_solved, new_solved = 0, 0
                old_repos, new_repos = 0, 0
                
                for s in oldest.get("students", []):
                    if s.get("github") == github_user:
                        if s.get("metrics", {}).get("leetcode"):
                            old_solved = s["metrics"]["leetcode"].get("totalSolved", 0)
                        if s.get("metrics", {}).get("github"):
                            old_repos = s["metrics"]["github"].get("repos", 0)
                            
                for s in newest.get("students", []):
                    if s.get("github") == github_user:
                        if s.get("metrics", {}).get("leetcode"):
                            new_solved = s["metrics"]["leetcode"].get("totalSolved", 0)
                        if s.get("metrics", {}).get("github"):
                            new_repos = s["metrics"]["github"].get("repos", 0)
                            
                solved_diff = new_solved - old_solved
                repos_diff = new_repos - old_repos
                
                if solved_diff > 0 or repos_diff > 0:
                    consistency = "Active"
                else:
                    consistency = "Inactive"
                    
            # ---------------------------------------------------------
            # Simple AI Evaluation Engine (Rule-based)
            # ---------------------------------------------------------
            advice = ""
            if consistency == "Inactive" or consistency == "Unknown":
                advice = "Your metrics haven't shown much activity recently. Consistency is key! Try setting a small goal: push one GitHub commit or solve one easy LeetCode problem this week to build momentum."
            elif focus == "DSA Focused":
                advice = "You are doing a fantastic job consistently solving algorithms! To stand out to recruiters, try dedicating some time to building a real-world project on GitHub."
            elif focus == "Project Focused":
                advice = "Your project portfolio is growing nicely! However, consider spending 30 minutes a day on LeetCode to ensure you are ready for technical coding interviews."
            elif focus == "Balanced":
                advice = "Outstanding work! You have a great balance between building projects and practicing algorithms. Keep up the consistent effort!"
            else:
                advice = "Keep learning and coding! Every line of code counts towards your progress."
                
            # Add Kaggle specific praise if they participate
            kag_data = fetch_kaggle(github_user) # Using github_user as proxy since we don't have kaggle username in query
            if kag_data and kag_data.get("competitions", 0) > 0:
                advice += " Your participation in Kaggle also shows great initiative in Data Science."

            analytics_data = {
                "focus": focus,
                "consistency": consistency,
                "advice": advice
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(analytics_data).encode('utf-8'))
            
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/register':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            student_data = json.loads(post_data.decode('utf-8'))
            
            students = load_data()
            students.append(student_data)
            save_data(students)
            
            # Immediately take a snapshot so the new user is tracked
            threading.Thread(target=take_system_snapshot, daemon=True).start()
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            response = {"status": "success", "message": "Student registered successfully!"}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        elif self.path == '/api/snapshot':
            # This endpoint is now obsolete as the backend handles snapshots automatically.
            # Keeping it around to avoid 404s if the frontend accidentally hits it.
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": "Automatic snapshots enabled"}).encode('utf-8'))
            
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    # Start the automated background worker thread
    worker = threading.Thread(target=automated_snapshot_worker, daemon=True)
    worker.start()
    
    with socketserver.TCPServer(("", PORT), SimpleHTTPRequestHandler) as httpd:
        print(f"Serving at port {PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
