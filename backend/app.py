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

import os

# Quick .env loader since python-dotenv might not be installed
if os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip('"\'')

def fetch_github(username):
    if not username:
        return None
    github_token = os.environ.get("GITHUB_TOKEN")
    
    try:
        if github_token:
            # Use powerful GraphQL API
            url = "https://api.github.com/graphql"
            query = """
            query getUserProfile($username: String!) {
              user(login: $username) {
                followers { totalCount }
                repositories(first: 60, ownerAffiliations: OWNER, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
                  totalCount
                  nodes {
                    name
                    description
                    url
                    stargazerCount
                    primaryLanguage {
                      name
                      color
                    }
                  }
                }
                contributionsCollection {
                  contributionCalendar {
                    totalContributions
                    weeks {
                      contributionDays {
                        contributionCount
                        date
                      }
                    }
                  }
                }
              }
            }
            """
            payload = json.dumps({"query": query, "variables": {"username": username}}).encode('utf-8')
            req = urllib.request.Request(url, data=payload, headers={
                'User-Agent': 'Mozilla/5.0',
                'Authorization': f'bearer {github_token}',
                'Content-Type': 'application/json'
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())
                
                if "errors" in data or not data.get("data", {}).get("user"):
                    return None
                    
                user_data = data["data"]["user"]
                
                # Calculate streaks and commits
                calendar = user_data["contributionsCollection"]["contributionCalendar"]
                total_commits = calendar["totalContributions"]
                days = []
                raw_days = {}
                for week in calendar["weeks"]:
                    for day in week["contributionDays"]:
                        days.append(day["contributionCount"])
                        raw_days[day["date"]] = day["contributionCount"]
                        
                current_streak = 0
                longest_streak = 0
                for count in days:
                    if count > 0:
                        current_streak += 1
                        longest_streak = max(longest_streak, current_streak)
                    else:
                        current_streak = 0
                
                # Calculate languages & top projects
                repos = user_data["repositories"]["nodes"]
                lang_counts = {}
                top_projects = []
                for r in repos:
                    if len(top_projects) < 4:
                        top_projects.append({
                            "name": r["name"],
                            "description": r.get("description") or "",
                            "url": r["url"],
                            "stars": r["stargazerCount"],
                            "language": r["primaryLanguage"]["name"] if r.get("primaryLanguage") else "Unknown",
                            "color": r["primaryLanguage"]["color"] if r.get("primaryLanguage") else "#ccc"
                        })
                        
                    if r.get("primaryLanguage"):
                        lang = r["primaryLanguage"]["name"]
                        color = r["primaryLanguage"]["color"] or "#cccccc"
                        if lang not in lang_counts:
                            lang_counts[lang] = {"count": 0, "color": color}
                        lang_counts[lang]["count"] += 1
                        
                languages = [
                    {"name": k, "count": v["count"], "color": v["color"]}
                    for k, v in sorted(lang_counts.items(), key=lambda x: x[1]["count"], reverse=True)
                ]
                
                return {
                    "followers": user_data["followers"]["totalCount"],
                    "repos": user_data["repositories"]["totalCount"],
                    "totalCommits": total_commits,
                    "currentStreak": current_streak,
                    "longestStreak": longest_streak,
                    "languages": languages,
                    "topProjects": top_projects,
                    "rawDays": raw_days
                }
        else:
            # Fallback to REST API
            req = urllib.request.Request(f"https://api.github.com/users/{username}", headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                return {
                    "followers": data.get("followers", 0),
                    "repos": data.get("public_repos", 0),
                    "totalCommits": 0,
                    "currentStreak": 0,
                    "longestStreak": 0,
                    "languages": [],
                    "topProjects": []
                }
    except Exception as e:
        print(f"Error fetching GitHub for {username}: {e}")
        return None

def fetch_leetcode(username):
    if not username:
        return None
    try:
        # Direct GraphQL query to LeetCode (avoids third-party proxy limits)
        url = "https://leetcode.com/graphql"
        query = """
        query getUserProfile($username: String!) {
          matchedUser(username: $username) {
            submitStats: submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
              }
            }
            userCalendar {
              submissionCalendar
            }
          }
        }
        """
        payload = json.dumps({
            "query": query,
            "variables": {"username": username}
        }).encode('utf-8')
        
        req = urllib.request.Request(url, data=payload, headers={
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
        })
        
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            if not data.get("data") or not data["data"].get("matchedUser"):
                return None
                
            matched_user = data["data"]["matchedUser"]
            stats = matched_user["submitStats"]["acSubmissionNum"]
            result = {"totalSolved": 0, "easySolved": 0, "mediumSolved": 0, "hardSolved": 0}
            
            for stat in stats:
                if stat["difficulty"] == "All":
                    result["totalSolved"] = stat["count"]
                elif stat["difficulty"] == "Easy":
                    result["easySolved"] = stat["count"]
                elif stat["difficulty"] == "Medium":
                    result["mediumSolved"] = stat["count"]
                elif stat["difficulty"] == "Hard":
                    result["hardSolved"] = stat["count"]
                    
            calendar_str = matched_user.get("userCalendar", {}).get("submissionCalendar", "{}")
            submission_calendar = json.loads(calendar_str)
            raw_solves = {}
            for ts, count in submission_calendar.items():
                date_str = datetime.datetime.utcfromtimestamp(int(ts)).strftime('%Y-%m-%d')
                raw_solves[date_str] = count
                
            result["rawSolves"] = raw_solves
            return result
    except Exception as e:
        print(f"Error fetching LeetCode for {username}: {e}")
        return None

import base64

def fetch_kaggle(username, key=None):
    if not username or not key:
        return {"username": username, "status": "Not Linked", "datasets": 0, "competitions": 0, "notebooks": 0}
        
    try:
        # Verify auth by fetching user's datasets via official API
        url = f"https://www.kaggle.com/api/v1/datasets/list?user={username}"
        req = urllib.request.Request(url)
        
        auth_str = f"{username}:{key}"
        base64_str = base64.b64encode(auth_str.encode('ascii')).decode('ascii')
        req.add_header("Authorization", f"Basic {base64_str}")
        
        with urllib.request.urlopen(req, timeout=10) as response:
            datasets = json.loads(response.read().decode())
            dataset_count = len(datasets)
            
        # Fetch notebooks/kernels
        notebook_count = 0
        try:
            url_kernels = f"https://www.kaggle.com/api/v1/kernels/list?user={username}"
            req_kernels = urllib.request.Request(url_kernels)
            req_kernels.add_header("Authorization", f"Basic {base64_str}")
            with urllib.request.urlopen(req_kernels, timeout=10) as response:
                kernels = json.loads(response.read().decode())
                notebook_count = len(kernels)
        except Exception as kernel_e:
            print(f"Warning fetching Kaggle kernels for {username}: {kernel_e}")
            
        return {
            "username": username,
            "datasets": dataset_count,
            "competitions": 0, # Placeholder as official API lacks profile stats
            "notebooks": notebook_count,
            "status": "Linked"
        }
    except Exception as e:
        print(f"Error fetching Kaggle for {username}: {e}")
        return {"username": username, "status": "Error", "datasets": 0, "competitions": 0, "notebooks": 0}

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
            student_snap["metrics"]["github"] = git_data
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
            
        kag_data = fetch_kaggle(student.get("kaggle"), student.get("kaggle_key"))
        student_snap["metrics"]["kaggle"] = {
            "competitions": kag_data.get("competitions", 0),
            "datasets": kag_data.get("datasets", 0),
            "notebooks": kag_data.get("notebooks", 0),
            "status": kag_data.get("status", "Unknown")
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
        time.sleep(900)  # Sleep for 15 minutes to avoid rate limits

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Backend is running on Flask!"})

@app.route('/api/students', methods=['GET'])
def get_students():
    return jsonify(load_data())

@app.route('/api/student/<email>/history', methods=['GET'])
def get_student_history(email):
    students = load_data()
    student = next((s for s in students if s.get("name") == email), None)
    if not student:
        return jsonify([])
        
    github_user = student.get("github")
    leetcode_user = student.get("leetcode")
    
    github_data = fetch_github(github_user)
    leetcode_data = fetch_leetcode(leetcode_user)
    
    github_days = github_data.get("rawDays", {}) if github_data else {}
    leetcode_days = leetcode_data.get("rawSolves", {}) if leetcode_data else {}
    
    today = datetime.date.today()
    history_data = []
    
    for i in range(29, -1, -1):
        d = today - datetime.timedelta(days=i)
        date_str = d.strftime('%Y-%m-%d')
        display_date = d.strftime('%b %d')
        
        history_data.append({
            "timestamp": date_str,
            "time": display_date,
            "commits": github_days.get(date_str, 0),
            "solves": leetcode_days.get(date_str, 0)
        })
        
    return jsonify(history_data)

@app.route('/api/student/<email>', methods=['GET'])
def get_student(email):
    students = load_data()
    student = next((s for s in students if s.get("name") == email), None)
    if not student:
        return jsonify({"error": "Student not found"}), 404
        
    snapshots = load_snapshots()
    latest_metrics = {}
    if snapshots:
        last_snap = snapshots[-1]
        for s in last_snap.get("students", []):
            if s.get("name") == email:
                latest_metrics = s.get("metrics", {})
                break
                
    return jsonify({
        "student": {
            "name": student.get("name"),
            "github": student.get("github"),
            "leetcode": student.get("leetcode"),
            "kaggle": student.get("kaggle")
        },
        "metrics": latest_metrics
    }), 200

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
    key = request.args.get('key')
    if not username:
        return jsonify({"error": "Missing username"}), 400
    return jsonify(fetch_kaggle(username, key))

@app.route('/api/kaggle-upload', methods=['POST', 'OPTIONS'])
def upload_kaggle():
    if request.method == 'OPTIONS':
        # Handle CORS preflight for the upload endpoint
        return '', 204
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    try:
        content = file.read().decode('utf-8')
        data = json.loads(content)
        username = data.get('username')
        key = data.get('key')
        
        if username and key:
            return jsonify({"username": username, "key": key}), 200
        else:
            return jsonify({"error": "Invalid kaggle.json format"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

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
        
    # Kaggle integration requires key, skipping in simple analytics for now

    return jsonify({
        "focus": focus,
        "consistency": consistency,
        "advice": advice
    })

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 204
    student_data = request.json
    if not student_data or not student_data.get("name"):
        return jsonify({"error": "No valid data provided"}), 400
        
    students = load_data()
    # Update existing student if email matches, else append
    updated = False
    for i, s in enumerate(students):
        if s.get("name") == student_data.get("name"):
            students[i] = student_data
            updated = True
            break
            
    if not updated:
        students.append(student_data)
        
    save_data(students)
    
    threading.Thread(target=take_system_snapshot, daemon=True).start()
    
    return jsonify({"status": "success", "message": "Student registered/updated successfully!"}), 201

if __name__ == '__main__':
    worker = threading.Thread(target=automated_snapshot_worker, daemon=True)
    worker.start()
    app.run(port=5000, debug=True, use_reloader=False)
