# SplitWise Clone - Expense Sharing App 🏸💰

A smart expense sharing application for friends to split bills, track who owes whom, and settle payments easily.

## 🎯 Features

### Core Features
- ✅ User authentication (signup/login)
- ✅ Create and manage groups
- ✅ Add expenses with flexible splitting options
- ✅ Track balances - who owes whom
- ✅ Settlement tracking
- ✅ Activity feed

### AI Features (Coming Soon)
- 🤖 Smart receipt scanning (OCR)
- 🤖 Natural language expense entry
- 🤖 Auto-categorization of expenses
- 🤖 Spending insights & analytics
- 🤖 Settlement optimization

## 🛠 Tech Stack

### Backend
- **Python 3.10+** - Programming language
- **FastAPI** - Modern, fast web framework for building APIs
- **SQLAlchemy** - Database ORM (Object Relational Mapper)
- **SQLite/PostgreSQL** - Database
- **Pydantic** - Data validation
- **JWT** - Authentication tokens

### Frontend
- **React 18** - UI library
- **Vite** - Build tool (faster than Create React App)
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls

## 📁 Project Structure

```
split/
├── backend/                    # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py            # Entry point
│   │   ├── config.py          # Settings
│   │   ├── database.py        # DB connection
│   │   ├── models/            # Database tables
│   │   ├── schemas/           # Request/Response models
│   │   ├── routers/           # API routes
│   │   └── services/          # Business logic
│   └── requirements.txt
│
└── frontend/                   # React Frontend
    ├── src/
    │   ├── components/        # Reusable components
    │   ├── pages/             # Page components
    │   └── services/          # API functions
    └── package.json
```

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
python -m venv venv                 # Create virtual environment
source venv/bin/activate            # Activate it (Mac/Linux)
# OR: venv\Scripts\activate         # Windows
pip install -r requirements.txt     # Install dependencies
cp .env.example .env                # Create env file
uvicorn app.main:app --reload       # Start server
```

### Frontend Setup
```bash
cd frontend
npm install                         # Install dependencies
npm run dev                         # Start dev server
```

## 📖 API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🔑 Environment Variables

Create a `.env` file in the backend folder:
```
DATABASE_URL=sqlite:///./split.db
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=your-openai-key      # For AI features
```

## 👨‍💻 Author

Paritosh Agarwal - [paritoshagarwal.com](http://paritoshagarwal.com/)

## 📝 License

MIT License - Feel free to use this project!

