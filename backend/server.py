import http.server
import socketserver
import json
import os
import urllib.request
from urllib.parse import urlparse, parse_qs

PORT = 5000
DATA_FILE = 'students.json'

def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=4)

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
            github_api_url = f"https://api.github.com/users/{username}"
            
            try:
                # We must add a User-Agent, GitHub requires it
                req = urllib.request.Request(github_api_url, headers={'User-Agent': 'Student-Analytics-Dashboard'})
                with urllib.request.urlopen(req) as response:
                    github_data = json.loads(response.read().decode())
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(github_data).encode('utf-8'))
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self._send_cors_headers()
                self.end_headers()
            except Exception as e:
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                
        elif parsed_url.path == '/api/leetcode':
            query_components = parse_qs(parsed_url.query)
            if 'username' not in query_components:
                self.send_response(400)
                self.end_headers()
                return
                
            username = query_components['username'][0]
            # Using the Faisal Shohag LeetCode API which handles rate limits better
            leetcode_api_url = f"https://leetcode-api-faisalshohag.vercel.app/{username}"
            
            try:
                req = urllib.request.Request(leetcode_api_url, headers={'User-Agent': 'Student-Analytics-Dashboard'})
                with urllib.request.urlopen(req) as response:
                    leetcode_data = json.loads(response.read().decode())
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(leetcode_data).encode('utf-8'))
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self._send_cors_headers()
                self.end_headers()
            except Exception as e:
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
        elif parsed_url.path == '/api/kaggle':
            query_components = parse_qs(parsed_url.query)
            if 'username' not in query_components:
                self.send_response(400)
                self.end_headers()
                return
                
            username = query_components['username'][0]
            
            # Since Kaggle actively blocks scrapers, we mock this data for now
            # to keep the dashboard functional without requiring API tokens.
            mock_kaggle_data = {
                "username": username,
                "competitions": 2,
                "datasets": 1,
                "notebooks": 5
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(mock_kaggle_data).encode('utf-8'))
            
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
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            response = {"status": "success", "message": "Student registered successfully!"}
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), SimpleHTTPRequestHandler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()
