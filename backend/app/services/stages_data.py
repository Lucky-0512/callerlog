from typing import Dict, List
from app.schemas import StageMetadata

STAGES_DICT: Dict[int, StageMetadata] = {
    1: StageMetadata(
        number=1,
        name="Opening",
        purpose="Reach the right person and say who you are. The prospect decides in the first ten seconds whether this call is worth a minute.",
        they_may_say=[
            "Who is speaking?",
            "I'm driving / in a meeting / at lunch.",
            "This number belongs to someone who left the company."
        ],
        what_happened_options=[
            "Reached right person",
            "Gatekeeper / Switchboard answered",
            "Busy / Call back later",
            "Wrong person / Left company"
        ],
        action_label="Next: Purpose"
    ),
    2: StageMetadata(
        number=2,
        name="Purpose",
        purpose="Say in one or two sentences why you called, in words the prospect can repeat to a colleague.",
        they_may_say=[
            "What does your company do?",
            "Where did you get my number?",
            "Is this a sales call?"
        ],
        what_happened_options=[
            "Asked what we do",
            "Asked where we got number",
            "Called it a sales call",
            "Let me explain purpose"
        ],
        action_label="Next: Permission"
    ),
    3: StageMetadata(
        number=3,
        name="Permission",
        purpose="Find out whether they are willing to talk now. A clear yes, a clear no, or a time to call back are all good outcomes.",
        they_may_say=[
            "Call me after 2 PM / Call tomorrow.",
            "Send it on WhatsApp first.",
            "Haan, boliye / Go ahead (short yes)."
        ],
        what_happened_options=[
            "Agreed to talk now",
            "Requested callback at specific time",
            "Demanded WhatsApp / Email first",
            "Polite brush-off / Line busy"
        ],
        action_label="Next: Their Business"
    ),
    4: StageMetadata(
        number=4,
        name="Their Business",
        purpose="Ask about their company and their work before saying anything about yours. People talk about what they do.",
        they_may_say=[
            "We do precision engineering / chemical formulation.",
            "You have the wrong division, we don't manufacture that.",
            "Tell me about your firm first."
        ],
        what_happened_options=[
            "Described core operations",
            "Corrected company size / division",
            "Asked caller to pitch first",
            "One-line curt response"
        ],
        action_label="Next: Their Need"
    ),
    5: StageMetadata(
        number=5,
        name="Their Need, in Their Words",
        purpose="Hear what they are trying to do or struggling with, in their own words. The caller writes down exactly what was said.",
        they_may_say=[
            "Trying new approaches is the only way to see what's working.",
            "Our capacity is underutilized / looking for higher margins.",
            "Everything is fine, we don't need external consultants."
        ],
        what_happened_options=[
            "Named growth / margin goal",
            "Stated capacity / process bottleneck",
            "Claimed no current need",
            "Asked what we can do for their size"
        ],
        action_label="Next: Objection"
    ),
    6: StageMetadata(
        number=6,
        name="Objection",
        purpose="Hear the reason for a no and understand it. A reason you understand can be answered on this call or the next.",
        they_may_say=[
            "We already have an agency / consultant / in-house team.",
            "I'm not the right person; speak to director / marketing.",
            "Send something in writing and we will see."
        ],
        what_happened_options=[
            "Already have agency/in-house team",
            "Wrong person / Referred to someone else",
            "Polite dismissal: 'Send in writing'",
            "Firm no / Do not call"
        ],
        action_label="Next: Next Step"
    ),
    7: StageMetadata(
        number=7,
        name="Next Step",
        purpose="Agree one concrete thing: a document on WhatsApp or email, a call at a named time, a meeting.",
        they_may_say=[
            "Send the report on WhatsApp to this number.",
            "Call me next Tuesday after 2 PM.",
            "Speak to Mr. Suresh on [number]."
        ],
        what_happened_options=[
            "Agreed to receive WhatsApp report",
            "Scheduled fixed day/time follow-up",
            "Confirmed Google Meet / Working session",
            "Referral contact obtained"
        ],
        action_label="Next: Close"
    ),
    8: StageMetadata(
        number=8,
        name="Close",
        purpose="End the call clearly and record what happened: the outcome, next step, and the prospect's words from stage 5.",
        they_may_say=[
            "Okay Priya / Arjun, thank you.",
            "Looking forward to the report.",
            "[Call disconnected / line dropped]"
        ],
        what_happened_options=[
            "Clear confirmation & warm close",
            "Abrupt line drop / hung up",
            "Polite non-committal goodbye",
            "Next step locked in calendar"
        ],
        action_label="Complete & Log Call"
    )
}

def get_stage_by_number(num: int) -> StageMetadata:
    return STAGES_DICT.get(num, STAGES_DICT[1])
