"""
===========================================
SQLITE SERVICE
===========================================
Wraps existing SQLAlchemy operations with the same interface
as DynamoDB service for seamless switching.

This allows the app to work with both SQLite (development)
and DynamoDB (production) without code changes.
===========================================
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import SessionLocal
from app.models import User, Group, GroupMember, Expense, ExpenseSplit, Settlement, Notification


class SQLiteService:
    """SQLite/SQLAlchemy implementation of database operations."""
    
    def __init__(self):
        self._session = None
    
    def _get_session(self) -> Session:
        """Get or create a database session."""
        if self._session is None:
            self._session = SessionLocal()
        return self._session
    
    def _close_session(self):
        """Close the database session."""
        if self._session:
            self._session.close()
            self._session = None
    
    # ===========================================
    # USER OPERATIONS
    # ===========================================
    
    def create_user(self, email: str, name: str, hashed_password: str,
                   phone: Optional[str] = None, upi_id: Optional[str] = None) -> dict:
        """Create a new user."""
        db = self._get_session()
        user = User(
            email=email.lower(),
            name=name,
            hashed_password=hashed_password,
            phone=phone,
            upi_id=upi_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return self._user_to_dict(user)
    
    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID."""
        db = self._get_session()
        user = db.query(User).filter(User.id == int(user_id)).first()
        return self._user_to_dict(user) if user else None
    
    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email."""
        db = self._get_session()
        user = db.query(User).filter(User.email == email.lower()).first()
        return self._user_to_dict(user) if user else None
    
    def search_users(self, query: str, exclude_ids: List[str] = None) -> List[dict]:
        """Search users by name or email."""
        db = self._get_session()
        search = f"%{query}%"
        users_query = db.query(User).filter(
            User.is_active == True,
            or_(User.name.ilike(search), User.email.ilike(search))
        )
        
        if exclude_ids:
            exclude_int_ids = [int(i) for i in exclude_ids]
            users_query = users_query.filter(~User.id.in_(exclude_int_ids))
        
        users = users_query.limit(10).all()
        return [self._user_to_dict(u) for u in users]
    
    def update_user(self, user_id: str, **kwargs) -> Optional[dict]:
        """Update user fields."""
        db = self._get_session()
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            return None
        
        for key, value in kwargs.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        
        db.commit()
        db.refresh(user)
        return self._user_to_dict(user)
    
    def _user_to_dict(self, user: User) -> Optional[dict]:
        """Convert User model to dict."""
        if not user:
            return None
        return {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "phone": user.phone,
            "upi_id": user.upi_id,
            "hashed_password": user.hashed_password,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        }
    
    # ===========================================
    # GROUP OPERATIONS
    # ===========================================
    
    def create_group(self, name: str, created_by_id: str,
                    description: Optional[str] = None,
                    category: str = "other") -> dict:
        """Create a new group and add creator as admin."""
        db = self._get_session()
        group = Group(
            name=name,
            description=description,
            category=category,
            created_by_id=int(created_by_id)
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        
        # Add creator as admin
        member = GroupMember(
            group_id=group.id,
            user_id=int(created_by_id),
            role="admin"
        )
        db.add(member)
        db.commit()
        
        return self._group_to_dict(group)
    
    def get_group_by_id(self, group_id: str) -> Optional[dict]:
        """Get group by ID."""
        db = self._get_session()
        group = db.query(Group).filter(Group.id == int(group_id)).first()
        if not group:
            return None
        
        result = self._group_to_dict(group)
        result["members"] = self.get_group_members(group_id)
        return result
    
    def get_user_groups(self, user_id: str) -> List[dict]:
        """Get all groups a user is member of."""
        db = self._get_session()
        memberships = db.query(GroupMember).filter(
            GroupMember.user_id == int(user_id),
            GroupMember.is_active == True
        ).all()
        
        groups = []
        for membership in memberships:
            group = db.query(Group).filter(
                Group.id == membership.group_id,
                Group.is_active == True
            ).first()
            if group:
                group_data = self._group_to_dict(group)
                group_data["members"] = self.get_group_members(str(group.id))
                groups.append(group_data)
        
        return groups
    
    def update_group(self, group_id: str, **kwargs) -> Optional[dict]:
        """Update group fields."""
        db = self._get_session()
        group = db.query(Group).filter(Group.id == int(group_id)).first()
        if not group:
            return None
        
        for key, value in kwargs.items():
            if value is not None and hasattr(group, key):
                setattr(group, key, value)
        
        db.commit()
        db.refresh(group)
        return self._group_to_dict(group)
    
    def delete_group(self, group_id: str) -> bool:
        """Soft delete a group."""
        db = self._get_session()
        group = db.query(Group).filter(Group.id == int(group_id)).first()
        if group:
            group.is_active = False
            db.commit()
        return True
    
    def _group_to_dict(self, group: Group) -> Optional[dict]:
        """Convert Group model to dict."""
        if not group:
            return None
        return {
            "id": str(group.id),
            "name": group.name,
            "description": group.description,
            "category": group.category,
            "created_by_id": str(group.created_by_id),
            "is_active": group.is_active,
            "created_at": group.created_at.isoformat() if group.created_at else None,
            "updated_at": group.updated_at.isoformat() if group.updated_at else None
        }
    
    # ===========================================
    # GROUP MEMBER OPERATIONS
    # ===========================================
    
    def add_group_member(self, group_id: str, user_id: str, role: str = "member") -> dict:
        """Add a member to a group."""
        db = self._get_session()
        member = GroupMember(
            group_id=int(group_id),
            user_id=int(user_id),
            role=role
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return {
            "group_id": str(member.group_id),
            "user_id": str(member.user_id),
            "role": member.role,
            "is_active": member.is_active
        }
    
    def get_group_members(self, group_id: str) -> List[dict]:
        """Get all members of a group."""
        db = self._get_session()
        memberships = db.query(GroupMember).filter(
            GroupMember.group_id == int(group_id),
            GroupMember.is_active == True
        ).all()
        
        members = []
        for membership in memberships:
            user = db.query(User).filter(User.id == membership.user_id).first()
            if user:
                members.append({
                    "user": self._user_to_dict(user),
                    "role": membership.role,
                    "joined_at": membership.joined_at.isoformat() if membership.joined_at else None,
                    "is_active": membership.is_active
                })
        
        return members
    
    def remove_group_member(self, group_id: str, user_id: str) -> bool:
        """Remove a member from a group."""
        db = self._get_session()
        membership = db.query(GroupMember).filter(
            GroupMember.group_id == int(group_id),
            GroupMember.user_id == int(user_id)
        ).first()
        if membership:
            membership.is_active = False
            db.commit()
        return True
    
    def is_group_member(self, group_id: str, user_id: str) -> bool:
        """Check if user is an active member of a group."""
        db = self._get_session()
        membership = db.query(GroupMember).filter(
            GroupMember.group_id == int(group_id),
            GroupMember.user_id == int(user_id),
            GroupMember.is_active == True
        ).first()
        return membership is not None
    
    def is_group_admin(self, group_id: str, user_id: str) -> bool:
        """Check if user is an admin of a group."""
        db = self._get_session()
        membership = db.query(GroupMember).filter(
            GroupMember.group_id == int(group_id),
            GroupMember.user_id == int(user_id),
            GroupMember.role == "admin",
            GroupMember.is_active == True
        ).first()
        return membership is not None
    
    # ===========================================
    # EXPENSE OPERATIONS
    # ===========================================
    
    def create_expense(self, amount: float, description: str, paid_by_id: str,
                      group_id: Optional[str] = None, split_type: str = "equal",
                      category: str = "other", currency: str = "INR",
                      expense_date: Optional[str] = None, notes: Optional[str] = None,
                      splits: List[dict] = None) -> dict:
        """Create a new expense with splits."""
        db = self._get_session()
        
        expense_datetime = None
        if expense_date:
            try:
                expense_datetime = datetime.fromisoformat(expense_date.replace('Z', '+00:00'))
            except:
                expense_datetime = datetime.utcnow()
        
        expense = Expense(
            amount=amount,
            description=description,
            paid_by_id=int(paid_by_id),
            group_id=int(group_id) if group_id else None,
            split_type=split_type,
            category=category,
            currency=currency,
            expense_date=expense_datetime,
            notes=notes
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        
        # Create splits
        if splits:
            for split_data in splits:
                split = ExpenseSplit(
                    expense_id=expense.id,
                    user_id=int(split_data["user_id"]),
                    amount=split_data["amount"],
                    percentage=split_data.get("percentage"),
                    shares=split_data.get("shares")
                )
                db.add(split)
            db.commit()
        
        return self._expense_to_dict(expense)
    
    def get_expense_by_id(self, expense_id: str) -> Optional[dict]:
        """Get expense by ID with splits."""
        db = self._get_session()
        expense = db.query(Expense).filter(Expense.id == int(expense_id)).first()
        if not expense:
            return None
        
        result = self._expense_to_dict(expense)
        result["splits"] = self.get_expense_splits(expense_id)
        result["paid_by_user"] = self.get_user_by_id(str(expense.paid_by_id))
        return result
    
    def get_group_expenses(self, group_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all expenses for a group."""
        db = self._get_session()
        expenses = db.query(Expense).filter(
            Expense.group_id == int(group_id),
            Expense.is_active == True
        ).order_by(Expense.created_at.desc()).offset(skip).limit(limit).all()
        
        results = []
        for expense in expenses:
            result = self._expense_to_dict(expense)
            result["splits"] = self.get_expense_splits(str(expense.id))
            result["paid_by_user"] = self.get_user_by_id(str(expense.paid_by_id))
            results.append(result)
        
        return results
    
    def get_user_expenses(self, user_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all expenses where user is involved."""
        db = self._get_session()
        
        # Get expense IDs where user is in splits
        split_expense_ids = db.query(ExpenseSplit.expense_id).filter(
            ExpenseSplit.user_id == int(user_id)
        ).subquery()
        
        expenses = db.query(Expense).filter(
            Expense.is_active == True,
            or_(
                Expense.paid_by_id == int(user_id),
                Expense.id.in_(split_expense_ids)
            )
        ).order_by(Expense.created_at.desc()).offset(skip).limit(limit).all()
        
        results = []
        for expense in expenses:
            result = self._expense_to_dict(expense)
            result["splits"] = self.get_expense_splits(str(expense.id))
            result["paid_by_user"] = self.get_user_by_id(str(expense.paid_by_id))
            results.append(result)
        
        return results
    
    def update_expense(self, expense_id: str, **kwargs) -> Optional[dict]:
        """Update expense fields."""
        db = self._get_session()
        expense = db.query(Expense).filter(Expense.id == int(expense_id)).first()
        if not expense:
            return None
        
        for key, value in kwargs.items():
            if value is not None and hasattr(expense, key):
                setattr(expense, key, value)
        
        db.commit()
        db.refresh(expense)
        return self._expense_to_dict(expense)
    
    def delete_expense(self, expense_id: str) -> bool:
        """Soft delete an expense."""
        db = self._get_session()
        expense = db.query(Expense).filter(Expense.id == int(expense_id)).first()
        if expense:
            expense.is_active = False
            db.commit()
        return True
    
    def _expense_to_dict(self, expense: Expense) -> Optional[dict]:
        """Convert Expense model to dict."""
        if not expense:
            return None
        return {
            "id": str(expense.id),
            "amount": expense.amount,
            "currency": expense.currency,
            "description": expense.description,
            "notes": expense.notes,
            "category": expense.category,
            "paid_by_id": str(expense.paid_by_id),
            "group_id": str(expense.group_id) if expense.group_id else None,
            "split_type": expense.split_type,
            "expense_date": expense.expense_date.isoformat() if expense.expense_date else None,
            "receipt_url": expense.receipt_url,
            "is_active": expense.is_active,
            "is_settled": expense.is_settled,
            "created_at": expense.created_at.isoformat() if expense.created_at else None,
            "updated_at": expense.updated_at.isoformat() if expense.updated_at else None
        }
    
    # ===========================================
    # EXPENSE SPLIT OPERATIONS
    # ===========================================
    
    def create_expense_split(self, expense_id: str, user_id: str, amount: float,
                            percentage: Optional[float] = None,
                            shares: Optional[float] = None) -> dict:
        """Create an expense split."""
        db = self._get_session()
        split = ExpenseSplit(
            expense_id=int(expense_id),
            user_id=int(user_id),
            amount=amount,
            percentage=percentage,
            shares=shares
        )
        db.add(split)
        db.commit()
        db.refresh(split)
        return self._split_to_dict(split)
    
    def get_expense_splits(self, expense_id: str) -> List[dict]:
        """Get all splits for an expense."""
        db = self._get_session()
        splits = db.query(ExpenseSplit).filter(
            ExpenseSplit.expense_id == int(expense_id)
        ).all()
        
        results = []
        for split in splits:
            result = self._split_to_dict(split)
            result["user"] = self.get_user_by_id(str(split.user_id))
            results.append(result)
        
        return results
    
    def delete_expense_splits(self, expense_id: str) -> bool:
        """Delete all splits for an expense."""
        db = self._get_session()
        db.query(ExpenseSplit).filter(
            ExpenseSplit.expense_id == int(expense_id)
        ).delete()
        db.commit()
        return True
    
    def _split_to_dict(self, split: ExpenseSplit) -> Optional[dict]:
        """Convert ExpenseSplit model to dict."""
        if not split:
            return None
        return {
            "expense_id": str(split.expense_id),
            "user_id": str(split.user_id),
            "amount": split.amount,
            "percentage": split.percentage,
            "shares": split.shares,
            "is_paid": split.is_paid,
            "paid_at": split.paid_at.isoformat() if split.paid_at else None
        }
    
    # ===========================================
    # SETTLEMENT OPERATIONS
    # ===========================================
    
    def create_settlement(self, from_user_id: str, to_user_id: str, amount: float,
                         group_id: Optional[str] = None, payment_method: str = "other",
                         transaction_ref: Optional[str] = None,
                         notes: Optional[str] = None) -> dict:
        """Create a settlement record."""
        db = self._get_session()
        settlement = Settlement(
            from_user_id=int(from_user_id),
            to_user_id=int(to_user_id),
            amount=amount,
            group_id=int(group_id) if group_id else None,
            payment_method=payment_method,
            transaction_ref=transaction_ref,
            notes=notes
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)
        return self._settlement_to_dict(settlement)
    
    def get_group_settlements(self, group_id: str) -> List[dict]:
        """Get all settlements for a group."""
        db = self._get_session()
        settlements = db.query(Settlement).filter(
            Settlement.group_id == int(group_id),
            Settlement.is_active == True
        ).all()
        
        results = []
        for settlement in settlements:
            result = self._settlement_to_dict(settlement)
            result["from_user"] = self.get_user_by_id(str(settlement.from_user_id))
            result["to_user"] = self.get_user_by_id(str(settlement.to_user_id))
            results.append(result)
        
        return results
    
    def get_user_settlements(self, user_id: str) -> List[dict]:
        """Get all settlements involving a user."""
        db = self._get_session()
        settlements = db.query(Settlement).filter(
            Settlement.is_active == True,
            or_(
                Settlement.from_user_id == int(user_id),
                Settlement.to_user_id == int(user_id)
            )
        ).all()
        
        results = []
        for settlement in settlements:
            result = self._settlement_to_dict(settlement)
            result["from_user"] = self.get_user_by_id(str(settlement.from_user_id))
            result["to_user"] = self.get_user_by_id(str(settlement.to_user_id))
            results.append(result)
        
        return results
    
    def _settlement_to_dict(self, settlement: Settlement) -> Optional[dict]:
        """Convert Settlement model to dict."""
        if not settlement:
            return None
        return {
            "id": str(settlement.id),
            "from_user_id": str(settlement.from_user_id),
            "to_user_id": str(settlement.to_user_id),
            "amount": settlement.amount,
            "group_id": str(settlement.group_id) if settlement.group_id else None,
            "payment_method": settlement.payment_method,
            "transaction_ref": settlement.transaction_ref,
            "notes": settlement.notes,
            "is_active": settlement.is_active,
            "created_at": settlement.created_at.isoformat() if settlement.created_at else None
        }
    
    # ===========================================
    # NOTIFICATION OPERATIONS
    # ===========================================
    
    def create_notification(self, user_id: str, notification_type: str,
                           title: str, message: str,
                           expense_id: Optional[str] = None,
                           group_id: Optional[str] = None,
                           from_user_id: Optional[str] = None) -> dict:
        """Create a notification."""
        db = self._get_session()
        notification = Notification(
            user_id=int(user_id),
            notification_type=notification_type,
            title=title,
            message=message,
            expense_id=int(expense_id) if expense_id else None,
            group_id=int(group_id) if group_id else None,
            from_user_id=int(from_user_id) if from_user_id else None
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return self._notification_to_dict(notification)
    
    def get_user_notifications(self, user_id: str, limit: int = 20) -> List[dict]:
        """Get notifications for a user."""
        db = self._get_session()
        notifications = db.query(Notification).filter(
            Notification.user_id == int(user_id)
        ).order_by(Notification.created_at.desc()).limit(limit).all()
        
        results = []
        for notification in notifications:
            result = self._notification_to_dict(notification)
            if notification.from_user_id:
                result["from_user"] = self.get_user_by_id(str(notification.from_user_id))
            results.append(result)
        
        return results
    
    def mark_notification_read(self, user_id: str, notification_id: str) -> bool:
        """Mark a notification as read."""
        db = self._get_session()
        notification = db.query(Notification).filter(
            Notification.id == int(notification_id),
            Notification.user_id == int(user_id)
        ).first()
        if notification:
            notification.is_read = True
            db.commit()
        return True
    
    def mark_all_notifications_read(self, user_id: str) -> int:
        """Mark all notifications as read for a user."""
        db = self._get_session()
        count = db.query(Notification).filter(
            Notification.user_id == int(user_id),
            Notification.is_read == False
        ).update({"is_read": True})
        db.commit()
        return count
    
    def get_unread_notification_count(self, user_id: str) -> int:
        """Get count of unread notifications."""
        db = self._get_session()
        return db.query(Notification).filter(
            Notification.user_id == int(user_id),
            Notification.is_read == False
        ).count()
    
    def _notification_to_dict(self, notification: Notification) -> Optional[dict]:
        """Convert Notification model to dict."""
        if not notification:
            return None
        return {
            "id": str(notification.id),
            "user_id": str(notification.user_id),
            "notification_type": notification.notification_type,
            "title": notification.title,
            "message": notification.message,
            "expense_id": str(notification.expense_id) if notification.expense_id else None,
            "group_id": str(notification.group_id) if notification.group_id else None,
            "from_user_id": str(notification.from_user_id) if notification.from_user_id else None,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat() if notification.created_at else None
        }
    
    # ===========================================
    # BALANCE CALCULATIONS
    # ===========================================
    
    def calculate_user_balances(self, user_id: str, group_id: Optional[str] = None) -> Dict[str, float]:
        """Calculate how much the user owes/is owed by other users."""
        balances = {}
        
        if group_id:
            expenses = self.get_group_expenses(group_id, limit=1000)
        else:
            expenses = self.get_user_expenses(user_id, limit=1000)
        
        user_id_str = str(user_id)
        
        for expense in expenses:
            paid_by = str(expense.get("paid_by_id"))
            
            for split in expense.get("splits", []):
                split_user_id = str(split.get("user_id"))
                split_amount = float(split.get("amount", 0))
                
                if paid_by == user_id_str and split_user_id != user_id_str:
                    balances[split_user_id] = balances.get(split_user_id, 0) + split_amount
                elif paid_by != user_id_str and split_user_id == user_id_str:
                    balances[paid_by] = balances.get(paid_by, 0) - split_amount
        
        # Factor in settlements
        if group_id:
            settlements = self.get_group_settlements(group_id)
        else:
            settlements = self.get_user_settlements(user_id)
        
        for settlement in settlements:
            from_user = str(settlement.get("from_user_id"))
            to_user = str(settlement.get("to_user_id"))
            amount = float(settlement.get("amount", 0))
            
            if from_user == user_id_str:
                balances[to_user] = balances.get(to_user, 0) + amount
            elif to_user == user_id_str:
                balances[from_user] = balances.get(from_user, 0) - amount
        
        return {k: v for k, v in balances.items() if abs(v) > 0.01}

