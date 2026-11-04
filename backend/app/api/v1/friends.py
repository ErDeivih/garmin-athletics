import secrets
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, Friendship, FriendInvite
from app.api.deps import require_current_user

router = APIRouter(prefix="/friends", tags=["Friends & Social"])

INVITE_TTL_DAYS = 7
_INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # sin confusos 0/O/1/I/L


def _new_invite_code() -> str:
    return "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(6))


class FriendRequestCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, example="amigo_corredor")


class FriendRequestRespond(BaseModel):
    action: str = Field(..., pattern="^(accept|reject)$", example="accept")


class InviteAcceptRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=12, example="K7Q2XA")


async def _get_friend_ids(db: AsyncSession, user_id: str) -> List[str]:
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    )
    friendships = result.scalars().all()
    return [
        f.addressee_id if f.requester_id == user_id else f.requester_id
        for f in friendships
    ]


async def get_accepted_friends(db: AsyncSession, user_id: str) -> List[User]:
    friend_ids = await _get_friend_ids(db, user_id)
    if not friend_ids:
        return []
    result = await db.execute(select(User).where(User.id.in_(friend_ids)))
    return list(result.scalars().all())


@router.post("/requests", status_code=status.HTTP_201_CREATED,
             summary="Enviar una solicitud de amistad por nombre de usuario")
async def send_friend_request(
    payload: FriendRequestCreate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    target_res = await db.execute(select(User).where(User.username == payload.username.strip()))
    target = target_res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No existe ningún atleta con el usuario '{payload.username}'.")
    if target.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="No puedes enviarte una solicitud a ti mismo.")

    existing = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == target.id),
                and_(Friendship.requester_id == target.id, Friendship.addressee_id == user.id),
            ),
            Friendship.status.in_(["pending", "accepted"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Ya existe una relación o solicitud pendiente con este atleta.")

    friendship = Friendship(
        id=str(uuid.uuid4()),
        requester_id=user.id,
        addressee_id=target.id,
        status="pending",
    )
    db.add(friendship)
    await db.commit()
    await db.refresh(friendship)

    return {
        "status": "pending",
        "friendship_id": friendship.id,
        "to": {"id": target.id, "username": target.username},
    }


@router.post("/requests/{friendship_id}/respond", summary="Aceptar o rechazar una solicitud recibida")
async def respond_friend_request(
    friendship_id: str,
    payload: FriendRequestRespond,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    result = await db.execute(
        select(Friendship).where(
            Friendship.id == friendship_id,
            Friendship.addressee_id == user.id,
            Friendship.status == "pending",
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Solicitud no encontrada o ya gestionada.")

    if payload.action == "accept":
        friendship.status = "accepted"
        response = {"status": "accepted", "friendship_id": friendship.id}
    else:
        await db.delete(friendship)
        response = {"status": "rejected", "friendship_id": friendship_id}

    await db.commit()
    return response


@router.get("/", summary="Listar amigos y solicitudes pendientes")
async def list_friends(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    friends = await get_accepted_friends(db, user.id)

    incoming_res = await db.execute(
        select(Friendship, User).join(User, User.id == Friendship.requester_id).where(
            Friendship.addressee_id == user.id, Friendship.status == "pending"
        )
    )
    incoming = [
        {
            "friendship_id": fs.id,
            "from": {"id": u.id, "username": u.username, "display_name": u.display_name},
        }
        for fs, u in incoming_res.all()
    ]

    outgoing_res = await db.execute(
        select(Friendship, User).join(User, User.id == Friendship.addressee_id).where(
            Friendship.requester_id == user.id, Friendship.status == "pending"
        )
    )
    outgoing = [
        {
            "friendship_id": fs.id,
            "to": {"id": u.id, "username": u.username, "display_name": u.display_name},
        }
        for fs, u in outgoing_res.all()
    ]

    return {
        "friends": [
            {"id": f.id, "username": f.username, "display_name": f.display_name}
            for f in friends
        ],
        "incoming_requests": incoming,
        "outgoing_requests": outgoing,
    }


@router.delete("/{user_id}", summary="Eliminar una amistad existente")
async def remove_friend(
    user_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == user_id),
                and_(Friendship.requester_id == user_id, Friendship.addressee_id == user.id),
            ),
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Amistad no encontrada.")

    await db.delete(friendship)
    await db.commit()
    return {"status": "removed", "former_friend_id": user_id}


@router.post("/invite", status_code=status.HTTP_201_CREATED,
             summary="Crear un código de invitación para compartir por WhatsApp")
async def create_invite(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Genera un código corto (6 caracteres, 7 días) que acepta amistad directa."""
    for _ in range(5):  # reintentos ante colisión de código
        code = _new_invite_code()
        exists = await db.execute(select(FriendInvite).where(FriendInvite.code == code))
        if not exists.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="No se pudo generar un código único, reintenta.")
    invite = FriendInvite(
        code=code,
        inviter_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    await db.commit()
    return {"code": code, "expires_at": invite.expires_at.isoformat()}


@router.post("/accept-invite", summary="Aceptar una invitación con su código (amistad directa)")
async def accept_invite(
    payload: InviteAcceptRequest,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    code = payload.code.strip().upper()
    inv_res = await db.execute(select(FriendInvite).where(FriendInvite.code == code))
    invite = inv_res.scalar_one_or_none()
    if not invite or invite.used_by_id or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Código inválido, caducado o ya usado.")
    if invite.inviter_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="No puedes aceptar tu propia invitación.")

    inviter_res = await db.execute(select(User).where(User.id == invite.inviter_id))
    inviter = inviter_res.scalar_one_or_none()
    if not inviter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="El atleta que invitó ya no existe.")

    existing = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == inviter.id),
                and_(Friendship.requester_id == inviter.id, Friendship.addressee_id == user.id),
            ),
            Friendship.status.in_(["pending", "accepted"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Ya sois amigos o hay una solicitud pendiente.")

    friendship = Friendship(
        id=str(uuid.uuid4()),
        requester_id=user.id,
        addressee_id=inviter.id,
        status="accepted",  # la invitación equivale a aceptación mutua
    )
    db.add(friendship)
    invite.used_by_id = user.id
    invite.used_at = datetime.utcnow()
    await db.commit()
    return {"status": "accepted", "friend": {"id": inviter.id, "username": inviter.username,
                                            "display_name": inviter.display_name}}
