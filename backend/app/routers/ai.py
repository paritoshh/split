"""
===========================================
AI ROUTER
===========================================
AI-powered features using OpenAI GPT.
- Voice expense parsing
- Smart expense categorization
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
import json

from app.config import settings
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/api/ai", tags=["AI"])


class GroupMember(BaseModel):
    user_id: int
    user_name: str


class VoiceParseRequest(BaseModel):
    transcript: str
    group_members: List[GroupMember]


class ParsedMember(BaseModel):
    user_id: int
    user_name: str
    confidence: str  # "exact", "partial", "fuzzy"


class AmbiguousName(BaseModel):
    searched_name: str
    possible_matches: List[ParsedMember]


class VoiceParseResponse(BaseModel):
    success: bool
    amount: Optional[float] = None
    description: str = "General Expense"
    matched_members: List[ParsedMember] = []
    ambiguous_names: List[AmbiguousName] = []
    unmatched_names: List[str] = []
    confidence: str = "low"  # "high", "medium", "low"
    raw_transcript: str = ""
    error: Optional[str] = None


@router.post("/parse-voice-expense", response_model=VoiceParseResponse)
async def parse_voice_expense(
    request: VoiceParseRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Parse a voice transcript to extract expense details using AI.
    
    Returns structured data:
    - amount: The expense amount
    - description: What the expense is for
    - matched_members: Group members to split with
    - ambiguous_names: Names that match multiple members
    """
    
    # Check if OpenAI is configured
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="AI features not configured. Please set OPENAI_API_KEY in environment."
        )
    
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        
        # Build the member list for context
        member_list = "\n".join([
            f"- ID: {m.user_id}, Name: {m.user_name}" 
            for m in request.group_members
        ])
        
        # System prompt for GPT
        system_prompt = """You are an expense parser. Extract expense details from voice transcripts.

RULES:
1. Extract the amount (number) - could be in formats like "500", "₹500", "500 rupees", "five hundred"
2. Extract description/purpose - what the expense is for (default: "General Expense")
3. Match names to group members - be flexible with spelling, nicknames, partial names
4. Handle Hindi names and mixed Hindi-English input
5. If a name could match multiple members, list all possibilities

OUTPUT FORMAT (JSON only, no explanation):
{
  "amount": <number or null>,
  "description": "<string>",
  "matched_members": [
    {"user_id": <id>, "user_name": "<name>", "confidence": "exact|partial|fuzzy"}
  ],
  "ambiguous_names": [
    {"searched_name": "<what user said>", "possible_matches": [{"user_id": <id>, "user_name": "<name>", "confidence": "partial"}]}
  ],
  "unmatched_names": ["<names not found in group>"],
  "include_all": <true if user said "everyone" or "all">
}"""

        user_prompt = f"""Parse this expense:
"{request.transcript}"

Group members:
{member_list}

Extract amount, description, and match names to group members. Return JSON only."""

        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,  # Low temperature for consistent parsing
            max_tokens=500,
            response_format={"type": "json_object"}
        )
        
        # Parse the response
        result_text = response.choices[0].message.content
        parsed = json.loads(result_text)
        
        # Handle "include_all" - add all members if user said "everyone"
        if parsed.get("include_all", False):
            parsed["matched_members"] = [
                {"user_id": m.user_id, "user_name": m.user_name, "confidence": "exact"}
                for m in request.group_members
            ]
        
        # Calculate confidence
        has_amount = parsed.get("amount") is not None
        has_members = len(parsed.get("matched_members", [])) > 0
        has_ambiguous = len(parsed.get("ambiguous_names", [])) > 0
        has_unmatched = len(parsed.get("unmatched_names", [])) > 0
        
        if has_amount and has_members and not has_ambiguous and not has_unmatched:
            confidence = "high"
        elif has_amount or has_members:
            confidence = "medium"
        else:
            confidence = "low"
        
        return VoiceParseResponse(
            success=True,
            amount=parsed.get("amount"),
            description=parsed.get("description", "General Expense"),
            matched_members=[
                ParsedMember(**m) for m in parsed.get("matched_members", [])
            ],
            ambiguous_names=[
                AmbiguousName(
                    searched_name=a["searched_name"],
                    possible_matches=[ParsedMember(**p) for p in a["possible_matches"]]
                )
                for a in parsed.get("ambiguous_names", [])
            ],
            unmatched_names=parsed.get("unmatched_names", []),
            confidence=confidence,
            raw_transcript=request.transcript
        )
        
    except json.JSONDecodeError as e:
        return VoiceParseResponse(
            success=False,
            error=f"Failed to parse AI response: {str(e)}",
            raw_transcript=request.transcript
        )
    except Exception as e:
        return VoiceParseResponse(
            success=False,
            error=f"AI parsing failed: {str(e)}",
            raw_transcript=request.transcript
        )


@router.get("/status")
async def ai_status():
    """Check if AI features are available."""
    return {
        "ai_enabled": bool(settings.openai_api_key),
        "model": "gpt-4o-mini" if settings.openai_api_key else None
    }

