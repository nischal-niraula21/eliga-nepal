export function roomForUser(roomDoc, user) {
  const room = roomDoc.toObject ? roomDoc.toObject() : { ...roomDoc };
  const userId = String(user?._id || "");
  const hostId = String(room.host?._id || room.host || "");
  const challengerId = String(room.challenger?._id || room.challenger || "");
  const isHost = userId && userId === hostId;
  const isChallenger = userId && userId === challengerId;

  room.game = room.game || "EFOOTBALL";
  room.roomAccessId = room.roomAccessId || room.efootballRoomId || "";
  room.roomAccessPassword = room.roomAccessPassword || room.efootballPassword || "";

  const pendingId = String(room.pendingChallenger?._id || room.pendingChallenger || "");
  const reservationActive = Boolean(pendingId && room.reservationExpiresAt && new Date(room.reservationExpiresAt).getTime() > Date.now());
  room.reservationActive = reservationActive;
  if (!(isHost || user?.role === "admin")) {
    delete room.reservationExpiresAt;
  }
  delete room.pendingChallenger;

  if (!isHost && !isChallenger && user?.role !== "admin") {
    delete room.roomAccessPassword;
    delete room.efootballPassword;
  }

  return room;
}
