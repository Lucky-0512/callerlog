import re
from typing import List, Dict, Any, Optional
from app.schemas import CallAnalysisResult, TurnClassification, BattlecardResponse, StageChunk, StageBlockData
from app.services.battlecard_service import battlecard_service
from app.services.stages_data import STAGES_DICT

class HeuristicsService:
    @staticmethod
    def analyze_transcript(
        raw_text: str,
        transcript_id: Optional[str] = None,
        override_caller: Optional[str] = None
    ) -> CallAnalysisResult:
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
        
        # 1. Parse header metadata
        headers = {}
        dialogue_lines: List[str] = []
        in_dialogue = False

        for line in lines:
            clean_l = line.lstrip("#").strip()
            if not in_dialogue and ":" in clean_l and not clean_l.startswith(("CALLER:", "PROSPECT:", "RECEPTION:")):
                key, val = clean_l.split(":", 1)
                headers[key.strip().lower()] = val.strip()
            elif clean_l.startswith(("CALLER:", "PROSPECT:", "RECEPTION:")):
                in_dialogue = True
                dialogue_lines.append(clean_l)
            elif in_dialogue:
                dialogue_lines.append(clean_l)

        # Fallback to known transcript metadata if headers weren't in raw_text
        if transcript_id:
            try:
                from app.services.transcript_service import transcript_service
                known = transcript_service.get_transcript_by_id(transcript_id)
                if known:
                    if not headers.get("company"):
                        headers["company"] = known.company
                    if not headers.get("outcome") or headers.get("outcome") == "not_logged":
                        headers["outcome"] = known.outcome
                    if not headers.get("prospect_role"):
                        headers["prospect_role"] = known.prospect_role
                    if not headers.get("company_kind"):
                        headers["company_kind"] = known.company_kind
            except Exception:
                pass

        company = headers.get("company", "Target Company").replace("(fictional)", "").strip()
        company_kind = headers.get("company_kind", "mid-size private company")
        prospect_role = headers.get("prospect_role", "Executive")
        caller_str = override_caller or headers.get("caller", "Priya, Meridian Growth Partners")
        caller_name = caller_str.split(",")[0].strip()
        duration_seconds = int(headers.get("duration_seconds", len(dialogue_lines) * 6))
        header_outcome = headers.get("outcome", "not_logged")

        # 2. Parse turns
        speaker_pattern = re.compile(r"^(CALLER|PROSPECT|RECEPTION):\s*(.*)", re.IGNORECASE)
        turns: List[Dict[str, Any]] = []
        curr_speaker = None
        curr_text = []

        for line in dialogue_lines:
            match = speaker_pattern.match(line)
            if match:
                if curr_speaker and curr_text:
                    turns.append({"speaker": curr_speaker, "text": " ".join(curr_text)})
                    curr_text = []
                curr_speaker = match.group(1).upper()
                curr_text.append(match.group(2))
            elif curr_speaker:
                curr_text.append(line)

        if curr_speaker and curr_text:
            turns.append({"speaker": curr_speaker, "text": " ".join(curr_text)})

        total_turns = len(turns)
        if total_turns == 0:
            # Fallback for empty transcript
            return CallAnalysisResult(
                transcript_id=transcript_id,
                company_name=company,
                company_kind=company_kind,
                prospect_name="Prospect",
                prospect_role=prospect_role,
                caller_name=caller_name,
                duration_seconds=duration_seconds,
                max_stage_number=1,
                max_stage_name="Opening",
                outcome="not_logged",
                summary="Empty transcript provided."
            )

        # 3. Detect prospect name in caller opening turns
        prospect_name = "Prospect"
        for t in turns[:4]:
            t_text = t["text"]
            name_match = re.search(r"(?:speaking (?:with|to)|Hi|Hello|Namaste),?\s+(?:Mr\.?|Ms\.?|Dr\.?)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:ji|sir|ma'?am)?", t_text, re.IGNORECASE)
            if name_match:
                extracted = name_match.group(1).strip()
                if extracted.lower() not in ["meridian", "calling", "this", "there", "director"]:
                    prospect_name = extracted
                    break

        # 4. Sequential Monotonic Chunking Algorithm
        initial_stage = 1
        first_turns_text = " ".join([t["text"].lower() for t in turns[:3]])
        if any(w in first_turns_text for w in ["send me a mail", "send me an email", "send the email", "send the report", "wanted you to send", "send it on whatsapp", "scheduled call", "speaking yesterday", "called yesterday", "follow up on email", "share the details"]):
            initial_stage = 7
        elif any(w in first_turns_text for w in ["not interested", "wrong person", "already have a vendor", "stop calling"]):
            initial_stage = 6
        elif any(w in first_turns_text for w in ["capacity", "margins", "operational challenge", "problem we face", "looking to scale", "software problem"]):
            initial_stage = 5
        elif any(w in first_turns_text for w in ["understand your company", "tell you about my company", "industry", "competitors"]):
            initial_stage = 4
        elif any(w in first_turns_text for w in ["right time to speak", "sahi time", "is it fine if", "go ahead"]):
            initial_stage = 3
        elif any(w in first_turns_text for w in ["what we do", "meridian helps", "helps growing", "regarding the"]):
            initial_stage = 2

        current_stage = initial_stage
        turn_stages: List[int] = []
        stage_5_quotes: List[str] = []
        objection_text = None
        next_step_action = None
        next_step_time = None
        next_step_channel = None

        for idx, t in enumerate(turns):
            text = t["text"]
            text_l = text.lower()
            speaker = t["speaker"]

            # Closing turns (near end of call AND call reached Next Step / agreement, or final turn)
            if idx >= max(0, total_turns - 2) and (current_stage >= 6 or idx == total_turns - 1) and any(w in text_l for w in ["thank you", "thanks", "bye", "okay okay", "disconnect", "right. got it", "perfect. okay", "sure, thank you", "sure thank you", "take care", "alright"]):
                current_stage = max(current_stage, 8)

            # Stage 7: Next Step
            elif any(w in text_l for w in [
                "google meet", "zoom", "next week", "tuesday", "wednesday", "thursday", "friday", "monday", 
                "after 2", "2 pm", "morning", "afternoon", "whatsapp", "send it across", "note it down", 
                "send the report", "call after 30 minutes", "mail", "email", "reply to that mail", 
                "look at it", "check the mail", "send the mail", "forward it", "share the profile", 
                "discuss the report", "schedule", "connect next", "ring you", "works. let's do it", 
                "let's do it", "share it", "on this number", "let's do that", "that works"
            ]):
                current_stage = max(current_stage, 7)
                if not next_step_action:
                    if "whatsapp" in text_l:
                        next_step_channel = "WhatsApp"
                        next_step_action = "Send growth report on WhatsApp"
                    elif "google meet" in text_l or "working session" in text_l:
                        next_step_channel = "Google Meet"
                        next_step_action = "Schedule founder working session"
                    elif "call" in text_l:
                        next_step_channel = "Phone Call"
                        next_step_action = "Follow-up phone call"
                    else:
                        next_step_channel = "WhatsApp/Email"
                        next_step_action = "Share report documentation"

                time_match = re.search(r"(next (?:week|tuesday|wednesday|thursday|friday|monday)|tomorrow|today|after \d+(?:\s*(?:pm|am|minutes))?|\d+:\d+|\d+\s*(?:am|pm))", text_l)
                if time_match and not next_step_time:
                    next_step_time = time_match.group(1).title()

            # Stage 6: Objection
            elif current_stage < 7 and any(w in text_l for w in ["not right now", "not interested", "wrong person", "not the relevant person", "already have", "back office", "we are still a startup", "yahan se aisa kuch nahi", "no point"]):
                current_stage = max(current_stage, 6)
                if not objection_text and speaker == "PROSPECT":
                    objection_text = text

            # Stage 5: Their need, in their words
            elif current_stage < 6 and speaker == "PROSPECT" and (len(text.split()) > 8 or any(w in text_l for w in ["we do", "we would have", "approaches", "technology", "margins", "sales", "capacity", "expansion", "growth", "challenge", "problem", "looking for"])):
                current_stage = max(current_stage, 5)
                stage_5_quotes.append(text)

            # Stage 4: Their Business
            elif current_stage < 5 and any(w in text_l for w in ["understand your company", "your industry", "your competitors", "what do you think about", "tell you about my company", "operational challenges", "solve the operational problems", "what kind of", "what products", "what do you manufacture", "how many people", "team size", "operations", "plant", "manufacturing", "business model", "precision engineering", "clients"]):
                current_stage = max(current_stage, 4)

            # Stage 3: Permission
            elif current_stage < 4 and any(w in text_l for w in ["right time to speak", "sahi time", "fine if i schedule", "would you be interested", "can i ask", "is it fine if", "go ahead", "boliye", "yes, tell me", "take two minutes", "take 2 minutes", "have 2 minutes", "have two minutes", "quick 2 minutes", "speaking now"]):
                current_stage = max(current_stage, 3)

            # Stage 2: Purpose
            elif current_stage < 3 and any(w in text_l for w in ["growth report", "regarding that", "follow-up call", "regarding", "what we do", "meridian helps", "helps growing", "who is this", "from where"]):
                current_stage = max(current_stage, 2)

            turn_stages.append(current_stage)

        # 5. Build Grouped Sequential Stage Chunks (Contiguous non-overlapping blocks)
        stage_chunks: List[StageChunk] = []
        turn_classifications: List[TurnClassification] = []

        chunk_start = 0
        chunk_stage = turn_stages[0]

        for i in range(1, total_turns + 1):
            if i == total_turns or turn_stages[i] != chunk_stage:
                # Close chunk from [chunk_start, i - 1]
                chunk_turns = turns[chunk_start:i]
                excerpt = " | ".join(f"{t['speaker']}: {t['text'][:60]}..." if len(t['text']) > 60 else f"{t['speaker']}: {t['text']}" for t in chunk_turns[:3])
                
                # Contextual summary for chunk
                stage_name = STAGES_DICT[chunk_stage].name
                if chunk_stage == 1:
                    summary = f"Caller establishes contact with {prospect_name} at {company}."
                elif chunk_stage == 2:
                    summary = f"Caller states purpose regarding growth analysis for {company}."
                elif chunk_stage == 3:
                    summary = f"Checking availability and securing permission to discuss."
                elif chunk_stage == 4:
                    summary = f"Exploring company operations and industry context."
                elif chunk_stage == 5:
                    summary = f"Prospect describes their internal challenges/goals in their own words."
                elif chunk_stage == 6:
                    summary = f"Prospect raises objection: '{objection_text[:50] if objection_text else 'hesitation'}'."
                elif chunk_stage == 7:
                    summary = f"Parties align on next step: {next_step_action or 'follow-up'}."
                else:
                    summary = f"Call concludes and next action is logged."

                stage_chunks.append(StageChunk(
                    stage_number=chunk_stage,
                    stage_name=stage_name,
                    start_turn=chunk_start,
                    end_turn=i - 1,
                    summary=summary,
                    dialogue_excerpt=excerpt
                ))

                if i < total_turns:
                    chunk_start = i
                    chunk_stage = turn_stages[i]

        # Build turn classifications
        for idx, (t, s_num) in enumerate(zip(turns, turn_stages)):
            turn_classifications.append(TurnClassification(
                turn_index=idx,
                speaker=t["speaker"],
                text=t["text"],
                stage_number=s_num,
                stage_name=STAGES_DICT[s_num].name
            ))

        max_stage = max(turn_stages)

        # 6. Resolve Stage 5 verbatim quote
        verbatim_stage_5 = None
        if stage_5_quotes:
            substantive_quotes = [q for q in stage_5_quotes if len(q.split()) >= 6 and not q.endswith("?")]
            if substantive_quotes:
                verbatim_stage_5 = max(substantive_quotes, key=len)
            else:
                verbatim_stage_5 = max(stage_5_quotes, key=len)
        elif max_stage >= 5:
            prospect_turns = [t["text"] for t in turns if t["speaker"] == "PROSPECT" and len(t["text"].split()) >= 6]
            if prospect_turns:
                verbatim_stage_5 = max(prospect_turns, key=len)

        # 7. Outcome determination
        outcome = header_outcome
        if outcome == "not_logged":
            if next_step_action or max_stage >= 7:
                outcome = "next_step_agreed"
            elif objection_text:
                if any(w in objection_text.lower() for w in ["wrong person", "not the relevant"]):
                    outcome = "wrong_person"
                elif any(w in objection_text.lower() for w in ["do not call", "no no"]):
                    outcome = "do_not_call"
                else:
                    outcome = "not_interested"
            elif max_stage >= 3:
                outcome = "follow_up"
            else:
                outcome = "call_again"

        # 8. Objection Battlecard & Summary
        battlecard = battlecard_service.get_battlecard_for_objection(objection_text)
        summary = f"Cold call by {caller_name} to {prospect_name} ({prospect_role} at {company}). Reached Stage {max_stage} ({STAGES_DICT[max_stage].name}) with outcome '{outcome.replace('_', ' ')}'."
        if next_step_action:
            summary += f" Agreed next step: {next_step_action} ({next_step_time or 'TBD'} via {next_step_channel or 'WhatsApp'})."

        # 9. Continuation and callback bridge synthesis
        caller_turns = [t["text"] for t in turns if t["speaker"] == "CALLER"]
        prospect_turns = [t["text"] for t in turns if t["speaker"] in ("PROSPECT", "RECEPTION")]
        caller_last_ask = caller_turns[-1] if caller_turns else None
        prospect_final_response = prospect_turns[-1] if prospect_turns else None

        if max_stage >= 8:
            where_you_left_off_summary = f"Call reached Stage 8 (Close). Agreed deliverable: {next_step_action or 'Outcome recorded'}."
            suggested_callback_bridge = f"Hi {prospect_name} ji, {caller_name} from Meridian following up as agreed to review the {next_step_action or 'growth brief'}."
        elif max_stage >= 5 and verbatim_stage_5:
            where_you_left_off_summary = f"Call reached Stage {max_stage} ({STAGES_DICT[max_stage].name}). Prospect noted: \"{verbatim_stage_5[:90]}\". Paused before final closing."
            suggested_callback_bridge = f"Hi {prospect_name} ji, {caller_name} from Meridian. When we spoke earlier you mentioned \"{verbatim_stage_5[:55]}...\"—wanted to quickly circle back with the specific benchmark data."
        elif objection_text:
            where_you_left_off_summary = f"Call paused at Stage {max_stage} ({STAGES_DICT[max_stage].name}) on objection: \"{objection_text[:85]}\"."
            suggested_callback_bridge = f"Hi {prospect_name} ji, {caller_name} from Meridian. Circling back after our brief chat regarding {company}'s growth planning."
        else:
            where_you_left_off_summary = f"Call paused early at Stage {max_stage} ({STAGES_DICT[max_stage].name})."
            suggested_callback_bridge = f"Hi {prospect_name} ji, {caller_name} from Meridian calling back to connect regarding {company}."

        # 10. Build 8-stage blocks with preset selections and prospect words
        start_stage = min(turn_stages) if turn_stages else 1
        stage_blocks: Dict[str, StageBlockData] = {}
        for s_num in range(1, 9):
            s_key = str(s_num)
            meta = STAGES_DICT.get(s_num, STAGES_DICT[1])
            is_reached = (start_stage <= s_num <= max_stage)

            if is_reached:
                # Find prospect turns associated with this stage
                p_turns_in_stage = [
                    t["text"] for idx, t in enumerate(turns)
                    if turn_stages[idx] == s_num and t["speaker"] in ("PROSPECT", "RECEPTION")
                ]

                # 1. Prospect Words
                if s_num == 5 and verbatim_stage_5:
                    p_words = verbatim_stage_5
                elif s_num == 6 and objection_text:
                    p_words = objection_text
                elif p_turns_in_stage:
                    p_words = max(p_turns_in_stage, key=len)
                else:
                    p_words = f"Discussed stage {s_num} topics."

                # 2. Selected Preset Option
                all_text_in_stage = " ".join(t["text"].lower() for idx, t in enumerate(turns) if turn_stages[idx] == s_num)
                
                if s_num == 1:
                    if any(w in all_text_in_stage for w in ["wrong person", "left", "no longer"]):
                        preset = "Wrong person / Left company"
                    elif any(w in all_text_in_stage for w in ["busy", "call later", "in a meeting", "driving"]):
                        preset = "Busy / Call back later"
                    elif any(w in all_text_in_stage for w in ["reception", "switchboard", "board line"]):
                        preset = "Gatekeeper / Switchboard answered"
                    else:
                        preset = "Reached right person"
                elif s_num == 2:
                    if any(w in all_text_in_stage for w in ["what do you do", "what firm", "explain"]):
                        preset = "Asked what we do"
                    elif any(w in all_text_in_stage for w in ["where did you get", "number from"]):
                        preset = "Asked where we got the number"
                    elif any(w in all_text_in_stage for w in ["sales call", "selling"]):
                        preset = "Said it is a sales call"
                    else:
                        preset = "Let me explain purpose"
                elif s_num == 3:
                    if any(w in all_text_in_stage for w in ["whatsapp", "email", "send it"]):
                        preset = "Demanded WhatsApp / Email first"
                    elif any(w in all_text_in_stage for w in ["after", "tomorrow", "next week", "call back"]):
                        preset = "Requested callback at specific time"
                    elif any(w in all_text_in_stage for w in ["busy", "not interested", "not now"]):
                        preset = "Polite brush-off / Line busy"
                    else:
                        preset = "Agreed to talk now"
                elif s_num == 4:
                    if any(w in all_text_in_stage for w in ["tell me about", "your firm first"]):
                        preset = "Asked caller to pitch first"
                    elif any(w in all_text_in_stage for w in ["wrong division", "size", "not that", "dont manufacture"]):
                        preset = "Corrected company size / division"
                    elif len(p_turns_in_stage) > 0 and len(p_turns_in_stage[0].split()) <= 4:
                        preset = "One-line curt response"
                    else:
                        preset = "Described core operations"
                elif s_num == 5:
                    if any(w in all_text_in_stage for w in ["scrap", "capacity", "bottleneck", "underutilized"]):
                        preset = "Stated capacity / scrap bottleneck"
                    elif any(w in all_text_in_stage for w in ["no need", "everything is fine", "don't need"]):
                        preset = "Claimed no current need"
                    elif any(w in all_text_in_stage for w in ["size", "for us", "what can you do"]):
                        preset = "Asked what we can do for their size"
                    else:
                        preset = "Named growth / margin goal"
                elif s_num == 6:
                    if any(w in all_text_in_stage for w in ["not the right", "speak to", "director", "owner"]):
                        preset = "Wrong person / Referred to director"
                    elif any(w in all_text_in_stage for w in ["in writing", "send something", "we will see"]):
                        preset = "Polite dismissal: Send in writing"
                    elif any(w in all_text_in_stage for w in ["do not call", "firm no", "never"]):
                        preset = "Firm no / Do not call"
                    else:
                        preset = "Already have in-house team/agency"
                elif s_num == 7:
                    if "google meet" in (next_step_action or "").lower():
                        preset = "Confirmed Google Meet / Discussion"
                    elif "call" in (next_step_action or "").lower():
                        preset = "Scheduled fixed day/time follow-up"
                    elif any(w in all_text_in_stage for w in ["referral", "contact", "speak to mr"]):
                        preset = "Referral contact obtained"
                    else:
                        preset = "Agreed to receive WhatsApp report"
                elif s_num == 8:
                    if any(w in all_text_in_stage for w in ["disconnect", "hung up", "dropped", "cut"]):
                        preset = "Abrupt line drop / hung up"
                    elif any(w in all_text_in_stage for w in ["locked", "calendar", "invite"]):
                        preset = "Next step locked in calendar"
                    elif any(w in all_text_in_stage for w in ["we will see", "okay"]):
                        preset = "Polite non-committal goodbye"
                    else:
                        preset = "Clear confirmation & warm close"

                stage_blocks[s_key] = StageBlockData(
                    stage_number=s_num,
                    stage_name=meta.name,
                    reached=True,
                    selected_preset=preset,
                    prospect_words=p_words,
                    summary=f"Stage {s_num}: {preset}",
                    start_turn=0,
                    end_turn=0
                )
            else:
                stage_blocks[s_key] = StageBlockData(
                    stage_number=s_num,
                    stage_name=meta.name,
                    reached=False,
                    selected_preset=None,
                    prospect_words=None,
                    summary="Stage not reached before call termination.",
                    start_turn=None,
                    end_turn=None
                )

        return CallAnalysisResult(
            transcript_id=transcript_id,
            company_name=company,
            company_kind=company_kind,
            prospect_name=prospect_name,
            prospect_role=prospect_role,
            caller_name=caller_name,
            duration_seconds=duration_seconds,
            max_stage_number=max_stage,
            max_stage_name=STAGES_DICT[max_stage].name,
            outcome=outcome,
            stage_5_need_verbatim=verbatim_stage_5,
            objection_category=objection_text[:60] if objection_text else None,
            objection_summary=objection_text,
            next_step_action=next_step_action,
            next_step_date_time=next_step_time,
            next_step_channel=next_step_channel,
            where_you_left_off_summary=where_you_left_off_summary,
            suggested_callback_bridge=suggested_callback_bridge,
            caller_last_ask=caller_last_ask,
            prospect_final_response=prospect_final_response,
            summary=summary,
            stage_chunks=stage_chunks,
            turn_classifications=turn_classifications,
            stage_blocks=stage_blocks,
            battlecard=battlecard
        )

heuristics_service = HeuristicsService()
