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
                os.environ[k.strip()] = v.strip().strip('"\'')

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
                repositories(first: 60, ownerAffiliations: OWNER, isFork: false) {
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
                    defaultBranchRef {
                      target {
                        ... on Commit {
                          history {
                            totalCount
                          }
                        }
                      }
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
                
                repos_with_commits = []
                for r in repos:
                    commit_count = 0
                    if r.get("defaultBranchRef") and r["defaultBranchRef"].get("target"):
                        target = r["defaultBranchRef"]["target"]
                        if target.get("history"):
                            commit_count = target["history"].get("totalCount", 0)
                    repos_with_commits.append((r, commit_count))
                    
                    if r.get("primaryLanguage"):
                        lang = r["primaryLanguage"]["name"]
                        color = r["primaryLanguage"]["color"] or "#cccccc"
                        if lang not in lang_counts:
                            lang_counts[lang] = {"count": 0, "color": color}
                        lang_counts[lang]["count"] += 1
                        
                repos_with_commits.sort(key=lambda x: x[1], reverse=True)
                
                top_projects = []
                for r, cc in repos_with_commits[:4]:
                    top_projects.append({
                        "name": r["name"],
                        "description": r.get("description") or "",
                        "url": r["url"],
                        "stars": r["stargazerCount"],
                        "commits": cc,
                        "language": r["primaryLanguage"]["name"] if r.get("primaryLanguage") else "Unknown",
                        "color": r["primaryLanguage"]["color"] if r.get("primaryLanguage") else "#ccc"
                    })
                    
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
            tagProblemCounts {
              advanced {
                tagName
                problemsSolved
              }
              intermediate {
                tagName
                problemsSolved
              }
              fundamental {
                tagName
                problemsSolved
              }
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
            result = {"totalSolved": 0, "easySolved": 0, "mediumSolved": 0, "hardSolved": 0, "skills": []}
            
            for stat in stats:
                if stat["difficulty"] == "All":
                    result["totalSolved"] = stat["count"]
                elif stat["difficulty"] == "Easy":
                    result["easySolved"] = stat["count"]
                elif stat["difficulty"] == "Medium":
                    result["mediumSolved"] = stat["count"]
                elif stat["difficulty"] == "Hard":
                    result["hardSolved"] = stat["count"]
            
            tag_counts = {}
            if matched_user.get("tagProblemCounts"):
                tpc = matched_user["tagProblemCounts"]
                for category in ["fundamental", "intermediate", "advanced"]:
                    for item in tpc.get(category, []):
                        name = item.get("tagName")
                        solved = item.get("problemsSolved", 0)
                        if name and solved > 0:
                            tag_counts[name] = tag_counts.get(name, 0) + solved
            
            sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            result["skills"] = [{"name": t[0], "solved": t[1]} for t in sorted_tags]
                    
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
        return {"username": username, "status": "Not Linked", "datasets": 0, "competitions": 0, "notebooks": 0, "badge": "Novice", "medals": {"bronze": 0, "silver": 0, "gold": 0}}
        
    try:
        url = "https://www.kaggle.com/api/v1/datasets/list?group=my"
        req = urllib.request.Request(url)
        
        auth_str = f"{username}:{key}"
        base64_str = base64.b64encode(auth_str.encode('ascii')).decode('ascii')
        req.add_header("Authorization", f"Basic {base64_str}")
        req.add_header("User-Agent", "Mozilla/5.0")
        
        with urllib.request.urlopen(req, timeout=10) as response:
            datasets = json.loads(response.read().decode())
            dataset_count = len(datasets)
            
        notebook_count = 0
        kernels = []
        try:
            url_kernels = "https://www.kaggle.com/api/v1/kernels/list?group=profile"
            req_kernels = urllib.request.Request(url_kernels)
            req_kernels.add_header("Authorization", f"Basic {base64_str}")
            req_kernels.add_header("User-Agent", "Mozilla/5.0")
            with urllib.request.urlopen(req_kernels, timeout=10) as response:
                kernels = json.loads(response.read().decode())
                notebook_count = len(kernels)
        except Exception as kernel_e:
            print(f"Warning fetching Kaggle kernels for {username}: {kernel_e}")
            
        dataset_medals = {"bronze": 0, "silver": 0, "gold": 0}
        for d in datasets:
            votes = d.get("voteCount", 0)
            if votes >= 50: dataset_medals["gold"] += 1
            elif votes >= 20: dataset_medals["silver"] += 1
            elif votes >= 2: dataset_medals["bronze"] += 1

        kernel_medals = {"bronze": 0, "silver": 0, "gold": 0}
        for k in kernels:
            votes = k.get("totalVotes", 0)
            if votes >= 50: kernel_medals["gold"] += 1
            elif votes >= 20: kernel_medals["silver"] += 1
            elif votes >= 5: kernel_medals["bronze"] += 1

        bronze = dataset_medals["bronze"] + kernel_medals["bronze"]
        silver = dataset_medals["silver"] + kernel_medals["silver"]
        gold = dataset_medals["gold"] + kernel_medals["gold"]

        if gold > 0:
            badge = "Master"
        elif silver > 0:
            badge = "Expert"
        elif bronze > 0:
            badge = "Contributor"
        else:
            badge = "Novice"
            
        return {
            "username": username,
            "datasets": dataset_count,
            "competitions": 0,
            "notebooks": notebook_count,
            "status": "Linked",
            "badge": badge,
            "medals": {"bronze": bronze, "silver": silver, "gold": gold}
        }
    except Exception as e:
        print(f"Error fetching Kaggle for {username}: {e}")
        return {"username": username, "status": "Error", "datasets": 0, "competitions": 0, "notebooks": 0, "badge": "Novice", "medals": {"bronze": 0, "silver": 0, "gold": 0}}

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
                "hard": leet_data.get("hardSolved", 0),
                "skills": leet_data.get("skills", [])
            }
            
        kaggle_metrics = {
            "competitions": kag_data.get("competitions", 0),
            "datasets": kag_data.get("datasets", 0),
            "notebooks": kag_data.get("notebooks", 0),
            "status": kag_data.get("status", "Unknown"),
            "badge": kag_data.get("badge", "Novice"),
            "medals": kag_data.get("medals", {"bronze": 0, "silver": 0, "gold": 0})
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
        time.sleep(43200)  # Sleep for 12 hours to avoid rate limits

@app.route('/api/student/<email>/sync', methods=['POST', 'OPTIONS'])
def sync_student_data(email):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        students = load_data()
        student = next((s for s in students if s.get("name") == email), None)
        if not student:
            return jsonify({"error": "Student not found"}), 404
            
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
                "hard": leet_data.get("hardSolved", 0),
                "skills": leet_data.get("skills", [])
            }
            
        kaggle_metrics = {
            "competitions": kag_data.get("competitions", 0),
            "datasets": kag_data.get("datasets", 0),
            "notebooks": kag_data.get("notebooks", 0),
            "status": kag_data.get("status", "Unknown"),
            "badge": kag_data.get("badge", "Novice"),
            "medals": kag_data.get("medals", {"bronze": 0, "silver": 0, "gold": 0})
        }
        
        current_metrics = {
            "github": github_metrics,
            "leetcode": leetcode_metrics,
            "kaggle": kaggle_metrics
        }
        
        snapshots_ref = db.collection('students').document(email).collection('snapshots')
        snapshots_ref.add({
            "timestamp": datetime.datetime.now().isoformat(),
            "metrics": current_metrics
        })
        
        # Clear AI Cache timestamp so fresh AI Coach summary is fetched
        db.collection('students').document(email).update({
            "aiLastUpdated": ""
        })
        
        return jsonify({"status": "success", "metrics": current_metrics}), 200
    except Exception as err:
        return jsonify({"error": str(err)}), 500

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

@app.route('/api/admin/cohort', methods=['GET'])
def get_cohort_analytics():
    try:
        students = load_data()
        total_students = len(students)
        if total_students == 0:
            return jsonify({
                "totalStudents": 0,
                "averages": {"avgLeetCode": 0, "avgGitHubCommits": 0, "avgKaggleNotebooks": 0},
                "activeRatio": 0
            })
            
        total_solves = 0
        total_commits = 0
        total_notebooks = 0
        active_count = 0
        
        for student in students:
            email = student.get("name")
            if not email:
                continue
            snapshots_ref = db.collection('students').document(email).collection('snapshots')
            latest_snap_query = snapshots_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).get()
            
            if latest_snap_query:
                snap = latest_snap_query[0].to_dict()
                metrics = snap.get("metrics", {})
                
                total_solves += metrics.get("leetcode", {}).get("totalSolved", 0) if metrics.get("leetcode") else 0
                total_commits += metrics.get("github", {}).get("totalCommits", 0) if metrics.get("github") else 0
                total_notebooks += metrics.get("kaggle", {}).get("notebooks", 0) if metrics.get("kaggle") else 0
                
            snaps_query = snapshots_ref.order_by('timestamp').get()
            if len(snaps_query) >= 2:
                oldest = snaps_query[0].to_dict()
                newest = snaps_query[-1].to_dict()
                
                old_solved = oldest.get("metrics", {}).get("leetcode", {}).get("totalSolved", 0) if oldest.get("metrics", {}).get("leetcode") else 0
                old_repos = oldest.get("metrics", {}).get("github", {}).get("repos", 0) if oldest.get("metrics", {}).get("github") else 0
                
                new_solved = newest.get("metrics", {}).get("leetcode", {}).get("totalSolved", 0) if newest.get("metrics", {}).get("leetcode") else 0
                new_repos = newest.get("metrics", {}).get("github", {}).get("repos", 0) if newest.get("metrics", {}).get("github") else 0
                
                if (new_solved - old_solved) > 0 or (new_repos - old_repos) > 0:
                    active_count += 1
                    
        return jsonify({
            "totalStudents": total_students,
            "averages": {
                "avgLeetCode": round(total_solves / total_students, 1),
                "avgGitHubCommits": round(total_commits / total_students, 1),
                "avgKaggleNotebooks": round(total_notebooks / total_students, 1)
            },
            "activeRatio": round((active_count / total_students) * 100, 1)
        }), 200
    except Exception as err:
        return jsonify({"error": str(err)}), 500

def get_student_side_data(email):
    students = load_data()
    student = next((s for s in students if s.get("name") == email), None)
    if not student:
        return None
        
    snapshots_ref = db.collection('students').document(email).collection('snapshots')
    latest_snap_query = snapshots_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).get()
    
    latest_metrics = {}
    if latest_snap_query:
        latest_metrics = latest_snap_query[0].to_dict().get("metrics", {})
        
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
    
    consistency = "Unknown"
    try:
        snaps_query = snapshots_ref.order_by('timestamp').get()
        if len(snaps_query) >= 2:
            oldest = snaps_query[0].to_dict()
            newest = snaps_query[-1].to_dict()
            
            old_solved = oldest.get("metrics", {}).get("leetcode", {}).get("totalSolved", 0) if oldest.get("metrics", {}).get("leetcode") else 0
            old_repos = oldest.get("metrics", {}).get("github", {}).get("repos", 0) if oldest.get("metrics", {}).get("github") else 0
            
            new_solved = newest.get("metrics", {}).get("leetcode", {}).get("totalSolved", 0) if newest.get("metrics", {}).get("leetcode") else 0
            new_repos = newest.get("metrics", {}).get("github", {}).get("repos", 0) if newest.get("metrics", {}).get("github") else 0
            
            if (new_solved - old_solved) > 0 or (new_repos - old_repos) > 0:
                consistency = "Active"
            else:
                consistency = "Inactive"
    except:
        pass
        
    return {
        "profile": {
            "name": student.get("name"),
            "github": student.get("github"),
            "leetcode": student.get("leetcode"),
            "kaggle": student.get("kaggle"),
            "status": consistency
        },
        "metrics": latest_metrics,
        "evaluation": evaluation
    }

