from datetime import datetime
import json
import os
from typing import Dict, Optional

import jwt
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from github import Github
from pydantic import BaseModel

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
ADMIN_PASSWORD = os.getenv("CVAS_ADMIN_PASSWORD", "default_password")
JWT_SECRET = os.getenv("CVAS_JWT_SECRET", "your-secret-key")
GITHUB_PAT = os.getenv("CVAS_GITHUB_PAT")
GITHUB_REPO = "AlexandrosLiaskos/Cvas_RD"

# Models
class AuthRequest(BaseModel):
    password: str

class ResourceEntry(BaseModel):
    category: str
    entry: Dict

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )

@app.post("/api/auth")
async def authenticate(auth_request: AuthRequest):
    try:
        if auth_request.password == ADMIN_PASSWORD:
            token = jwt.encode(
                {"exp": datetime.now().timestamp() + 3600},  # 1 hour expiration
                JWT_SECRET,
                algorithm="HS256"
            )
            return JSONResponse(
                content={"token": token},
                status_code=200
            )
        return JSONResponse(
            content={"detail": "Invalid password"},
            status_code=401
        )
    except Exception as e:
        return JSONResponse(
            content={"detail": str(e)},
            status_code=500
        )

async def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(" ")[1]
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return token

@app.post("/api/add-resource")
async def add_resource(resource: ResourceEntry, token: str = Depends(verify_token)):
    try:
        # Load existing data
        with open("resources.json", "r") as f:
            resources = json.load(f)

        # Add new entry
        category = resource.category
        entry = resource.entry
        entry["dateAdded"] = datetime.now().strftime("%Y-%m-%d")

        if category not in resources:
            resources[category] = []

        resources[category].append(entry)
        resources["metadata"]["lastUpdated"] = datetime.now().isoformat()
        resources["metadata"]["counts"][category] = len(resources[category])

        # Save locally
        with open("resources.json", "w") as f:
            json.dump(resources, f, indent=2)

        # Push to GitHub if token is available
        if GITHUB_PAT:
            try:
                g = Github(GITHUB_PAT)
                repo = g.get_repo(GITHUB_REPO)
                file_content = repo.get_contents("resources.json")
                repo.update_file(
                    "resources.json",
                    f"Added new {category} resource: {entry['title']}",
                    json.dumps(resources, indent=2),
                    file_content.sha,
                )
            except Exception as e:
                print(f"GitHub sync error: {e}")
                # Continue even if GitHub sync fails

        return JSONResponse(
            content={"status": "success"},
            status_code=200
        )
    except Exception as e:
        return JSONResponse(
            content={"detail": str(e)},
            status_code=500
        )

@app.get("/")
async def root():
    return JSONResponse(
        content={"status": "ok", "message": "CVAS API is running"},
        status_code=200
    )

@app.options("/api/auth")
async def auth_options():
    return JSONResponse(
        content={},
        status_code=200
    )