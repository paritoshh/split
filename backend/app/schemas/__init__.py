# ===========================================
# PYDANTIC SCHEMAS
# ===========================================
# Schemas define the shape of data for API requests/responses
# They automatically validate data and convert types
# ===========================================

from app.schemas.user import (
    UserCreate, 
    UserResponse, 
    UserLogin,
    Token
)
from app.schemas.group import (
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    GroupMemberAdd
)
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseSplitCreate,
    ExpenseSplitResponse,
    BalanceResponse
)

