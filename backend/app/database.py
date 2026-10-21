from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL
if not db_url:
    from app.config import BASE_DIR
    db_url = f"sqlite:///{BASE_DIR}/callerlog.db"

# Supabase and Render sometimes provide URLs starting with postgres:// or postgresql://
# If no specific driver is designated, explicitly enforce +psycopg2
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine_kwargs = {}
if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / Supabase pooler connection tuning
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(db_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import app.models  # Register all models on Base.metadata
    Base.metadata.create_all(bind=engine)
    if db_url.startswith("sqlite"):
        try:
            with engine.connect() as conn:
                from sqlalchemy import text
                res = conn.execute(text("PRAGMA table_info(calls)")).fetchall()
                existing_cols = {row[1] for row in res}
                columns_to_ensure = [
                    ("next_step_date_time", "VARCHAR(100)"),
                    ("next_step_channel", "VARCHAR(50)"),
                    ("call_id", "VARCHAR(100)"),
                    ("call_id_status", "VARCHAR(50) DEFAULT 'ACTIVE'"),
                    ("attempt_count", "INTEGER DEFAULT 1"),
                    ("caller_last_ask", "TEXT"),
                    ("prospect_final_response", "TEXT"),
                    ("where_you_left_off_summary", "TEXT"),
                    ("suggested_callback_bridge", "TEXT"),
                    ("last_turn_index", "INTEGER DEFAULT -1")
                ]
                for col_name, col_type in columns_to_ensure:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE calls ADD COLUMN {col_name} {col_type}"))
                conn.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"SQLite auto-migration warning: {e}")

