/**
 * Keeps jobs whose service type or selected services name one of the given
 * services (case-insensitive). A specialist's profession is a set of services,
 * so a repairs specialist gets every repairs job, not only the jobs that
 * match one of their individual skills.
 */
export function filterJobsByServices(jobs, services) {
  const wanted = new Set(
    (services || []).map((service) => String(service).trim().toLowerCase()).filter(Boolean)
  );
  if (wanted.size === 0) return jobs;
  return jobs.filter((job) =>
    [job.serviceType, ...(job.selectedServices || [])].some(
      (service) => typeof service === "string" && wanted.has(service.trim().toLowerCase())
    )
  );
}
