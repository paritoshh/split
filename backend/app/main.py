"""
===========================================
MAIN APPLICATION ENTRY POINT
===========================================
This is where our FastAPI application starts.

What this file does:
1. Creates the FastAPI app
2. Sets up CORS (allows frontend to call our API)
3. Connects all the routers (auth, groups, expenses)
4. Creates database tables on startup
5. Provides a health check endpoint

To run the server:
    cd backend
    uvicorn app.main:app --reload

--reload: Auto-restart when code changes (for development)

After running, visit:
- http://localhost:8000 - Welcome message
- http://localhost:8000/docs - Interactive API documentation
- http://localhost:8000/redoc - Alternative docs
===========================================
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.routers import auth, groups, expenses, notifications, settlements, ai


# --- Lifespan Event Handler ---
# This runs when the app starts up and shuts down
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events.
    
    On startup:
    - Create all database tables if they don't exist
    
    This uses SQLAlchemy's create_all() which:
    - Looks at all models (User, Group, Expense, etc.)
    - Creates tables in database if they don't exist
    - Does nothing if tables already exist
    """
    print("🚀 Starting up Split App...")
    print("📦 Creating database tables...")
    
    # Import all models so SQLAlchemy knows about them
    from app.models import User, Group, GroupMember, Expense, ExpenseSplit, Notification, Settlement
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready!")
    
    yield  # App runs here
    
    # Shutdown
    print("👋 Shutting down Split App...")


# --- Create FastAPI Application ---
app = FastAPI(
    title="Split App API",
    description="""
## 🏸💰 Expense Sharing Made Easy

Split App helps you and your friends track shared expenses and settle up easily.

### Features
- 👥 Create groups for different activities
- 💸 Track expenses with flexible splitting options
- 📊 See who owes whom
- 🤖 AI-powered features (coming soon!)

### Authentication
Most endpoints require a JWT token. Get one by:
1. Register: `POST /api/auth/register`
2. Login: `POST /api/auth/login`
3. Use the token in Authorization header: `Bearer <your_token>`
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# --- CORS Middleware ---
# CORS = Cross-Origin Resource Sharing
# This allows our frontend (running on a different port) to call our API
# Without this, browsers block requests from frontend to backend

# Parse allowed origins from settings
origins = [origin.strip() for origin in settings.allowed_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Which URLs can call our API
    allow_credentials=True,  # Allow cookies/auth headers
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


# --- Include Routers ---
# Each router handles a group of related endpoints
# They're like mini-apps that we combine into one

app.include_router(auth.router)           # /api/auth/* endpoints
app.include_router(groups.router)         # /api/groups/* endpoints
app.include_router(expenses.router)       # /api/expenses/* endpoints
app.include_router(notifications.router)  # /api/notifications/* endpoints
app.include_router(settlements.router)    # /api/settlements/* endpoints
app.include_router(ai.router)             # /api/ai/* endpoints


# --- Root Endpoint ---
@app.get("/", tags=["Health"])
async def root():
    """
    Welcome endpoint - confirms the API is running.
    
    **Returns:** Welcome message with links to docs
    """
    return {
        "message": "🏸💰 Welcome to Split App API!",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
        "version": "1.0.0"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Use this to verify the API is up and running.
    Useful for AWS load balancers and monitoring tools.
    """
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "debug": settings.debug
    }


# --- Main Entry Point ---
# This runs if you execute the file directly: python app/main.py
# But we typically use: uvicorn app.main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,
        reload=True  # Auto-reload on code changes
    )

