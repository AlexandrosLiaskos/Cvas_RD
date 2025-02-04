from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
from datetime import datetime
import jwt
from github import Github
import hashlib
import hmac
import time

# These would be set as environment variables in GitHub
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'default_password')  # Change in production
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')  # Change in production
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GITHUB_REPO = "AlexandrosLiaskos/Cvas_RD"

class DatabaseHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        # Authentication endpoint
        if self.path == '/api/auth':
            try:
                data = json.loads(post_data.decode('utf-8'))
                if data.get('password') == ADMIN_PASSWORD:
                    # Generate JWT token
                    token = jwt.encode(
                        {'exp': time.time() + 3600},  # 1 hour expiration
                        JWT_SECRET,
                        algorithm='HS256'
                    )
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'token': token}).encode())
                else:
                    self.send_response(401)
                    self.end_headers()
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                print(f"Auth error: {e}")
            return

        # Add resource endpoint
        elif self.path == '/api/add-resource':
            try:
                # Verify JWT token
                auth_header = self.headers.get('Authorization')
                if not auth_header or not auth_header.startswith('Bearer '):
                    self.send_response(401)
                    self.end_headers()
                    return

                token = auth_header.split(' ')[1]
                try:
                    jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
                except jwt.ExpiredSignatureError:
                    self.send_response(401)
                    self.end_headers()
                    return
                except jwt.InvalidTokenError:
                    self.send_response(401)
                    self.end_headers()
                    return

                # Process the new resource
                data = json.loads(post_data.decode('utf-8'))
                
                # Load existing data
                with open('resources.json', 'r') as f:
                    resources = json.load(f)
                
                # Add new entry
                category = data['category']
                entry = data['entry']
                entry['dateAdded'] = datetime.now().strftime('%Y-%m-%d')
                
                if category not in resources:
                    resources[category] = []
                
                resources[category].append(entry)
                resources['metadata']['lastUpdated'] = datetime.now().isoformat()
                resources['metadata']['counts'][category] = len(resources[category])
                
                # Save locally
                with open('resources.json', 'w') as f:
                    json.dump(resources, f, indent=2)

                # Push to GitHub if token is available
                if GITHUB_TOKEN:
                    try:
                        g = Github(GITHUB_TOKEN)
                        repo = g.get_repo(GITHUB_REPO)
                        
                        # Get the current file content
                        file_content = repo.get_contents("resources.json")
                        
                        # Update the file in GitHub
                        repo.update_file(
                            "resources.json",
                            f"Added new {category} resource: {entry['title']}",
                            json.dumps(resources, indent=2),
                            file_content.sha
                        )
                    except Exception as e:
                        print(f"GitHub sync error: {e}")
                        # Continue even if GitHub sync fails
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'error',
                    'message': str(e)
                }).encode())
            return

        return super().do_POST()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    required_packages = ['pyjwt', 'PyGithub']
    try:
        import pkg_resources
        pkg_resources.require(required_packages)
    except (ImportError, pkg_resources.DistributionNotFound):
        print("Installing required packages...")
        import subprocess
        subprocess.check_call(['pip3', 'install'] + required_packages)
        
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, DatabaseHandler)
    print('Server running on port 8000...')
    httpd.serve_forever()