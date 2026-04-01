import { randomUUID } from "node:crypto";
import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import {
  conversationIdForClerkPair,
  conversationIdForJobClerkPair,
} from "#utils/conversationId.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
export const MAX_MESSAGE_LENGTH = 8000;

function clampLimit(limit) {
  const parsed = Number(limit) || DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

function normalizeClerkId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function orderParticipants(first, second) {
  return [first, second].sort((a, b) => a.clerkId.localeCompare(b.clerkId));
}

function mapParticipant(row, prefix) {
  return {
    clerkId: row[`${prefix}_clerk_id`],
    displayName: row[`${prefix}_name`] || row[`${prefix}_clerk_id`],
  };
}

function mapConversation(row, currentClerkId = null) {
  const participantOne = mapParticipant(row, "participant_one");
  const participantTwo = mapParticipant(row, "participant_two");
  const otherUser =
    currentClerkId == null
      ? null
      : participantOne.clerkId === currentClerkId
        ? participantTwo
        : participantOne;

  return {
    conversationId: row.id,
    conversationType: row.conversation_type,
    jobId: row.job_id,
    jobTitle: row.job_title,
    participants: [participantOne, participantTwo],
    otherUser,
    lastMessageText: row.last_message_text,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_clerk_id,
    senderName: row.sender_name || row.sender_clerk_id,
    text: row.text,
    createdAt: row.created_at,
    ...(row.client_message_id ? { clientMessageId: row.client_message_id } : {}),
  };
}

function resolveConversationId({
  conversationType,
  jobId = null,
  participantOne,
  participantTwo,
}) {
  if (conversationType === "job_application") {
    return conversationIdForJobClerkPair(
      jobId,
      participantOne.clerkId,
      participantTwo.clerkId
    );
  }

  return conversationIdForClerkPair(
    participantOne.clerkId,
    participantTwo.clerkId
  );
}

function withUpdatedConversation(conversation, senderClerkId, senderName, message) {
  const participants = conversation.participants.map((participant) =>
    participant.clerkId === senderClerkId
      ? {
          ...participant,
          displayName: senderName || participant.displayName,
        }
      : participant
  );

  return {
    ...conversation,
    participants,
    otherUser:
      participants.find((participant) => participant.clerkId !== senderClerkId) || null,
    lastMessageText: message.text,
    lastMessageAt: message.createdAt,
    updatedAt: message.createdAt,
  };
}

async function upsertConversation({
  conversationType = "direct",
  jobId = null,
  jobTitle = null,
  currentClerkId,
  currentUserName = null,
  otherClerkId,
  otherUserName = null,
}) {
  const me = normalizeClerkId(currentClerkId);
  const other = normalizeClerkId(otherClerkId);

  if (!me || !other || me === other) {
    throw new Error("A conversation needs two different Clerk users");
  }

  if (conversationType === "job_application" && !Number.isInteger(Number(jobId))) {
    throw new Error("jobId is required for job conversations");
  }

  const [participantOne, participantTwo] = orderParticipants(
    {
      clerkId: me,
      displayName: currentUserName?.trim() || null,
    },
    {
      clerkId: other,
      displayName: otherUserName?.trim() || null,
    }
  );

  const conversationId = resolveConversationId({
    conversationType,
    jobId,
    participantOne,
    participantTwo,
  });

  try {
    const result = await sql`
      INSERT INTO messaging_conversations (
        id,
        conversation_type,
        job_id,
        job_title,
        participant_one_clerk_id,
        participant_one_name,
        participant_two_clerk_id,
        participant_two_name,
        created_at,
        updated_at
      )
      VALUES (
        ${conversationId},
        ${conversationType},
        ${jobId ? Number(jobId) : null},
        ${jobTitle || null},
        ${participantOne.clerkId},
        ${participantOne.displayName},
        ${participantTwo.clerkId},
        ${participantTwo.displayName},
        NOW(),
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        conversation_type = EXCLUDED.conversation_type,
        job_id = COALESCE(EXCLUDED.job_id, messaging_conversations.job_id),
        job_title = COALESCE(EXCLUDED.job_title, messaging_conversations.job_title),
        participant_one_name = COALESCE(
          EXCLUDED.participant_one_name,
          messaging_conversations.participant_one_name
        ),
        participant_two_name = COALESCE(
          EXCLUDED.participant_two_name,
          messaging_conversations.participant_two_name
        ),
        updated_at = NOW()
      RETURNING
        id,
        conversation_type,
        job_id,
        job_title,
        participant_one_clerk_id,
        participant_one_name,
        participant_two_clerk_id,
        participant_two_name,
        last_message_text,
        last_message_at,
        created_at,
        updated_at;
    `;

    return mapConversation(result[0], me);
  } catch (error) {
    logger.error("upsertConversation error:", error);
    throw new Error("Failed to upsert conversation");
  }
}

export async function ensureDirectConversation({
  currentClerkId,
  currentUserName = null,
  otherClerkId,
  otherUserName = null,
}) {
  return upsertConversation({
    conversationType: "direct",
    currentClerkId,
    currentUserName,
    otherClerkId,
    otherUserName,
  });
}

export async function ensureJobConversation({
  jobId,
  jobTitle = null,
  currentClerkId,
  currentUserName = null,
  otherClerkId,
  otherUserName = null,
}) {
  return upsertConversation({
    conversationType: "job_application",
    jobId: Number(jobId),
    jobTitle,
    currentClerkId,
    currentUserName,
    otherClerkId,
    otherUserName,
  });
}

export async function getConversationByIdForUser(conversationId, clerkId) {
  try {
    const result = await sql`
      SELECT
        id,
        conversation_type,
        job_id,
        job_title,
        participant_one_clerk_id,
        participant_one_name,
        participant_two_clerk_id,
        participant_two_name,
        last_message_text,
        last_message_at,
        created_at,
        updated_at
      FROM messaging_conversations
      WHERE id = ${conversationId}
        AND (
          participant_one_clerk_id = ${clerkId}
          OR participant_two_clerk_id = ${clerkId}
        )
      LIMIT 1;
    `;

    if (result.length === 0) return null;
    return mapConversation(result[0], clerkId);
  } catch (error) {
    logger.error(`getConversationByIdForUser error for ${conversationId}:`, error);
    throw new Error("Failed to load conversation");
  }
}

export async function listConversationsForUser(clerkId, opts = {}) {
  const limit = clampLimit(opts.limit);

  try {
    const result = await sql`
      SELECT
        id,
        conversation_type,
        job_id,
        job_title,
        participant_one_clerk_id,
        participant_one_name,
        participant_two_clerk_id,
        participant_two_name,
        last_message_text,
        last_message_at,
        created_at,
        updated_at
      FROM messaging_conversations
      WHERE
        participant_one_clerk_id = ${clerkId}
        OR participant_two_clerk_id = ${clerkId}
      ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC
      LIMIT ${limit};
    `;

    return result.map((row) => mapConversation(row, clerkId));
  } catch (error) {
    logger.error(`listConversationsForUser error for ${clerkId}:`, error);
    throw new Error("Failed to list conversations");
  }
}

export async function listMessagesForConversation(conversationId, clerkId, opts = {}) {
  const conversation = await getConversationByIdForUser(conversationId, clerkId);

  if (!conversation) {
    return null;
  }

  const limit = clampLimit(opts.limit);
  const before = opts.before ? new Date(opts.before) : null;

  if (before && Number.isNaN(before.getTime())) {
    throw new Error("Invalid before cursor");
  }

  try {
    const rows = before
      ? await sql`
          SELECT
            id,
            conversation_id,
            sender_clerk_id,
            sender_name,
            text,
            client_message_id,
            created_at
          FROM messaging_messages
          WHERE conversation_id = ${conversationId}
            AND created_at < ${before.toISOString()}
          ORDER BY created_at DESC
          LIMIT ${limit};
        `
      : await sql`
          SELECT
            id,
            conversation_id,
            sender_clerk_id,
            sender_name,
            text,
            client_message_id,
            created_at
          FROM messaging_messages
          WHERE conversation_id = ${conversationId}
          ORDER BY created_at DESC
          LIMIT ${limit};
        `;

    return {
      conversation,
      messages: rows.map(mapMessage).reverse(),
    };
  } catch (error) {
    logger.error(`listMessagesForConversation error for ${conversationId}:`, error);
    throw new Error("Failed to load messages");
  }
}

function resolveSenderName(conversation, senderClerkId, fallbackName = null) {
  if (fallbackName?.trim()) {
    return fallbackName.trim();
  }

  const participant = conversation.participants.find(
    (entry) => entry.clerkId === senderClerkId
  );

  return participant?.displayName || senderClerkId;
}

export async function saveConversationMessage({
  conversationId,
  senderClerkId,
  senderName = null,
  text,
  clientMessageId = null,
}) {
  const trimmedText = typeof text === "string" ? text.trim() : "";

  if (!trimmedText) {
    throw new Error("Message text is required");
  }

  if (trimmedText.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message text must be at most ${MAX_MESSAGE_LENGTH} characters`);
  }

  const conversation = await getConversationByIdForUser(
    conversationId,
    senderClerkId
  );

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  try {
    const resolvedSenderName = resolveSenderName(
      conversation,
      senderClerkId,
      senderName
    );

    const inserted = await sql`
      INSERT INTO messaging_messages (
        id,
        conversation_id,
        sender_clerk_id,
        sender_name,
        text,
        client_message_id,
        created_at
      )
      VALUES (
        ${randomUUID()},
        ${conversationId},
        ${senderClerkId},
        ${resolvedSenderName},
        ${trimmedText},
        ${clientMessageId || null},
        NOW()
      )
      ON CONFLICT (conversation_id, client_message_id)
      DO NOTHING
      RETURNING
        id,
        conversation_id,
        sender_clerk_id,
        sender_name,
        text,
        client_message_id,
        created_at;
    `;

    let duplicate = false;
    let messageRow = inserted[0] || null;

    if (!messageRow && clientMessageId) {
      duplicate = true;
      const existing = await sql`
        SELECT
          id,
          conversation_id,
          sender_clerk_id,
          sender_name,
          text,
          client_message_id,
          created_at
        FROM messaging_messages
        WHERE conversation_id = ${conversationId}
          AND client_message_id = ${clientMessageId}
        LIMIT 1;
      `;

      if (existing.length === 0) {
        throw new Error("Failed to save message");
      }

      messageRow = existing[0];
    }

    if (!messageRow) {
      throw new Error("Failed to save message");
    }

    const message = mapMessage(messageRow);

    if (!duplicate) {
      await sql`
        UPDATE messaging_conversations
        SET
          last_message_text = ${message.text},
          last_message_at = ${message.createdAt},
          updated_at = ${message.createdAt},
          participant_one_name = CASE
            WHEN participant_one_clerk_id = ${senderClerkId}
            THEN COALESCE(${resolvedSenderName}, participant_one_name)
            ELSE participant_one_name
          END,
          participant_two_name = CASE
            WHEN participant_two_clerk_id = ${senderClerkId}
            THEN COALESCE(${resolvedSenderName}, participant_two_name)
            ELSE participant_two_name
          END
        WHERE id = ${conversationId};
      `;
    }

    return {
      conversation: duplicate
        ? conversation
        : withUpdatedConversation(conversation, senderClerkId, resolvedSenderName, message),
      message,
      duplicate,
    };
  } catch (error) {
    logger.error(`saveConversationMessage error for ${conversationId}:`, error);
    throw new Error("Failed to save message");
  }
}

export function getOtherParticipant(conversation, clerkId) {
  return (
    conversation.participants.find((participant) => participant.clerkId !== clerkId) ||
    null
  );
}
