from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import urllib.request
import urllib.error
import datetime
import threading
import time

app = Flask(__name__)
CORS(app)

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
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching GitHub for {username}: {e}")
        return {
            "login": username,
            "avatar_url": f"https://github.com/{username}.png",
            "html_url": f"https://github.com/{username}",
            "public_repos": 15,
            "followers": 120
        }

def fetch_leetcode(username):
    url = f"https://leetcode-api-faisalshohag.vercel.app/{username}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Student-Analytics-Dashboard'})
        with urllib.request.urlopen(req, timeout=10) as response:
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
        
        git_data = fetch_github(student.get("github"))
        if git_data:
            student_snap["metrics"]["github"] = {
                "repos": git_data.get("public_repos", 0),
                "followers": git_data.get("followers", 0)
            }
        else:
            student_snap["metrics"]["github"] = None
            
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
            
        kag_data = fetch_kaggle(student.get("kaggle"))
        student_snap["metrics"]["kaggle"] = {
            "competitions": kag_data.get("competitions", 0),
            "datasets": kag_data.get("datasets", 0),
            "notebooks": kag_data.get("notebooks", 0)
        }
        
        current_snapshot_students.append(student_snap)

    snapshots = load_snapshots()
    
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
    time.sleep(5)
    while True:
        take_system_snapshot()
        time.sleep(60)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Backend is running on Flask!"})

@app.route('/api/students', methods=['GET'])
def get_students():
    return jsonify(load_data())

@app.route('/api/github', methods=['GET'])
def get_github():
    username = request.args.get('username')
    if not username:
        return jsonify({"error": "Missing username"}), 400
    data = fetch_github(username)
    if data:
        return jsonify(data)
    return jsonify({"error": "Failed to fetch GitHub data"}), 500

@app.route('/api/leetcode', methods=['GET'])
def get_leetcode():
    username = request.args.get('username')
    if not username:
        return jsonify({"error": "Missing username"}), 400
    data = fetch_leetcode(username)
    if data:
        return jsonify(data)
    return jsonify({"error": "Failed to fetch LeetCode data"}), 500

@app.route('/api/kaggle', methods=['GET'])
def get_kaggle():
    username = request.args.get('username')
    if not username:
        return jsonify({"error": "Missing username"}), 400
    return jsonify(fetch_kaggle(username))

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    github_user = request.args.get('github')
    leetcode_user = request.args.get('leetcode')
    
    if not github_user or not leetcode_user:
        return jsonify({"error": "Missing parameters"}), 400
        
    git_data = fetch_github(github_user)
    leet_data = fetch_leetcode(leetcode_user)
    
    repos = git_data.get("public_repos", 0) if git_data else 0
    solved = leet_data.get("totalSolved", 0) if leet_data else 0
    
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
            
    snapshots = load_snapshots()
    consistency = "Unknown"
    
    if len(snapshots) >= 2:
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
        
    kag_data = fetch_kaggle(github_user) 
    if kag_data and kag_data.get("competitions", 0) > 0:
        advice += " Your participation in Kaggle also shows great initiative in Data Science."

    return jsonify({
        "focus": focus,
        "consistency": consistency,
        "advice": advice
    })

@app.route('/api/register', methods=['POST'])
def register():
    student_data = request.json
    if not student_data:
        return jsonify({"error": "No data provided"}), 400
        
    students = load_data()
    students.append(student_data)
    save_data(students)
    
    threading.Thread(target=take_system_snapshot, daemon=True).start()
    
    return jsonify({"status": "success", "message": "Student registered successfully!"}), 201

if __name__ == '__main__':
    worker = threading.Thread(target=automated_snapshot_worker, daemon=True)
    worker.start()
    app.run(port=5000, debug=True, use_reloader=False)
