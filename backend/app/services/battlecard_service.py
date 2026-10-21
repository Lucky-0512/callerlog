from typing import Optional, Dict
from app.schemas import BattlecardResponse

BATTLECARDS_REPO: Dict[str, BattlecardResponse] = {
    "already_have_team": BattlecardResponse(
        objection="We already have an agency, a consultant, or an in-house team.",
        root_cause="Prospect assumes you want to replace their existing setup, triggering defensiveness or fear of sunk costs.",
        core_talk_track="Completely understand, sir. Most of our clients also have strong in-house teams or existing partners. We don't replace them—we provide an external benchmark and growth audit that gives your leadership fresh levers to maximize the team's output.",
        quick_counter_points=[
            "Compliment their existing infrastructure: 'That's actually great, it means you take this function seriously.'",
            "Differentiate: 'Our report is an outside-in growth diagnostic, not day-to-day execution.'",
            "Low commitment: 'Reviewing the one-pager takes 3 minutes and gives your team new benchmark data.'"
        ],
        question_to_ask_next="When your team reviews next quarter's growth numbers, what is the single biggest bottleneck they are aiming to crack?"
    ),
    "wrong_person": BattlecardResponse(
        objection="Not the right person / Speak to marketing, operations, or the owner.",
        root_cause="The prospect wants to deflect an unsolicited pitch, or genuinely lacks purchasing authority.",
        core_talk_track="Understood, and thanks for pointing that out. I called because from the outside, your division seems pivotal to growth. Before I reach out to them, what should I tell them is your top priority right now?",
        quick_counter_points=[
            "Acknowledge immediately without arguing.",
            "Ask for the exact name and direct extension/mobile politely.",
            "Offer to send a 1-page overview so they can forward it internally."
        ],
        question_to_ask_next="Could you guide me on who directly oversees this—is it Mr. Suresh or someone on the operations side?"
    ),
    "send_in_writing": BattlecardResponse(
        objection="Send something in writing / on WhatsApp / on email and we will see.",
        root_cause="Polite brush-off. In Indian B2B, 'send on WhatsApp' can either be genuine interest or a courteous way to hang up.",
        core_talk_track="I will happily send it on WhatsApp right now so you have it handy. The report is tailored to your industry, so to make sure I highlight the 2 pages most relevant to you—are you focusing more on expanding volume or protecting margins this quarter?",
        quick_counter_points=[
            "Agree immediately with zero friction: 'Yes, sending it over WhatsApp right away.'",
            "Anchor a follow-up: 'I will message you from this number so you can save it.'",
            "Set a 2-minute callback window: 'I'll give you 24 hours to glance at it, can I ping you Thursday at 11?'"
        ],
        question_to_ask_next="I have your number ending in [last 4 digits]—is your WhatsApp active on this same line?"
    ),
    "no_requirement": BattlecardResponse(
        objection="Everything is fine, we don't need anything / No requirement right now.",
        root_cause="Status quo bias. The prospect is comfortable and does not perceive any urgent pain point.",
        core_talk_track="That is great to hear—companies that are already running smoothly are usually the ones best positioned to capture market share from competitors. That's actually why we prepared this brief benchmark: it shows how the top 3 players in your space are driving extra margins.",
        quick_counter_points=[
            "Validate their stability: 'It's a credit to your operations that things are steady.'",
            "Shift from 'fixing broken things' to 'capturing hidden margins'.",
            "Frame it as competitive intelligence rather than a service pitch."
        ],
        question_to_ask_next="Do you feel your current production capacity is being utilized at 100%, or is there headroom to scale if demand spikes?"
    ),
    "startup_too_small": BattlecardResponse(
        objection="We are still a startup / We are too small for this right now.",
        root_cause="Fear of high consulting fees or enterprise bloat.",
        core_talk_track="Fair point! Actually, early-stage and growing companies get the highest ROI from this because fixing operational friction early prevents expensive rework once you scale to 50+ people.",
        quick_counter_points=[
            "Empathize with their stage: 'Scaling up is all about speed and lean capital.'",
            "Highlight simplicity: 'Our report is only 3 pages, designed specifically for founders.'",
            "Zero cost upfront: 'The research report is completely complimentary.'"
        ],
        question_to_ask_next="If you had to pick one process slowing your team down this month, what would it be?"
    )
}

class BattlecardService:
    @staticmethod
    def get_battlecard_for_objection(objection_text: Optional[str]) -> BattlecardResponse:
        if not objection_text:
            return BATTLECARDS_REPO["send_in_writing"]
        
        text_lower = objection_text.lower()
        if any(w in text_lower for w in ["agency", "consultant", "in-house", "team", "vendor", "already have"]):
            return BATTLECARDS_REPO["already_have_team"]
        elif any(w in text_lower for w in ["wrong person", "not relevant", "speak to", "marketing", "director", "not me"]):
            return BATTLECARDS_REPO["wrong_person"]
        elif any(w in text_lower for w in ["startup", "small", "early stage"]):
            return BATTLECARDS_REPO["startup_too_small"]
        elif any(w in text_lower for w in ["no requirement", "everything is fine", "don't need", "not interested", "nothing"]):
            return BATTLECARDS_REPO["no_requirement"]
        else:
            return BATTLECARDS_REPO["send_in_writing"]

battlecard_service = BattlecardService()
