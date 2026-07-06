import os
import json
import urllib.request

env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip('"\'')

github_token = os.environ.get("GITHUB_TOKEN")
username = "Harishankar00"

print(f"Token present: {bool(github_token)}")

url = "https://api.github.com/graphql"
query = """
            query getUserProfile($username: String!) {
              user(login: $username) {
                followers { totalCount }
                repositories(first: 60, ownerAffiliations: OWNER, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
                  totalCount
                  nodes {
                    name
                  }
                }
                contributionsCollection {
                  contributionCalendar {
                    totalContributions
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
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode())
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())
