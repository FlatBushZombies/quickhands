const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseQuotedAmount(quotation) {
  const text = asTrimmedString(quotation);
  if (!text) return null;

  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function hoursBetween(later, earlier) {
  if (!later || !earlier) return null;

  const laterDate = new Date(later);
  const earlierDate = new Date(earlier);

  if (Number.isNaN(laterDate.getTime()) || Number.isNaN(earlierDate.getTime())) {
    return null;
  }

  return Number(((laterDate.getTime() - earlierDate.getTime()) / 36e5).toFixed(2));
}

function maskPhoneNumber(phoneNumber) {
  const value = asTrimmedString(phoneNumber);
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) {
    return value;
  }

  const suffix = digits.slice(-4);
  return `***${suffix}`;
}

function buildSpotlightSummary({ status, hasContactUnlocked, badges, budgetStatus }) {
  if (status === "accepted" && hasContactUnlocked) {
    return "Accepted and ready for direct follow-up";
  }

  if (status === "accepted") {
    return "Accepted and waiting for direct contact details";
  }

  if (badges.includes("Budget aligned") && badges.includes("Detailed proposal")) {
    return "Budget fit with clear delivery terms";
  }

  if (budgetStatus === "premium" && badges.includes("Detailed proposal")) {
    return "Premium quote backed by detailed scope notes";
  }

  if (badges.includes("Fast response") && badges.includes("Quote provided")) {
    return "Quick response with pricing attached";
  }

  if (badges.includes("Detailed proposal")) {
    return "Detailed proposal with concrete working terms";
  }

  if (badges.includes("Budget aligned")) {
    return "Budget-aligned quote ready for review";
  }

  if (badges.includes("Fast response")) {
    return "Quick early application";
  }

  return "Application received and ready for review";
}

function buildApplicationSpotlight(app) {
  const quotation = asTrimmedString(app.quotation);
  const conditions = asTrimmedString(app.conditions);
  const maxPrice = toFiniteNumber(app.job_max_price);
  const quotedAmount = parseQuotedAmount(quotation);
  const responseHours = hoursBetween(app.created_at, app.job_created_at);
  const badges = [];

  let score = 35;
  let budgetStatus = "unknown";

  if (quotation) {
    badges.push("Quote provided");
    score += 20;
  }

  if (conditions) {
    score += 15;
    if (conditions.length >= 40) {
      badges.push("Detailed proposal");
      score += 5;
    }
  }

  if (asTrimmedString(app.freelancer_email)) {
    badges.push("Contact ready");
    score += 10;
  }

  if (quotedAmount != null && maxPrice != null && maxPrice > 0) {
    if (quotedAmount <= maxPrice) {
      budgetStatus = "aligned";
      badges.push("Budget aligned");
      score += 15;
    } else {
      budgetStatus = "premium";
      badges.push("Premium quote");
      score += 5;
    }
  }

  if (responseHours != null) {
    if (responseHours <= 6) {
      badges.push("Fast response");
      score += 10;
    } else if (responseHours <= 24) {
      badges.push("Early applicant");
      score += 5;
    }
  }

  const hasContactUnlocked =
    app.status === "accepted" && Boolean(asTrimmedString(app.client_contact_phone));

  if (hasContactUnlocked) {
    badges.push("Contact unlocked");
    score += 5;
  }

  const completenessChecks = [
    asTrimmedString(app.freelancer_name),
    asTrimmedString(app.freelancer_email),
    quotation,
    conditions,
  ];

  const completeness = Number(
    (
      completenessChecks.filter(Boolean).length / completenessChecks.length
    ).toFixed(2)
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    badges: [...new Set(badges)].slice(0, 4),
    summary: buildSpotlightSummary({
      status: app.status,
      hasContactUnlocked,
      badges,
      budgetStatus,
    }),
    budgetStatus,
    quotedAmount,
    responseHours,
    completeness,
  };
}

function buildContactExchange(app, viewerRole = "freelancer") {
  const phoneNumber = asTrimmedString(app.client_contact_phone);
  const sharedAt = app.contact_shared_at || null;
  const hasAcceptedStatus = app.status === "accepted";
  const hasPhone = Boolean(phoneNumber);
  const canRevealPhone =
    viewerRole === "client" ||
    viewerRole === "admin" ||
    (viewerRole === "freelancer" && hasAcceptedStatus && hasPhone);

  let status = "locked";
  if (hasAcceptedStatus && hasPhone) {
    status = "shared";
  } else if (hasAcceptedStatus) {
    status = "awaiting_client_phone";
  }

  return {
    status,
    readyForDirectContact: status === "shared",
    needsClientPhoneNumber: status === "awaiting_client_phone",
    sharedAt,
    maskedPhoneNumber: hasPhone ? maskPhoneNumber(phoneNumber) : null,
    phoneNumber: canRevealPhone && hasPhone ? phoneNumber : null,
    contactName:
      hasPhone && canRevealPhone
        ? asTrimmedString(app.client_contact_name) ||
          asTrimmedString(app.job_client_name) ||
          "Client"
        : null,
    contactInstructions:
      canRevealPhone && hasPhone ? asTrimmedString(app.contact_release_notes) || null : null,
  };
}

export function normalizePhoneNumber(phoneNumber) {
  const raw = asTrimmedString(phoneNumber);
  if (!raw) {
    throw new Error("Phone number is required");
  }

  if ((raw.match(/\+/g) || []).length > 1 || (raw.includes("+") && !raw.startsWith("+"))) {
    throw new Error("Phone number format is invalid");
  }

  const normalized = raw.replace(/[^\d+]/g, "");
  const digits = normalized.replace(/\D/g, "");

  if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX) {
    throw new Error("Phone number must contain between 7 and 15 digits");
  }

  return normalized.startsWith("+") ? normalized : digits;
}

export function isMissingApplicationContactColumnError(error) {
  return (
    error?.message?.includes("column") &&
    (error.message.includes("client_contact_phone") ||
      error.message.includes("client_contact_name") ||
      error.message.includes("contact_release_notes") ||
      error.message.includes("contact_shared_at") ||
      error.message.includes("contact_shared_by_clerk_id"))
  );
}

export function transformApplication(app, options = {}) {
  const viewerRole = options.viewerRole || "freelancer";

  return {
    id: app.id,
    jobId: app.job_id,
    freelancerClerkId: app.freelancer_clerk_id,
    freelancerName: app.freelancer_name,
    freelancerEmail: app.freelancer_email,
    quotation: app.quotation ?? null,
    conditions: app.conditions ?? null,
    status: app.status,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
    applicationSpotlight: buildApplicationSpotlight(app),
    contactExchange: buildContactExchange(app, viewerRole),
  };
}
