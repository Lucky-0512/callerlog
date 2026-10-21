from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models import Company, Contact, CallRecord
from app.schemas import CompanyBrief

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.get("", response_model=List[CompanyBrief])
def get_companies(db: Session = Depends(get_db)):
    """List companies with call activity count."""
    companies = db.query(Company).all()
    results = []
    for c in companies:
        results.append(CompanyBrief(
            id=c.id,
            name=c.name,
            company_kind=c.company_kind or "not known",
            industry=c.industry,
            total_calls=len(c.calls)
        ))
    return results

@router.get("/{company_id}/dossier")
def get_company_dossier(company_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve complete background dossier of a company and its call touchpoints."""
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")

    contacts = [
        {
            "id": ct.id,
            "full_name": ct.full_name,
            "role_title": ct.role_title,
            "phone_number": ct.phone_number,
            "email": ct.email,
            "personal_notes": ct.personal_notes
        }
        for ct in c.contacts
    ]

    calls_history = [
        {
            "id": call.id,
            "caller_name": call.caller_name,
            "duration_seconds": call.duration_seconds,
            "max_stage_number": call.max_stage_number,
            "max_stage_name": call.max_stage_name,
            "outcome": call.outcome,
            "stage_5_need_verbatim": call.stage_5_need_verbatim,
            "objection_summary": call.objection_summary,
            "next_step_action": call.next_step_action,
            "next_step_date_time": call.next_step_date_time,
            "next_step_channel": call.next_step_channel,
            "call_timestamp": call.call_timestamp.isoformat()
        }
        for call in sorted(c.calls, key=lambda x: x.call_timestamp, reverse=True)
    ]

    # Collect all verbatim prospect quotes from Stage 5 across calls
    verbatim_needs = [
        {"call_date": call.call_timestamp.strftime("%Y-%m-%d"), "quote": call.stage_5_need_verbatim}
        for call in c.calls if call.stage_5_need_verbatim
    ]

    return {
        "company_id": c.id,
        "name": c.name,
        "company_kind": c.company_kind,
        "industry": c.industry,
        "created_at": c.created_at.isoformat(),
        "contacts": contacts,
        "total_calls": len(calls_history),
        "calls_history": calls_history,
        "historical_stage_5_quotes": verbatim_needs
    }
