"""
Billetera Digital - FastAPI Backend
Main application entry point.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import transactions, email_processing, dashboard, sms_processing
from app.services.email_fetcher import sync_emails_task

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background polling task
    print("[STARTUP] Iniciando tarea de sincronizacion de correos en segundo plano...")
    
    async def poll_emails():
        while True:
            try:
                await sync_emails_task()
            except Exception as e:
                print(f"Error en tarea de sincronizacion: {e}")
            # Wait for 5 minutes before checking again
            await asyncio.sleep(300)
            
    # Run the polling task as a background task
    task = asyncio.create_task(poll_emails())
    
    yield  # Yield control to FastAPI
    
    # Shutdown
    print("[SHUTDOWN] Deteniendo tarea de sincronizacion...")
    task.cancel()

app = FastAPI(
    title=settings.app_name,
    description="API para gestión financiera personal con procesamiento inteligente de transacciones bancarias",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow Expo dev server and web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(transactions.router)
app.include_router(email_processing.router)
app.include_router(dashboard.router)
app.include_router(sms_processing.router)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
