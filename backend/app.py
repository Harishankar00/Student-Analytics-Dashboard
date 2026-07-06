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

import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin SDK
cred = credentials.Certificate("firebase-service-account.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def load_data():
    try:
        docs = db.collection('students').stream()
        students = []
        for doc in docs:
            data = doc.to_dict()
            data['name'] = doc.id
            students.append(data)
        return students
    except Exception as e:
        print(f"Error loading students from Firestore: {e}")
        return []

def save_data(data):
    try:
        for student in data:
            email = student.get("name")
            if email:
                doc_data = {k: v for k, v in student.items() if k != "name"}
                db.collection('students').document(email).set(doc_data)
    except Exception as e:
        print(f"Error saving students to Firestore: {e}")

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

    for student in students:
        email = student.get("name")
        if not email:
            continue
            
        git_data = fetch_github(student.get("github"))
        leet_data = fetch_leetcode(student.get("leetcode"))
        kag_data = fetch_kaggle(student.get("kaggle"), student.get("kaggle_key"))
        
        github_metrics = git_data if git_data else None
        
        leetcode_metrics = None
        if leet_data and "totalSolved" in leet_data:
            leetcode_metrics = {
                "totalSolved": leet_data.get("totalSolved", 0),
                "easy": leet_data.get("easySolved", 0),
                "medium": leet_data.get("mediumSolved", 0),
                "hard": leet_data.get("hardSolved", 0)
            }
            
        kaggle_metrics = {
            "competitions": kag_data.get("competitions", 0),
            "datasets": kag_data.get("datasets", 0),
            "notebooks": kag_data.get("notebooks", 0),
            "status": kag_data.get("status", "Unknown")
        }
        
        current_metrics = {
            "github": github_metrics,
            "leetcode": leetcode_metrics,
            "kaggle": kaggle_metrics
        }
        
        try:
            snapshots_ref = db.collection('students').document(email).collection('snapshots')
            latest_snap_query = snapshots_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).get()
            
            if latest_snap_query:
                latest_snap = latest_snap_query[0].to_dict()
                if latest_snap.get("metrics") == current_metrics:
                    print(f"No changes for {email} since last snapshot. Discarding duplicate.")
                    continue
                    
            print(f"Changes detected for {email}! Saving new snapshot.")
            snapshots_ref.add({
                'timestamp': datetime.datetime.now().isoformat(),
                'metrics': current_metrics
            })
        except Exception as snap_err:
            print(f"Error saving snapshot for {email}: {snap_err}")

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
        
    try:
        snapshots_ref = db.collection('students').document(email).collection('snapshots')
        latest_snap_query = snapshots_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).get()
        
        latest_metrics = {}
        if latest_snap_query:
            latest_metrics = latest_snap_query[0].to_dict().get("metrics", {})
            
        # Calculate dynamic evaluation scores (0 to 100)
        leetcode_metrics = latest_metrics.get("leetcode", {}) or {}
        easy_count = leetcode_metrics.get("easy", 0) if leetcode_metrics else 0
        med_count = leetcode_metrics.get("medium", 0) if leetcode_metrics else 0
        hard_count = leetcode_metrics.get("hard", 0) if leetcode_metrics else 0
        problem_solving_score = min(100, (easy_count * 5 + med_count * 15 + hard_count * 30))
        
        github_metrics = latest_metrics.get("github", {}) or {}
        repos_count = github_metrics.get("repos", 0) if github_metrics else 0
        commits_count = github_metrics.get("totalCommits", 0) if github_metrics else 0
        dev_activity_score = min(100, (repos_count * 2 + commits_count // 3))
        
        kaggle_metrics = latest_metrics.get("kaggle", {}) or {}
        datasets_count = kaggle_metrics.get("datasets", 0) if kaggle_metrics else 0
        notebooks_count = kaggle_metrics.get("notebooks", 0) if kaggle_metrics else 0
        data_science_score = min(100, (datasets_count * 10 + notebooks_count * 4))
        
        current_streak = github_metrics.get("currentStreak", 0) if github_metrics else 0
        longest_streak = github_metrics.get("longestStreak", 0) if github_metrics else 0
        consistency_score = min(100, (current_streak * 10 + longest_streak * 2))
        
        evaluation = {
            "problem_solving": problem_solving_score,
            "development": dev_activity_score,
            "data_science": data_science_score,
            "consistency": consistency_score
        }
        
        return jsonify({
            "student": {
                "name": student.get("name"),
                "github": student.get("github"),
                "leetcode": student.get("leetcode"),
                "kaggle": student.get("kaggle")
            },
            "metrics": latest_metrics,
            "evaluation": evaluation
        }), 200
    except Exception as err:
        print(f"Error loading student details: {err}")
        return jsonify({"error": str(err)}), 500

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
    
    repos = git_data.get("repos", 0) if git_data else 0
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
            
    # Find student email by github user
    students = load_data()
    student = next((s for s in students if s.get("github") == github_user), None)
    
    consistency = "Unknown"
    if student:
        email = student.get("name")
        try:
            snapshots_ref = db.collection('students').document(email).collection('snapshots')
            snaps_query = snapshots_ref.order_by('timestamp').get()
            
            if len(snaps_query) >= 2:
                oldest = snaps_query[0].to_dict()
                newest = snaps_query[-1].to_dict()
                
                old_solved = oldest.get("metrics", {}).get("leetcode", {}).get("totalSolved", 0) if oldest.get("metrics", {}).get("leetcode") else 0
                old_repos = oldest.get("metrics", {}).get("github", {}).get("repos", 0) if oldest.get("metrics", {}).get("github") else 0
                
                new_solved = newest.get("metrics", {}).get("leetcode", {}).get("totalSolved", 0) if newest.get("metrics", {}).get("leetcode") else 0
                new_repos = newest.get("metrics", {}).get("github", {}).get("repos", 0) if newest.get("metrics", {}).get("github") else 0
                
                solved_diff = new_solved - old_solved
                repos_diff = new_repos - old_repos
                
                if solved_diff > 0 or repos_diff > 0:
                    consistency = "Active"
                else:
                    consistency = "Inactive"
        except Exception as snap_err:
            print(f"Error fetching snapshots for consistency: {snap_err}")
            
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

@app.route('/api/student/<email>/goals', methods=['GET', 'POST', 'OPTIONS'])
def manage_goals(email):
    if request.method == 'OPTIONS':
        return '', 204
        
    goals_ref = db.collection('students').document(email).collection('goals')
    
    if request.method == 'POST':
        goal_data = request.json
        if not goal_data or not goal_data.get("title") or not goal_data.get("category") or not goal_data.get("target"):
            return jsonify({"error": "Missing goal data"}), 400
            
        new_goal = {
            "title": goal_data["title"],
            "category": goal_data["category"],
            "target": int(goal_data["target"]),
            "current": 0,
            "status": "In Progress",
            "createdAt": datetime.date.today().strftime('%Y-%m-%d')
        }
        
        doc_ref = goals_ref.add(new_goal)
        new_goal["id"] = doc_ref[1].id
        return jsonify(new_goal), 201
        
    # GET method
    try:
        snapshots_ref = db.collection('students').document(email).collection('snapshots')
        latest_snap_query = snapshots_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).get()
        latest_metrics = {}
        if latest_snap_query:
            latest_metrics = latest_snap_query[0].to_dict().get("metrics", {})
            
        goals_query = goals_ref.get()
        goals_list = []
        
        for doc in goals_query:
            goal = doc.to_dict()
            goal["id"] = doc.id
            
            category = goal.get("category")
            target = goal.get("target", 0)
            current = 0
            
            if category == 'leetcode_total':
                current = latest_metrics.get("leetcode", {}).get("totalSolved", 0) if latest_metrics.get("leetcode") else 0
            elif category == 'leetcode_easy':
                current = latest_metrics.get("leetcode", {}).get("easy", 0) if latest_metrics.get("leetcode") else 0
            elif category == 'leetcode_medium':
                current = latest_metrics.get("leetcode", {}).get("medium", 0) if latest_metrics.get("leetcode") else 0
            elif category == 'leetcode_hard':
                current = latest_metrics.get("leetcode", {}).get("hard", 0) if latest_metrics.get("leetcode") else 0
            elif category == 'github_commits':
                current = latest_metrics.get("github", {}).get("totalCommits", 0) if latest_metrics.get("github") else 0
            elif category == 'github_repos':
                current = latest_metrics.get("github", {}).get("repos", 0) if latest_metrics.get("github") else 0
            elif category == 'kaggle_datasets':
                current = latest_metrics.get("kaggle", {}).get("datasets", 0) if latest_metrics.get("kaggle") else 0
            elif category == 'kaggle_notebooks':
                current = latest_metrics.get("kaggle", {}).get("notebooks", 0) if latest_metrics.get("kaggle") else 0
                
            goal["current"] = current
            if current >= target:
                goal["status"] = "Completed"
            else:
                goal["status"] = "In Progress"
                
            goals_ref.document(doc.id).update({
                "current": current,
                "status": goal["status"]
            })
            
            goals_list.append(goal)
            
        return jsonify(goals_list), 200
    except Exception as err:
        print(f"Error managing goals: {err}")
        return jsonify({"error": str(err)}), 500

@app.route('/api/student/<email>/goals/<goal_id>', methods=['DELETE', 'OPTIONS'])
def delete_goal(email, goal_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db.collection('students').document(email).collection('goals').document(goal_id).delete()
        return jsonify({"status": "success", "message": "Goal deleted successfully"}), 200
    except Exception as err:
        return jsonify({"error": str(err)}), 500

if __name__ == '__main__':
    worker = threading.Thread(target=automated_snapshot_worker, daemon=True)
    worker.start()
    app.run(port=5000, debug=True, use_reloader=False)
