import json
import logging
import httpx
from typing import Optional, Dict, Any, List
from app.config import settings
from app.schemas import CallAnalysisResult, TurnClassification, BattlecardResponse, StageChunk
from app.services.heuristics_service import heuristics_service
from app.services.stages_data import STAGES_DICT
from app.services.battlecard_service import battlecard_service

logger = logging.getLogger(__name__)

GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

EXTRACTION_SYSTEM_INSTRUCTION = """
You are an expert sales operations analyst specializing in B2B cold-call analysis for Indian businesses (specifically Meridian Growth Partners selling growth analysis to owners/directors).
Analyze the provided transcript according to the strict 8-Stage Cold-Call Framework.

THE 8 COLD CALL STAGES & THEIR 4 PREDEFINED PRESET OPTIONS:

Stage 1: Opening
Purpose: Reach the right person and say who you are. The prospect decides in the first ten seconds whether this call is worth a minute.
Predefined Presets:
- "Reached right person"
- "Gatekeeper / Switchboard answered"
- "Busy / Call back later"
- "Wrong person / Left company"

Stage 2: Purpose
Purpose: Say in one or two sentences why you called, in words the prospect can repeat to a colleague.
Predefined Presets:
- "Asked what we do"
- "Asked where we got the number"
- "Said it is a sales call"
- "Let me explain purpose"

Stage 3: Permission
Purpose: Find out whether they are willing to talk now. A clear yes, a clear no, or a time to call back are all good outcomes.
Predefined Presets:
- "Agreed to talk now"
- "Requested callback at specific time"
- "Demanded WhatsApp / Email first"
- "Polite brush-off / Line busy"

Stage 4: Their business
Purpose: Ask about their company and their work before saying anything about yours. People talk about what they do.
Predefined Presets:
- "Described core operations"
- "Corrected company size / division"
- "Asked caller to pitch first"
- "One-line curt response"

Stage 5: Their need, in their words
Purpose: Hear what they are trying to do or struggling with, in their own words. The caller writes down exactly what was said.
Predefined Presets:
- "Named growth / margin goal"
- "Stated capacity / scrap bottleneck"
- "Claimed no current need"
- "Asked what we can do for their size"

Stage 6: Objection
Purpose: Hear the reason for a no and understand it. A reason you understand can be answered on this call or the next.
Predefined Presets:
- "Already have in-house team/agency"
- "Wrong person / Referred to director"
- "Polite dismissal: Send in writing"
- "Firm no / Do not call"

Stage 7: Next step
Purpose: Agree one concrete thing: a document on WhatsApp or email, a call at a named time, a meeting.
Predefined Presets:
- "Agreed to receive WhatsApp report"
- "Scheduled fixed day/time follow-up"
- "Confirmed Google Meet / Discussion"
- "Referral contact obtained"

Stage 8: Close
Purpose: End the call clearly and record what happened: the outcome, next step, and the prospect's words from stage 5.
Predefined Presets:
- "Clear confirmation & warm close"
- "Abrupt line drop / hung up"
- "Polite non-committal goodbye"
- "Next step locked in calendar"

CRITICAL EXTRACTION & STAGE CHUNKING RULES:
1. Strict Progression & Accurate Stage Discrimination:
   - Stage 1 (Opening): Confirming right person, greeting, gatekeeper handling.
   - Stage 2 (Purpose): Caller stating 1-sentence value hook or reason for call.
   - Stage 3 (Permission): STRICTLY checking whether prospect has 2 minutes / right time to speak ("Is this a good time?", "Haan boliye", "Make it brief").
   - Stage 4 (Their business): THE MOMENT the caller or prospect speaks about what the company does, their operations, products, team size, or manufacturing process, it is strictly Stage 4. It MUST NOT remain in Stage 3!
   - Stage 5 (Their need, in their words): The prospect explaining their bottlenecks, scrap rates, capacity issues, margin pressure, or growth goals. Extract their exact words verbatim!
   - Stage 6 (Objection): Resistance, hesitation, "already have a consultant/CA", "no budget", or wrong department.
   - Stage 7 (Next step): Agreeing to a specific action (WhatsApp report delivery, Tuesday 2 PM call, Google Meet).
   - Stage 8 (Close): Final sign-off, warm confirmation, or line drop.

2. Terminal Stage & Truncation:
   - When a call ends early (e.g. line drops or call is cut at Stage 4), max_stage_number is that final stage reached (4).
   - Stages above max_stage_number MUST have reached=false, selected_preset=null, prospect_words=null.
   - Do NOT guess or hallucinate unreached future stages!

3. Verbatim Extraction:
   - For every reached stage, select exactly ONE of the 4 exact predefined presets.
   - For Stage 5, extract the prospect's verbatim statement into prospect_words and stage_5_need_verbatim.

4. Deliverable Lockout:
   - WhatsApp Deliverable is strictly null and locked unless max_stage_number >= 7 and outcome is "agreed_to_receive_report" or "next_step_agreed".

Return ONLY a valid JSON object matching this schema:
{
  "company_name": "string",
  "company_kind": "string",
  "prospect_name": "string",
  "prospect_role": "string",
  "caller_name": "string",
  "duration_seconds": 0,
  "max_stage_number": 1,
  "max_stage_name": "Stage Name",
  "outcome": "next_step_agreed | agreed_to_receive_report | interested | follow_up | call_again | not_interested | do_not_call | wrong_person | moved_company | not_logged",
  "stage_5_need_verbatim": "exact verbatim words from prospect, or null if stage 5 not reached",
  "objection_category": "short tag if objection raised, else null",
  "objection_summary": "detailed objection explanation, else null",
  "next_step_action": "e.g. Send growth report on WhatsApp, or null",
  "next_step_date_time": "e.g. Next Tuesday after 2 PM, or null",
  "next_step_channel": "WhatsApp | Email | Phone Call | Google Meet | null",
  "where_you_left_off_summary": "1-2 sentence concise recap of the exact conversational state when this call ended, what prospect stated, and where it was paused",
  "caller_last_ask": "the final offer, question, or proposition proposed by caller",
  "prospect_final_response": "the final words, objection, or parting reaction from the prospect",
  "suggested_callback_bridge": "natural, professional 1-sentence opening script for the caller when ringing this prospect back in 5-7 days to resume smoothly from where they left off",
  "summary": "1-2 sentence executive recap of the call",
  "stage_blocks": {
    "1": {
      "stage_number": 1,
      "stage_name": "Opening",
      "reached": true,
      "selected_preset": "Reached right person",
      "prospect_words": "Yes, this is Suresh speaking. Who is this?",
      "summary": "Caller reached the target executive directly.",
      "start_turn": 0,
      "end_turn": 2
    },
    "2": {
      "stage_number": 2,
      "stage_name": "Purpose",
      "reached": true,
      "selected_preset": "Asked what we do",
      "prospect_words": "What exactly do you do for engineering firms?",
      "summary": "Prospect asked for brief explanation of services.",
      "start_turn": 3,
      "end_turn": 5
    }
  },
  "stage_chunks": [
    {
      "stage_number": 1,
      "stage_name": "Opening",
      "start_turn": 0,
      "end_turn": 2,
      "summary": "Caller introduces themselves and confirms reaching prospect",
      "dialogue_excerpt": "CALLER: Hi... | PROSPECT: Speaking..."
    }
  ],
  "turn_classifications": [
    {
      "turn_index": 0,
      "speaker": "CALLER",
      "text": "line text",
      "stage_number": 1,
      "stage_name": "Opening"
    }
  ]
}
"""

