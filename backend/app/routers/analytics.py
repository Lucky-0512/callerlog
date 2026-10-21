from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.database import get_db
from app.models import CallRecord
from app.services.stages_data import STAGES_DICT
from app.services.transcript_service import transcript_service
from app.schemas import AnalyticsOverview, FunnelStageStat

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=AnalyticsOverview)
def get_analytics_overview(
    source: str = Query("all", description="Source to compute: 'db', 'benchmark_100', or 'all'"),
    db: Session = Depends(get_db)
):
    """Calculates call intelligence, outcomes breakdown, and 8-stage drop-off funnel."""
    db_records = db.query(CallRecord).all()
    
    # Only use benchmark data if user explicitly requested benchmark_100
    use_benchmark = (source == "benchmark_100")

    outcomes: Dict[str, int] = {}
    company_kinds: Dict[str, int] = {}
    total_duration = 0
    total_calls = 0
    max_stages_list: List[int] = []

    if use_benchmark:
        benchmark_calls = transcript_service.get_all_summaries()
        total_calls = len(benchmark_calls)
        for b in benchmark_calls:
            outcomes[b.outcome] = outcomes.get(b.outcome, 0) + 1
            company_kinds[b.company_kind] = company_kinds.get(b.company_kind, 0) + 1
            total_duration += b.duration_seconds

            # Map outcome to approximate max stage reached in benchmark
            if b.outcome == "next_step_agreed":
                max_stages_list.append(7)
            elif b.outcome == "agreed_to_receive_report":
                max_stages_list.append(7)
            elif b.outcome == "interested":
                max_stages_list.append(5)
            elif b.outcome == "follow_up":
                max_stages_list.append(3)
            elif b.outcome == "not_interested":
                max_stages_list.append(6)
            elif b.outcome == "do_not_call":
                max_stages_list.append(6)
            elif b.outcome == "wrong_person":
                max_stages_list.append(2)
            else:
                max_stages_list.append(3)
    else:
        total_calls = len(db_records)
        for r in db_records:
            outcomes[r.outcome] = outcomes.get(r.outcome, 0) + 1
            total_duration += r.duration_seconds
            max_stages_list.append(r.max_stage_number)
            kind = r.company.company_kind if r.company else "not known"
            company_kinds[kind] = company_kinds.get(kind, 0) + 1

    avg_duration = round(total_duration / total_calls, 1) if total_calls > 0 else 0.0

    # Build 8-stage funnel
    # A call reaches stage X if its max_stage_number >= X
    funnel_stats: List[FunnelStageStat] = []
    prev_count = total_calls

    for stage_num in range(1, 9):
        stage_name = STAGES_DICT[stage_num].name
        reached_count = sum(1 for s in max_stages_list if s >= stage_num)
        pct = round((reached_count / total_calls) * 100, 1) if total_calls > 0 else 0.0
        drop_off = prev_count - reached_count
        funnel_stats.append(FunnelStageStat(
            stage_number=stage_num,
            stage_name=stage_name,
            count=reached_count,
            percentage=pct,
            drop_off_count=max(0, drop_off)
        ))
        prev_count = reached_count

    return AnalyticsOverview(
        total_calls_analyzed=total_calls,
        outcomes_breakdown=outcomes,
        stage_funnel=funnel_stats,
        company_kinds_breakdown=company_kinds,
        avg_call_duration_seconds=avg_duration
    )