@app.route('/api/admin/comparison', methods=['GET'])
def get_student_comparison():
    email1 = request.args.get('email1')
    email2 = request.args.get('email2')
    if not email1 or not email2:
        return jsonify({"error": "Missing email parameters"}), 400
        
    try:
        data1 = get_student_side_data(email1)
        data2 = get_student_side_data(email2)
        
        if not data1 or not data2:
            return jsonify({"error": "One or both students not found"}), 404
            
        return jsonify({
            "studentA": data1,
            "studentB": data2
        }), 200
    except Exception as err:
        return jsonify({"error": str(err)}), 500

def generate_ai_analysis(prompt):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }]
    }
    headers = {"Content-Type": "application/json"}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=12)
        if response.status_code == 200:
            result = response.json()
            return result["candidates"][0]["content"]["parts"][0]["text"]
        else:
            print(f"Gemini API returned status code {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error querying Gemini API: {e}")
    return None

def clean_and_parse_json(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)

def rule_based_student_summary(metrics, evaluation):
    focus = "Balanced"
    leetcode_solved = metrics.get("leetcode", {}).get("totalSolved", 0) if metrics.get("leetcode") else 0
    github_commits = metrics.get("github", {}).get("totalCommits", 0) if metrics.get("github") else 0
    
    if leetcode_solved > github_commits * 1.5:
        focus = "DSA Focused"
    elif github_commits > leetcode_solved * 1.5:
        focus = "Project Focused"
        
    summary = f"Based on your profile, your primary focus is {focus} with a consistency score of {evaluation.get('consistency', 0)}/100."
    recommendations = []
    
    if focus == "DSA Focused":
        recommendations.append("Build projects: Link your data structure skills with real-world project development by starting a new repository on GitHub.")
        recommendations.append("Deploy a live project: Deploy your codebase so others can view it.")
    elif focus == "Project Focused":
        recommendations.append("Practice algorithms: Dedicate 30 minutes a day to LeetCode to ensure you pass competitive coding interview screenings.")
        recommendations.append("Vary challenges: Solve medium-level array and tree problems.")
    else:
        recommendations.append("Great balance: Keep building projects and practicing LeetCode questions.")
        recommendations.append("Document your work: Write a comprehensive README.md file for your best GitHub projects.")
        
    recommendations.append("Set goals: Use the Goal Tracker below to set daily/weekly practice targets and track progress.")
    
    return {
        "summary": summary,
        "recommendations": recommendations,
        "is_ai": False
    }

