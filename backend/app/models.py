import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, index=True)
    company_kind = Column(String(100), default="not known")
    industry = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    contacts = relationship("Contact", back_populates="company", cascade="all, delete-orphan")
    calls = relationship("CallRecord", back_populates="company", cascade="all, delete-orphan")

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    full_name = Column(String(255), nullable=False, index=True)
    role_title = Column(String(255), default="not known")
    phone_number = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    personal_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    company = relationship("Company", back_populates="contacts")
    calls = relationship("CallRecord", back_populates="contact")

class CallRecord(Base):
    __tablename__ = "calls"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    transcript_id = Column(String(50), nullable=True, index=True)
    caller_name = Column(String(100), nullable=False)
    duration_seconds = Column(Integer, default=0)
    max_stage_number = Column(Integer, nullable=False, default=1, index=True)
    max_stage_name = Column(String(50), nullable=False)
    outcome = Column(String(50), nullable=False, default="not_logged", index=True)
    stage_5_need_verbatim = Column(Text, nullable=True)
    objection_summary = Column(Text, nullable=True)
    next_step_action = Column(String(255), nullable=True)
    next_step_date_time = Column(String(100), nullable=True)
    next_step_channel = Column(String(50), nullable=True)
    call_id = Column(String(100), nullable=True, index=True)
    call_id_status = Column(String(50), default="ACTIVE", index=True) # ACTIVE or CLOSED
    attempt_count = Column(Integer, default=1)
    last_turn_index = Column(Integer, default=-1, nullable=True)
    caller_last_ask = Column(Text, nullable=True)
    prospect_final_response = Column(Text, nullable=True)
    where_you_left_off_summary = Column(Text, nullable=True)
    suggested_callback_bridge = Column(Text, nullable=True)
    raw_transcript = Column(Text, nullable=False)
    stage_analysis = Column(JSON, default=list)
    call_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    company = relationship("Company", back_populates="calls")
    contact = relationship("Contact", back_populates="calls")
