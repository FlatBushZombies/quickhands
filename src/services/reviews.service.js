import { randomUUID } from "node:crypto";
import {
  buildReviewSummaryFromMetadata,
  getReviewSummaryByClerkId,
  getUserMetadataByClerkId,
  patchUserMetadataByClerkId,
  upsertUser,
} from "#services/user.service.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Rating is required");
  }

  if (parsed < 1 || parsed > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  return Math.round(parsed);
}

function normalizeReviewRecord(value) {
  const review = value && typeof value === "object" ? value : {};
  return {
    id: asTrimmedString(review.id) || randomUUID(),
    applicationId: Number(review.applicationId) || 0,
    reviewerClerkId: asTrimmedString(review.reviewerClerkId),
    reviewerName: asTrimmedString(review.reviewerName) || "User",
    subjectClerkId: asTrimmedString(review.subjectClerkId),
    subjectName: asTrimmedString(review.subjectName) || "User",
    subjectRole: asTrimmedString(review.subjectRole) || "user",
    rating: normalizeRating(review.rating ?? 0),
    comment: asTrimmedString(review.comment) || "",
    createdAt: review.createdAt || new Date().toISOString(),
  };
}

function upsertReviewIntoCollection(collection, nextReview, predicate) {
  const filtered = asArray(collection).filter((entry) => !predicate(entry));
  return [nextReview, ...filtered].slice(0, 50);
}

export async function listReceivedReviews(clerkId) {
  const metadata = await getUserMetadataByClerkId(clerkId);
  const reviews = asArray(metadata.receivedReviews)
    .map((entry) => normalizeReviewRecord(entry))
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );

  return {
    reviews,
    summary: buildReviewSummaryFromMetadata({
      receivedReviews: reviews,
    }),
  };
}

export async function getApplicationReviewMatrix({
  applicationId,
  clientClerkId,
  freelancerClerkId,
}) {
  const [clientMetadata, freelancerMetadata] = await Promise.all([
    getUserMetadataByClerkId(clientClerkId),
    getUserMetadataByClerkId(freelancerClerkId),
  ]);

  const clientToFreelancer = asArray(freelancerMetadata.receivedReviews)
    .map((entry) => normalizeReviewRecord(entry))
    .find(
      (entry) =>
        entry.applicationId === Number(applicationId) &&
        entry.reviewerClerkId === clientClerkId
    ) || null;

  const freelancerToClient = asArray(clientMetadata.receivedReviews)
    .map((entry) => normalizeReviewRecord(entry))
    .find(
      (entry) =>
        entry.applicationId === Number(applicationId) &&
        entry.reviewerClerkId === freelancerClerkId
    ) || null;

  return {
    clientToFreelancer,
    freelancerToClient,
    clientSummary: await getReviewSummaryByClerkId(clientClerkId),
    freelancerSummary: await getReviewSummaryByClerkId(freelancerClerkId),
  };
}

export async function upsertApplicationReview({
  applicationId,
  reviewerClerkId,
  reviewerName,
  subjectClerkId,
  subjectName,
  subjectRole,
  rating,
  comment,
}) {
  const normalizedApplicationId = Number(applicationId);
  const nextReview = normalizeReviewRecord({
    id: `${normalizedApplicationId}:${reviewerClerkId}:${subjectClerkId}`,
    applicationId: normalizedApplicationId,
    reviewerClerkId,
    reviewerName,
    subjectClerkId,
    subjectName,
    subjectRole,
    rating,
    comment,
    createdAt: new Date().toISOString(),
  });

  await Promise.all([
    upsertUser({ clerkId: reviewerClerkId, name: reviewerName }),
    upsertUser({ clerkId: subjectClerkId, name: subjectName }),
  ]);

  await patchUserMetadataByClerkId(subjectClerkId, (metadata) => ({
    ...metadata,
    receivedReviews: upsertReviewIntoCollection(
      metadata.receivedReviews,
      nextReview,
      (entry) =>
        Number(entry?.applicationId) === normalizedApplicationId &&
        entry?.reviewerClerkId === reviewerClerkId
    ),
  }));

  await patchUserMetadataByClerkId(reviewerClerkId, (metadata) => ({
    ...metadata,
    writtenReviews: upsertReviewIntoCollection(
      metadata.writtenReviews,
      nextReview,
      (entry) =>
        Number(entry?.applicationId) === normalizedApplicationId &&
        entry?.subjectClerkId === subjectClerkId
    ),
  }));

  return {
    review: nextReview,
    summary: await getReviewSummaryByClerkId(subjectClerkId),
  };
}
