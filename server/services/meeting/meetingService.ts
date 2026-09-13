import crypto from "crypto";

import { pool } from "../../db/connection";

interface Meeting {
  id: string;
  room_id: string;
  host_user_id: string;
  title: string | null;
  status: string;
  created_at: string;
  ended_at: string | null;
}

interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
}

function generateRoomId(): string {
  const characters =
    "abcdefghijkmnpqrstuvwxyz23456789";

  const getPart = (length: number): string => {
    let result = "";

    for (let i = 0; i < length; i++) {
      result += characters[
        crypto.randomInt(characters.length)
      ];
    }

    return result;
  };

  return `${getPart(3)}-${getPart(4)}-${getPart(3)}`;
}

export async function createMeeting(
  userId: string,
  title?: string
): Promise<Meeting> {
  const roomId = generateRoomId();

  const result = await pool.query(
    `
    INSERT INTO meetings (
      room_id,
      host_user_id,
      title,
      status
    )
    VALUES (
      $1::text,
      $2::uuid,
      $3::text,
      'active'
    )
    RETURNING
      id,
      room_id,
      host_user_id,
      title,
      status,
      created_at,
      ended_at
    `,
    [roomId, userId, title?.trim() || null]
  );

  return result.rows[0];
}

export async function getMeetingByRoomId(
  roomId: string
): Promise<Meeting | null> {
  const result = await pool.query(
    `
    SELECT
      id,
      room_id,
      host_user_id,
      title,
      status,
      created_at,
      ended_at
    FROM meetings
    WHERE room_id = $1::text
    LIMIT 1
    `,
    [roomId]
  );

  return result.rowCount ? result.rows[0] : null;
}

export async function joinMeeting(
  meetingId: string,
  userId: string
): Promise<MeetingParticipant> {
  const existing = await pool.query(
    `
    SELECT
      id,
      meeting_id,
      user_id,
      joined_at,
      left_at
    FROM meeting_participants
    WHERE
      meeting_id = $1::uuid
      AND user_id = $2::uuid
    ORDER BY joined_at DESC
    LIMIT 1
    `,
    [meetingId, userId]
  );

  if (existing.rowCount) {
    const result = await pool.query(
      `
      UPDATE meeting_participants
      SET
        joined_at = NOW(),
        left_at = NULL
      WHERE id = $1::uuid
      RETURNING
        id,
        meeting_id,
        user_id,
        joined_at,
        left_at
      `,
      [existing.rows[0].id]
    );

    return result.rows[0];
  }

  const result = await pool.query(
    `
    INSERT INTO meeting_participants (
      meeting_id,
      user_id
    )
    VALUES (
      $1::uuid,
      $2::uuid
    )
    RETURNING
      id,
      meeting_id,
      user_id,
      joined_at,
      left_at
    `,
    [meetingId, userId]
  );

  return result.rows[0];
}

export async function leaveMeeting(
  meetingId: string,
  userId: string
): Promise<void> {
  await pool.query(
    `
    UPDATE meeting_participants
    SET left_at = NOW()
    WHERE
      meeting_id = $1::uuid
      AND user_id = $2::uuid
      AND left_at IS NULL
    `,
    [meetingId, userId]
  );
}

export async function endMeeting(
  meetingId: string,
  userId: string
): Promise<Meeting> {
  const result = await pool.query(
    `
    UPDATE meetings
    SET
      status = 'ended',
      ended_at = NOW()
    WHERE
      id = $1::uuid
      AND host_user_id = $2::uuid
      AND status = 'active'
    RETURNING
      id,
      room_id,
      host_user_id,
      title,
      status,
      created_at,
      ended_at
    `,
    [meetingId, userId]
  );

  if (!result.rowCount) {
    throw new Error(
      "Meeting not found or you are not the meeting host."
    );
  }

  return result.rows[0];
}