import requests
import json

# Replace with your actual Railway URL
url = "https://cvas-rd-production.up.railway.app/api/auth"

# Test data
data = {
    "password": "default_password"  # This should match your CVAS_ADMIN_PASSWORD env variable
}

# Make the POST request
response = requests.post(url, json=data)

# Print the results
print(f"Status Code: {response.status_code}")
print("Response:")
print(json.dumps(response.json() if response.status_code == 200 else response.text, indent=2))