import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { normalizeLocationPayload } from "#utils/location.js";

const LOCATION_COLUMNS = [
  "location_label",
  "location_city",
  "location_latitude",
  "location_longitude",
];

let serviceRequestColumnStatePromise = null;

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getServiceRequestColumnState() {
  if (!serviceRequestColumnStatePromise) {
    serviceRequestColumnStatePromise = sql.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'service_request'
          AND column_name = ANY($1);
      `,
      [LOCATION_COLUMNS]
    ).then((rows) => {
      const availableColumns = new Set(rows.map((row) => row.column_name));
      return {
        locationLabel: availableColumns.has("location_label"),
        locationCity: availableColumns.has("location_city"),
        locationLatitude: availableColumns.has("location_latitude"),
        locationLongitude: availableColumns.has("location_longitude"),
      };
    });
  }

  return serviceRequestColumnStatePromise;
}

function buildJobSelectColumns(columnState) {
  return [
    "id",
    "service_type",
    "selected_services",
    "start_date",
    "end_date",
    "max_price",
    "specialist_choice",
    "additional_info",
    "documents",
    "clerk_id",
    "user_name",
    "user_avatar",
    "created_at",
    columnState.locationLabel ? "location_label" : "NULL::varchar AS location_label",
    columnState.locationCity ? "location_city" : "NULL::varchar AS location_city",
    columnState.locationLatitude ? "location_latitude" : "NULL::numeric AS location_latitude",
    columnState.locationLongitude ? "location_longitude" : "NULL::numeric AS location_longitude",
  ].join(",\n        ");
}

function transformJob(job) {
  const location = normalizeLocationPayload({
    label: job.location_label,
    city: job.location_city,
    latitude: job.location_latitude,
    longitude: job.location_longitude,
  });
  const hasLocation =
    location.label ||
    location.city ||
    location.latitude !== null ||
    location.longitude !== null;

  return {
    id: job.id,
    serviceType: job.service_type,
    selectedServices: parseJsonArray(job.selected_services),
    startDate: job.start_date,
    endDate: job.end_date,
    maxPrice: Number(job.max_price) || 0,
    specialistChoice: job.specialist_choice,
    additionalInfo: job.additional_info,
    documents: parseJsonArray(job.documents),
    clerkId: job.clerk_id,
    userName: job.user_name,
    userAvatar: job.user_avatar,
    createdAt: job.created_at,
    updatedAt: job.updated_at || null,
    location: hasLocation ? location : null,
    proximity:
      job.distance_km !== undefined || job.in_your_area !== undefined
        ? {
            distanceKm: toNullableNumber(job.distance_km),
            inYourArea: job.in_your_area === true,
          }
        : null,
  };
}

async function queryJobs({ whereClauses = [], params = [], orderBy = "created_at DESC", limit, offset }) {
  const columnState = await getServiceRequestColumnState();
  const selectColumns = buildJobSelectColumns(columnState);
  const queryParams = [...params];
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  let paginationClause = "";

  if (limit !== undefined) {
    queryParams.push(limit);
    paginationClause += ` LIMIT $${queryParams.length}`;
  }

  if (offset !== undefined) {
    queryParams.push(offset);
    paginationClause += ` OFFSET $${queryParams.length}`;
  }

  return sql.query(
    `
      SELECT
        ${selectColumns}
      FROM service_request
      ${whereClause}
      ORDER BY ${orderBy}
      ${paginationClause};
    `,
    queryParams
  );
}

async function countJobs({ whereClauses = [], params = [] }) {
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const result = await sql.query(
    `
      SELECT COUNT(*) AS total
      FROM service_request
      ${whereClause};
    `,
    params
  );

  return Number.parseInt(result[0]?.total, 10) || 0;
}

export async function getJobById(jobId) {
  const id = Number(jobId);
  if (Number.isNaN(id)) throw new Error(`Invalid job ID: ${jobId}`);

  try {
    const result = await queryJobs({
      whereClauses: ["id = $1"],
      params: [id],
      limit: 1,
    });

    if (!result || result.length === 0) {
      return null;
    }

    return transformJob(result[0]);
  } catch (error) {
    logger.error(`Database error fetching job ID ${id}:`, error);
    throw error;
  }
}

export async function getAllJobs(clerkId = null) {
  try {
    const result = await queryJobs({
      whereClauses: clerkId ? ["clerk_id = $1"] : [],
      params: clerkId ? [clerkId] : [],
    });

    logger.info(`Fetched ${result.length} service requests successfully`);
    return result.map(transformJob);
  } catch (error) {
    logger.error("Database error (fetch all jobs):", error);
    throw new Error("Database query failed while retrieving service requests.");
  }
}

export async function createJob(jobData) {
  const {
    serviceType,
    selectedServices,
    startDate,
    endDate,
    maxPrice,
    specialistChoice,
    additionalInfo,
    documents,
    clerkId,
    userName,
    userAvatar,
    location,
  } = jobData;

  try {
    const columnState = await getServiceRequestColumnState();
    const normalizedLocation = normalizeLocationPayload(location || {});
    const columns = [
      "service_type",
      "selected_services",
      "start_date",
      "end_date",
      "max_price",
      "specialist_choice",
      "additional_info",
      "documents",
      "clerk_id",
      "user_name",
      "user_avatar",
    ];
    const values = [
      serviceType,
      selectedServices,
      startDate,
      endDate,
      maxPrice,
      specialistChoice,
      additionalInfo,
      documents,
      clerkId,
      userName,
      userAvatar,
    ];

    if (columnState.locationLabel) {
      columns.push("location_label");
      values.push(normalizedLocation.label);
    }
    if (columnState.locationCity) {
      columns.push("location_city");
      values.push(normalizedLocation.city);
    }
    if (columnState.locationLatitude) {
      columns.push("location_latitude");
      values.push(normalizedLocation.latitude);
    }
    if (columnState.locationLongitude) {
      columns.push("location_longitude");
      values.push(normalizedLocation.longitude);
    }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const returningColumns = buildJobSelectColumns(columnState);

    const result = await sql.query(
      `
        INSERT INTO service_request (
          ${columns.join(", ")}
        )
        VALUES (${placeholders})
        RETURNING
          ${returningColumns};
      `,
      values
    );

    logger.info("New service request created successfully");
    return transformJob(result[0]);
  } catch (error) {
    logger.error("Database error (insert):", error);
    throw new Error("Failed to create new service request in the database.");
  }
}

export async function searchJobs(filters) {
  try {
    const {
      serviceType,
      selectedService,
      maxPrice,
      limit = 50,
      offset = 0,
    } = filters;

    logger.info(`Executing search with filters: ${JSON.stringify(filters)}`);

    const whereClauses = [];
    const params = [];

    if (serviceType) {
      params.push(`%${serviceType}%`);
      whereClauses.push(`service_type ILIKE $${params.length}`);
    }

    if (maxPrice !== undefined) {
      params.push(maxPrice);
      whereClauses.push(`max_price <= $${params.length}`);
    }

    if (selectedService) {
      params.push(selectedService);
      whereClauses.push(`selected_services::jsonb ? $${params.length}`);
    }

    const [result, total] = await Promise.all([
      queryJobs({
        whereClauses,
        params,
        limit,
        offset,
      }),
      countJobs({
        whereClauses,
        params,
      }),
    ]);

    logger.info(`Search returned ${result.length} results out of ${total} total matches`);

    return {
      jobs: result.map(transformJob),
      pagination: {
        total,
        limit: Number.parseInt(limit, 10),
        offset: Number.parseInt(offset, 10),
        hasMore: Number.parseInt(offset, 10) + Number.parseInt(limit, 10) < total,
      },
    };
  } catch (error) {
    logger.error("Database error (search):", error);
    throw new Error("Database query failed while searching service requests.");
  }
}