def rule_based_cohort_summary(cohort_data):
    avg_solves = cohort_data.get("averages", {}).get("avgLeetCode", 0)
    avg_commits = cohort_data.get("averages", {}).get("avgGitHubCommits", 0)
    active_ratio = cohort_data.get("activeRatio", 0)
    
    summary = f"The class consists of {cohort_data.get('totalStudents', 0)} students. The active participation rate stands at {active_ratio}%."
    recommendations = []
    
    if active_ratio < 50:
        recommendations.append("Engagement warning: Class activity is below 50%. Consider launching a coding sprint or weekly task challenge to motivate students.")
    else:
        recommendations.append("Healthy momentum: Class activity rate is strong. Encourage peer reviews and pair programming sessions.")
        
    if avg_solves < avg_commits:
        recommendations.append("Focus target: Students are active in development but lagging in algorithm practice. Assign 3-5 medium LeetCode exercises.")
    else:
        recommendations.append("Focus target: Good practice on algorithms. Encourage students to push their local solutions to GitHub repositories.")
        
    return {
        "summary": summary,
        "recommendations": recommendations,
        "is_ai": False
    }

@app.route('/api/student/<email>/ai-summary', methods=['GET'])
def get_student_ai_summary(email):
    try:
        student_ref = db.collection('students').document(email)
        student_doc = student_ref.get()
        if student_doc.exists:
            student_data = student_doc.to_dict()
            cached_summary = student_data.get("aiSummary")
            cached_recs = student_data.get("aiRecs")
            cached_time = student_data.get("aiLastUpdated")
            
            if cached_summary and cached_recs and cached_time:
                last_updated = datetime.datetime.fromisoformat(cached_time)
                if (datetime.datetime.now() - last_updated).total_seconds() < 43200:
                    return jsonify({
                        "summary": cached_summary,
                        "recommendations": cached_recs,
                        "is_ai": student_data.get("aiIsAi", False),
                        "cached": True
                    }), 200

        data = get_student_side_data(email)
        if not data:
            return jsonify({"error": "Student not found"}), 404
            
        metrics = data["metrics"]
        evaluation = data["evaluation"]
        
        summary_result = None
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            leet_metrics = metrics.get('leetcode', {}) or {}
            github_metrics = metrics.get('github', {}) or {}
            
            prompt = f"""
            You are an expert AI Coding Coach. Analyze this student's coding metrics and provide a brief summary and 3 recommendations.
            Do NOT include any emojis in your response. Keep the response in strict JSON format:
            {{
              "summary": "1-2 sentence analysis summarizing their focus (DSA vs Projects) and consistency.",
              "recommendations": [
                "Actionable tip 1",
                "Actionable tip 2",
                "Actionable tip 3"
              ]
            }}

            Student Data:
            - GitHub: {github_metrics.get('repos', 0)} repositories, {github_metrics.get('totalCommits', 0)} commits.
            - LeetCode: {leet_metrics.get('totalSolved', 0)} total solved (Easy: {leet_metrics.get('easy', 0)}, Medium: {leet_metrics.get('medium', 0)}, Hard: {leet_metrics.get('hard', 0)}).
            - Consistency Score: {evaluation.get('consistency', 0)}/100.
            
            If the student has high Easy solves but few Medium/Hard solves on LeetCode, recommend they practice more Medium/Hard questions.
            """
            ai_text = generate_ai_analysis(prompt)
            if ai_text:
                try:
                    parsed = clean_and_parse_json(ai_text)
                    summary_result = {
                        "summary": parsed["summary"],
                        "recommendations": parsed["recommendations"],
                        "is_ai": True
                    }
                except Exception as parse_err:
                    print(f"Failed to parse Gemini JSON: {parse_err}. Text: {ai_text}")
                    
        if not summary_result:
            summary_result = rule_based_student_summary(metrics, evaluation)
            
        student_ref.update({
            "aiSummary": summary_result["summary"],
            "aiRecs": summary_result["recommendations"],
            "aiIsAi": summary_result["is_ai"],
            "aiLastUpdated": datetime.datetime.now().isoformat()
        })
        
        return jsonify(summary_result), 200
    except Exception as err:
        return jsonify({"error": str(err)}), 500