class GeminiService:
    def __init__(self):
        self.default_model = settings.GEMINI_MODEL
        self.default_key = settings.GEMINI_API_KEY

    async def analyze_transcript(
        self,
        raw_text: str,
        transcript_id: Optional[str] = None,
        custom_api_key: Optional[str] = None,
        override_caller: Optional[str] = None
    ) -> CallAnalysisResult:
        api_key = custom_api_key or self.default_key
        
        # If no Gemini API key is configured, use the high-fidelity heuristics engine
        if not api_key:
            logger.info("No Gemini API key detected. Running heuristics extraction engine.")
            return heuristics_service.analyze_transcript(raw_text, transcript_id, override_caller)

        endpoint = GEMINI_API_URL_TEMPLATE.format(model=self.default_model, key=api_key)

        prompt = f"""
{EXTRACTION_SYSTEM_INSTRUCTION}

Transcript to analyze:
---
{raw_text}
---
"""
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(endpoint, json=payload)
                if response.status_code != 200:
                    logger.warning(f"Gemini API returned status {response.status_code}: {response.text}. Falling back to heuristics.")
                    return heuristics_service.analyze_transcript(raw_text, transcript_id, override_caller)

                data = response.json()
                candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(candidate_text)

                # Process battlecard for objection
                objection_sum = parsed.get("objection_summary")
                battlecard = battlecard_service.get_battlecard_for_objection(objection_sum)

                turn_classes = [
                    TurnClassification(
                        turn_index=t.get("turn_index", i),
                        speaker=t.get("speaker", "UNKNOWN"),
                        text=t.get("text", ""),
                        stage_number=t.get("stage_number", 1),
                        stage_name=t.get("stage_name", STAGES_DICT.get(t.get("stage_number", 1), STAGES_DICT[1]).name)
                    )
                    for i, t in enumerate(parsed.get("turn_classifications", []))
                ]

                stage_chunks = [
                    StageChunk(
                        stage_number=c.get("stage_number", 1),
                        stage_name=c.get("stage_name", STAGES_DICT.get(c.get("stage_number", 1), STAGES_DICT[1]).name),
                        start_turn=c.get("start_turn", 0),
                        end_turn=c.get("end_turn", 0),
                        summary=c.get("summary", ""),
                        dialogue_excerpt=c.get("dialogue_excerpt", "")
                    )
                    for c in parsed.get("stage_chunks", [])
                ]

                max_stage_num = int(parsed.get("max_stage_number", 1))
                max_stage_name = STAGES_DICT.get(max_stage_num, STAGES_DICT[1]).name

                # Build structured stage_blocks dictionary
                from app.schemas import StageBlockData
                stage_blocks_dict: Dict[str, StageBlockData] = {}
                raw_blocks = parsed.get("stage_blocks", {})

                for s_num in range(1, 9):
                    s_key = str(s_num)
                    meta = STAGES_DICT.get(s_num, STAGES_DICT[1])
                    b_data = raw_blocks.get(s_key, {})
                    is_reached = b_data.get("reached", s_num <= max_stage_num)
                    preset = b_data.get("selected_preset")
                    if is_reached and (not preset or preset not in meta.what_happened_options):
                        preset = meta.what_happened_options[0]
                    p_words = b_data.get("prospect_words")
                    if s_num == 5 and not p_words:
                        p_words = parsed.get("stage_5_need_verbatim")

                    stage_blocks_dict[s_key] = StageBlockData(
                        stage_number=s_num,
                        stage_name=meta.name,
                        reached=is_reached,
                        selected_preset=preset if is_reached else None,
                        prospect_words=p_words if is_reached else None,
                        summary=b_data.get("summary", f"Stage {s_num} {meta.name}"),
                        start_turn=b_data.get("start_turn"),
                        end_turn=b_data.get("end_turn")
                    )

                return CallAnalysisResult(
                    transcript_id=transcript_id,
                    company_name=parsed.get("company_name", "Target Company"),
                    company_kind=parsed.get("company_kind", "mid-size private company"),
                    prospect_name=parsed.get("prospect_name", "Prospect"),
                    prospect_role=parsed.get("prospect_role", "Executive"),
                    caller_name=parsed.get("caller_name", override_caller or "Caller"),
                    duration_seconds=int(parsed.get("duration_seconds", 60)),
                    max_stage_number=max_stage_num,
                    max_stage_name=max_stage_name,
                    outcome=parsed.get("outcome", "not_logged"),
                    stage_5_need_verbatim=parsed.get("stage_5_need_verbatim"),
                    objection_category=parsed.get("objection_category"),
                    objection_summary=objection_sum,
                    next_step_action=parsed.get("next_step_action"),
                    next_step_date_time=parsed.get("next_step_date_time"),
                    next_step_channel=parsed.get("next_step_channel"),
                    where_you_left_off_summary=parsed.get("where_you_left_off_summary"),
                    suggested_callback_bridge=parsed.get("suggested_callback_bridge"),
                    caller_last_ask=parsed.get("caller_last_ask"),
                    prospect_final_response=parsed.get("prospect_final_response"),
                    summary=parsed.get("summary", ""),
                    stage_chunks=stage_chunks,
                    turn_classifications=turn_classes,
                    stage_blocks=stage_blocks_dict,
                    battlecard=battlecard
                )

        except Exception as e:
            logger.error(f"Error calling Gemini API: {e}. Falling back to heuristics engine.")
            return heuristics_service.analyze_transcript(raw_text, transcript_id, override_caller)

gemini_service = GeminiService()
