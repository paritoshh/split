"""
===========================================
DATABASE CONNECTION
===========================================
This file sets up the database connection using SQLAlchemy.

What is SQLAlchemy?
- An ORM (Object Relational Mapper)
- Lets you work with database using Python classes
- Instead of writing SQL, you write Python code
- Example: User.query.all() instead of "SELECT * FROM users"

What is a Session?
- A "conversation" with the database
- You make changes, then commit (save) or rollback (undo)
- Each API request gets its own session
===========================================
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# --- Create Database Engine ---
# The engine is the starting point for any SQLAlchemy application
# It manages connections to the database

# For SQLite, we need special settings
if settings.database_url.startswith("sqlite"):
    # connect_args={"check_same_thread": False} is needed for SQLite
    # SQLite by default only allows one thread to access it
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False}
    )
else:
    # For PostgreSQL or other databases
    engine = create_engine(settings.database_url)

# --- Create Session Factory ---
# SessionLocal is a factory that creates database sessions
# autocommit=False: We manually commit changes (safer)
# autoflush=False: We manually control when data is sent to DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Base Class for Models ---
# All our database models will inherit from this
# It provides common functionality like table creation
Base = declarative_base()


def get_db():
    """
    Dependency function that provides a database session.
    
    How it works:
    1. Creates a new database session
    2. Gives it to the API endpoint
    3. Automatically closes it after the request is done
    
    Usage in API endpoints:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    
    The 'yield' keyword makes this a generator:
    - Code before yield runs first (creates session)
    - Code after yield runs last (closes session)
    - This ensures the session is always properly closed
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

