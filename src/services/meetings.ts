import { authFetch } from "./auth";

export interface Meeting {
  id: string;
  room_id: string;
  host_user_id: string;
  title: string | null;
  status: string;
  created_at: string;
  ended_at: string | null;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
}

export async function createMeeting(
  title?: string
): Promise<Meeting> {
  const response = await authFetch<{
    meeting: Meeting;
  }>("/api/meetings", {
    method: "POST",
    body: JSON.stringify({
      title: title || null,
    }),
  });

  return response.meeting;
}

export async function getMeeting(
  roomId: string
): Promise<Meeting> {
  const response = await authFetch<{
    meeting: Meeting;
  }>(
    `/api/meetings/${encodeURIComponent(roomId)}`
  );

  return response.meeting;
}

export async function joinMeeting(
  roomId: string
): Promise<{
  meeting: Meeting;
  participant: MeetingParticipant;
}> {
  return authFetch(
    `/api/meetings/${encodeURIComponent(roomId)}/join`,
    {
      method: "POST",
    }
  );
}

export async function leaveMeeting(
  roomId: string
): Promise<void> {
  await authFetch(
    `/api/meetings/${encodeURIComponent(roomId)}/leave`,
    {
      method: "POST",
    }
  );
}

export async function endMeeting(
  roomId: string
): Promise<Meeting> {
  const response = await authFetch<{
    meeting: Meeting;
  }>(
    `/api/meetings/${encodeURIComponent(roomId)}/end`,
    {
      method: "POST",
    }
  );

  return response.meeting;
}