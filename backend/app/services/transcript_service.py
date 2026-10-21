import json
import re
from pathlib import Path
from typing import List, Optional, Dict, Any
from app.config import settings
from app.schemas import TranscriptSummary, TranscriptDetail, TranscriptTurn

class TranscriptService:
    def __init__(self, data_path: Optional[Path] = None):
        self.data_path = data_path or settings.TRANSCRIPTS_PATH
        self.index_path = self.data_path / "index.json"
        self.transcripts_dir = self.data_path / "transcripts"
        self._cache_index: Optional[List[Dict[str, Any]]] = None

    def get_all_summaries(self) -> List[TranscriptSummary]:
        if not self._cache_index:
            if not self.index_path.exists():
                return []
            with open(self.index_path, "r", encoding="utf-8") as f:
                self._cache_index = json.load(f)
        
        summaries = []
        for item in self._cache_index:
            tid = item.get("id", "")
            cid = f"CALL-{1000 + int(tid[1:])}" if (tid.startswith("T") and tid[1:].isdigit()) else None
            summaries.append(TranscriptSummary(
                id=tid,
                call_id=cid,
                duration_seconds=int(item.get("duration_seconds", 0)),
                outcome=item.get("outcome", "not_logged"),
                prospect_role=item.get("prospect_role", "not known"),
                company_kind=item.get("company_kind", "not known"),
                company=item.get("company", "Unknown"),
                caller=item.get("caller", "Caller"),
                turns=int(item.get("turns", 0))
            ))
        return summaries

    def get_transcript_by_id(self, transcript_id: str) -> Optional[TranscriptDetail]:
        summaries = self.get_all_summaries()
        matched_summary = next((s for s in summaries if s.id.upper() == transcript_id.upper()), None)
        
        file_path = self.transcripts_dir / f"{transcript_id.upper()}.txt"
        if not file_path.exists():
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            raw_text = f.read()

        parsed_turns = self.parse_raw_turns(raw_text)

        if matched_summary:
            return TranscriptDetail(
                id=matched_summary.id,
                call_id=matched_summary.call_id,
                duration_seconds=matched_summary.duration_seconds,
                outcome=matched_summary.outcome,
                prospect_role=matched_summary.prospect_role,
                company_kind=matched_summary.company_kind,
                company=matched_summary.company,
                caller=matched_summary.caller,
                turns=len(parsed_turns) if parsed_turns else matched_summary.turns,
                raw_text=raw_text,
                turns_list=parsed_turns
            )
        
        # If not in index, infer from file headers
        header_meta = self.extract_headers_from_raw(raw_text)
        return TranscriptDetail(
            id=transcript_id,
            duration_seconds=int(header_meta.get("duration_seconds", 60)),
            outcome=header_meta.get("outcome", "not_logged"),
            prospect_role=header_meta.get("prospect_role", "not known"),
            company_kind=header_meta.get("company_kind", "not known"),
            company=header_meta.get("company", "Unknown"),
            caller=header_meta.get("caller", "Caller"),
            turns=len(parsed_turns),
            raw_text=raw_text,
            turns_list=parsed_turns
        )

    def extract_headers_from_raw(self, raw_text: str) -> Dict[str, str]:
        headers: Dict[str, str] = {}
        for line in raw_text.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("#"):
                continue
            if ":" in line and not line.startswith(("CALLER:", "PROSPECT:", "RECEPTION:")):
                parts = line.split(":", 1)
                key = parts[0].strip().lower()
                val = parts[1].strip()
                headers[key] = val
            elif line.startswith(("CALLER:", "PROSPECT:", "RECEPTION:")):
                break
        return headers

    def parse_raw_turns(self, raw_text: str) -> List[TranscriptTurn]:
        turns: List[TranscriptTurn] = []
        speaker_pattern = re.compile(r"^(CALLER|PROSPECT|RECEPTION):\s*(.*)", re.IGNORECASE)
        
        current_speaker: Optional[str] = None
        current_lines: List[str] = []
        turn_idx = 0

        for line in raw_text.splitlines():
            match = speaker_pattern.match(line.strip())
            if match:
                if current_speaker and current_lines:
                    turns.append(TranscriptTurn(
                        turn_index=turn_idx,
                        speaker=current_speaker,
                        text=" ".join(current_lines).strip()
                    ))
                    turn_idx += 1
                    current_lines = []
                current_speaker = match.group(1).upper()
                current_lines.append(match.group(2).strip())
            elif current_speaker:
                # Continuation line
                if line.strip():
                    current_lines.append(line.strip())

        if current_speaker and current_lines:
            turns.append(TranscriptTurn(
                turn_index=turn_idx,
                speaker=current_speaker,
                text=" ".join(current_lines).strip()
            ))

        return turns

transcript_service = TranscriptService()
