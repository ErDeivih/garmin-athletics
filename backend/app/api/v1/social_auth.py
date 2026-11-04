import uuid
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, create_token, revoke_token
from app.core.config import settings
from app.db.session import get_db
from app.db.models import (
    User, GarminCredential, Activity, DailyBiometrics, DailyStat,
    FatigueMetric, StrengthLog, PersonalRecord, CalendarEvent,
    PrivacyZone, Friendship, FriendInvite, Route,
)
from app.api.deps import require_current_user
from app.services.garmin_service import GarminService

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    email: str = Field(..., example="atleta@ejemplo.com")
    username: str = Field(..., min_length=3, max_length=50, example="corredor_pro")
    display_name: str = Field(..., min_length=1, max_length=100, example="David M.")
    password: str = Field(..., min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(..., example="atleta@ejemplo.com")
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


def _public_profile(user: User) -> Dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "display_name": user.display_name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED,
             summary="Registrar una nueva cuenta de atleta")
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email_norm = payload.email.strip().lower()
    if "@" not in email_norm or "." not in email_norm.split("@")[-1]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Email no válido.")
    dup = await db.execute(
        select(User).where((User.email == email_norm) | (User.username == payload.username.strip()))
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="El email o el nombre de usuario ya están registrados.")

    user = User(
        id=str(uuid.uuid4()),
        email=email_norm,
        username=payload.username.strip(),
        display_name=payload.display_name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_token(user.id),
        user_id=user.id,
        username=user.username,
    )


@router.post("/login", response_model=TokenResponse, summary="Iniciar sesión y obtener token JWT")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email.strip().lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada.")

    return TokenResponse(
        access_token=create_token(user.id),
        user_id=user.id,
        username=user.username,
    )


@router.get("/me", summary="Perfil del usuario autenticado")
async def me(user: User = Depends(require_current_user)):
    return _public_profile(user)


@router.post("/logout", summary="Cerrar sesión (revoca el token actual)")
async def logout(request: Request, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Revoca el Bearer de la cabecera para que no sirva aunque no expire."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        revoke_token(auth[7:].strip())
    return {"status": "logged_out"}


@router.delete("/account", summary="Borrar mi cuenta y TODOS mis datos (GDPR)")
async def delete_account(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Elimina filas propias de todas las tablas + tokens + tracks + rutas."""
    import shutil
    from sqlalchemy import delete as _delete
    uid = user.id
    await db.execute(_delete(Activity).where(Activity.user_id == uid))
    await db.execute(_delete(DailyBiometrics).where(DailyBiometrics.user_id == uid))
    await db.execute(_delete(DailyStat).where(DailyStat.user_id == uid))
    await db.execute(_delete(FatigueMetric).where(FatigueMetric.user_id == uid))
    await db.execute(_delete(StrengthLog).where(StrengthLog.user_id == uid))
    await db.execute(_delete(PersonalRecord).where(PersonalRecord.user_id == uid))
    await db.execute(_delete(CalendarEvent).where(CalendarEvent.user_id == uid))
    await db.execute(_delete(PrivacyZone).where(PrivacyZone.user_id == uid))
    await db.execute(_delete(Route).where(Route.user_id == uid))
    await db.execute(_delete(GarminCredential).where(GarminCredential.user_id == uid))
    await db.execute(_delete(Friendship).where(
        (Friendship.requester_id == uid) | (Friendship.addressee_id == uid)))
    await db.execute(_delete(FriendInvite).where(FriendInvite.inviter_id == uid))
    await db.execute(_delete(FriendInvite).where(FriendInvite.used_by_id == uid))
    await db.execute(_delete(User).where(User.id == uid))
    await db.commit()
    shutil.rmtree(f"{settings.GARMIN_TOKENS_DIR}_{uid}", ignore_errors=True)
    for sub in ("tracks", "routes"):
        shutil.rmtree(f"{settings.TRACKS_DIR}/{sub}/{uid}", ignore_errors=True)
    return {"status": "deleted"}


class GarminCredentialsRequest(BaseModel):
    garmin_email: str = Field(..., example="tu_email@ejemplo.com")
    garmin_password: str = Field(..., min_length=1)


class GarminMfaRequest(BaseModel):
    garmin_email: str = Field(...)
    garmin_password: str = Field(..., min_length=1)
    ticket: Dict[str, Any] = Field(..., description="Ticket del paso 1 (un solo uso)")
    code: str = Field(..., min_length=4, max_length=12, description="Código 2FA")


def _user_token_dir(user_id: str) -> str:
    return f"{settings.GARMIN_TOKENS_DIR}_{user_id}"


@router.put("/garmin-credentials", summary="Vincular tu cuenta Garmin (la contraseña se usa una vez y NO se guarda)")
async def set_garmin_credentials(
    payload: GarminCredentialsRequest,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Vincula la cuenta Garmin del usuario.

    PRIVACIDAD: la contraseña viaja por HTTPS, se usa para UN solo login y se
    descarta de memoria. Solo quedan los tokens de sesión en disco. Ni el dueño
    del servidor puede recuperar tu contraseña de Garmin.
    Si la cuenta pide 2FA, responde {need_mfa: true, ticket} y hay que llamar
    a POST /auth/garmin-mfa con el código.
    """
    service = GarminService(token_dir=_user_token_dir(user.id), use_env_fallback=False)
    email = payload.garmin_email.strip().lower()
    try:
        outcome = service.link_with_password(email, payload.garmin_password)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    finally:
        # La contraseña no sale de este scope ni se persiste en ningún sitio.
        payload.garmin_password = ""

    if outcome.get("need_mfa"):
        return {"status": "need_mfa", "ticket": outcome["ticket"],
                "message": "Garmin pide verificación en dos pasos. Introduce el código."}

    result = await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        cred = GarminCredential(user_id=user.id)
        db.add(cred)
    cred.garmin_email = email
    cred.garmin_password_encrypted = None  # passwordless: nunca persistir
    cred.needs_reauth = False
    await db.commit()
    return {"status": "saved", "garmin_email": cred.garmin_email}


@router.post("/garmin-mfa", summary="Completar vinculación Garmin con código 2FA")
async def complete_garmin_mfa(
    payload: GarminMfaRequest,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    service = GarminService(token_dir=_user_token_dir(user.id), use_env_fallback=False)
    email = payload.garmin_email.strip().lower()
    try:
        service.complete_mfa_link(email, payload.garmin_password, payload.ticket, payload.code)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    finally:
        payload.garmin_password = ""

    result = await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        cred = GarminCredential(user_id=user.id)
        db.add(cred)
    cred.garmin_email = email
    cred.garmin_password_encrypted = None
    cred.needs_reauth = False
    await db.commit()
    return {"status": "saved", "garmin_email": cred.garmin_email}


@router.delete("/garmin-credentials", summary="Desvincular tu cuenta de Garmin Connect")
async def remove_garmin_credentials(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    import shutil
    result = await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No tienes Garmin vinculado.")
    await db.delete(cred)
    await db.commit()
    # Borrar también los tokens de sesión de disco.
    shutil.rmtree(_user_token_dir(user.id), ignore_errors=True)
    return {"status": "removed"}


@router.get("/garmin-status", summary="Estado de vinculación con Garmin")
async def garmin_status(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    result = await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        return {"linked": False}
    return {
        "linked": True,
        "garmin_email": cred.garmin_email,
        "needs_reauth": bool(cred.needs_reauth),
        "last_sync_at": cred.last_sync_at.isoformat() if cred.last_sync_at else None,
    }