@app.route('/api/admin/cohort/ai-summary', methods=['GET'])
def get_cohort_ai_summary():
    try:
        cache_ref = db.collection('settings').document('cohort_ai_summary')
        cache_doc = cache_ref.get()
        if cache_doc.exists:
            cache_data = cache_doc.to_dict()
            cached_summary = cache_data.get("summary")
            cached_recs = cache_data.get("recommendations")
            cached_time = cache_data.get("lastUpdated")
            
            if cached_summary and cached_recs and cached_time:
                last_updated = datetime.datetime.fromisoformat(cached_time)
                if (datetime.datetime.now() - last_updated).total_seconds() < 43200:
                    return jsonify({
                        "summary": cached_summary,
                        "recommendations": cached_recs,
                        "is_ai": cache_data.get("isAi", False),
                        "cached": True
                    }), 200

        cohort_res = get_cohort_analytics()
        cohort_data = cohort_res[0].json
        
        summary_result = None
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            prompt = f"""
            You are an expert Education Administrator AI. Analyze this cohort's performance metrics and provide a summary and 3 recommendations.
            Do NOT include any emojis in your response. Keep the response in strict JSON format:
            {{
              "summary": "1-2 sentence summary of overall class engagement and performance.",
              "recommendations": [
                "Actionable item for instructor 1",
                "Actionable item for instructor 2",
                "Actionable item for instructor 3"
              ]
            }}

            Cohort Data:
            - Total Students: {cohort_data.get('totalStudents', 0)}
            - Average GitHub Commits: {cohort_data.get('averages', {}).get('avgGitHubCommits', 0)}
            - Average LeetCode Solves: {cohort_data.get('averages', {}).get('avgLeetCode', 0)}
            - Class Active Ratio: {cohort_data.get('activeRatio', 0)}%
            """
            ai_text = generate_ai_analysis(prompt)
            if ai_text:
                try:
                    parsed = clean_and_parse_json(ai_text)
                    summary_result = {
                        "summary": parsed["summary"],
                        "recommendations": parsed["recommendations"],
                        "is_ai": True
                    }
                except Exception as parse_err:
                    print(f"Failed to parse Gemini JSON for cohort: {parse_err}. Text: {ai_text}")
                    
        if not summary_result:
            summary_result = rule_based_cohort_summary(cohort_data)
            
        cache_ref.set({
            "summary": summary_result["summary"],
            "recommendations": summary_result["recommendations"],
            "isAi": summary_result["is_ai"],
            "lastUpdated": datetime.datetime.now().isoformat()
        })
        
        return jsonify(summary_result), 200
    except Exception as err:
        return jsonify({"error": str(err)}), 500

if __name__ == '__main__':
    worker = threading.Thread(target=automated_snapshot_worker, daemon=True)
    worker.start()
    app.run(port=5000, debug=True, use_reloader=False)
