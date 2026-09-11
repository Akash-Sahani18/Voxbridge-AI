import express from "express";

import {
  requireAuth,
  type AuthenticatedRequest,
} from "../auth/authMiddleware";

import {
  createMeeting,
  endMeeting,
  getMeetingByRoomId,
  joinMeeting,
  leaveMeeting,
} from "./meetingService";

const router = express.Router();

router.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: "Authentication required.",
        });
        return;
      }

      const { title } = req.body;

      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        res.status(400).json({
          error: "Meeting motive is required.",
        });
        return;
      }

      if (title.trim().length > 255) {
        res.status(400).json({
          error:
            "Meeting motive must be 255 characters or less.",
        });
        return;
      }

      const meeting = await createMeeting(
        req.userId,
        title
      );

      res.status(201).json({ meeting });
    } catch (error) {
      console.error(
        "Create meeting error:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to create meeting.",
      });
    }
  }
);

router.get(
  "/:roomId",
  requireAuth,
  async (req, res) => {
    try {
      const roomId = String(
        req.params.roomId
      );

      const meeting =
        await getMeetingByRoomId(roomId);

      if (!meeting) {
        res.status(404).json({
          error: "Meeting not found.",
        });
        return;
      }

      res.json({ meeting });
    } catch (error) {
      console.error(
        "Get meeting error:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to get meeting.",
      });
    }
  }
);

router.post(
  "/:roomId/join",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: "Authentication required.",
        });
        return;
      }

      const roomId = String(
        req.params.roomId
      );

      const meeting =
        await getMeetingByRoomId(roomId);

      if (!meeting) {
        res.status(404).json({
          error: "Meeting not found.",
        });
        return;
      }

      if (meeting.status !== "active") {
        res.status(400).json({
          error: "This meeting has ended.",
        });
        return;
      }

      const participant =
        await joinMeeting(
          meeting.id,
          req.userId
        );

      res.json({
        meeting,
        participant,
      });
    } catch (error) {
      console.error(
        "Join meeting error:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to join meeting.",
      });
    }
  }
);

router.post(
  "/:roomId/leave",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: "Authentication required.",
        });
        return;
      }

      const roomId = String(
        req.params.roomId
      );

      const meeting =
        await getMeetingByRoomId(roomId);

      if (!meeting) {
        res.status(404).json({
          error: "Meeting not found.",
        });
        return;
      }

      await leaveMeeting(
        meeting.id,
        req.userId
      );

      res.json({
        message: "Left meeting successfully.",
      });
    } catch (error) {
      console.error(
        "Leave meeting error:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to leave meeting.",
      });
    }
  }
);

router.post(
  "/:roomId/end",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: "Authentication required.",
        });
        return;
      }

      const roomId = String(
        req.params.roomId
      );

      const meeting =
        await getMeetingByRoomId(roomId);

      if (!meeting) {
        res.status(404).json({
          error: "Meeting not found.",
        });
        return;
      }

      const updatedMeeting =
        await endMeeting(
          meeting.id,
          req.userId
        );

      res.json({
        meeting: updatedMeeting,
      });
    } catch (error) {
      console.error(
        "End meeting error:",
        error
      );

      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to end meeting.",
      });
    }
  }
);

export default router;