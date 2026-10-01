import { useEffect, useState } from "react";
import api from "../api/client";
import RoomCard from "../components/RoomCard";

export default function MyMatches() {
  const [rooms, setRooms] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/rooms/mine").then(({ data }) => setRooms(data.rooms || [])).catch(() => setRooms([])).finally(() => setLoading(false)); }, []);
  return <section className="container page-section"><div className="page-title"><span className="eyebrow">Your games</span><h1>My matches</h1><p>Open rooms, active matches and completed results all stay here.</p></div>{loading ? <div className="page-state">Loading matches…</div> : rooms.length ? <div className="room-grid">{rooms.map((room) => <RoomCard key={room._id} room={room} mine />)}</div> : <div className="empty-state"><h3>No matches yet.</h3><p>Create or join a room from the lobby to get started.</p></div>}</section>;
}
