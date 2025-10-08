# Jobs API - Search & Filter Examples

## Available Endpoints

### 1. GET `/api/jobs` - Get all jobs
Returns all service requests without filtering.

### 2. POST `/api/jobs` - Create a new job
Create a new service request.

### 3. GET `/api/jobs/search` - Search and filter jobs
Search jobs with various filters and pagination.

## Search Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `serviceType` | string | Filter by service type (partial match) | `Plumbing` |
| `selectedService` | string | Filter jobs containing specific service | `Pipe Repair` |
| `startDate` | string | Jobs starting on or after date | `2025-10-10` |
| `endDate` | string | Jobs ending on or before date | `2025-12-31` |
| `maxPrice` | number | Maximum price filter | `200` |
| `specialistChoice` | string | Filter by specialist (exact match) | `John Doe` |
| `additionalInfo` | string | Search in additional info (partial match) | `urgent` |
| `limit` | number | Results per page (1-100) | `20` |
| `offset` | number | Skip results for pagination | `40` |
| `sortBy` | string | Sort field (`startDate`, `endDate`, `maxPrice`, `serviceType`, `id`) | `startDate` |
| `sortOrder` | string | Sort direction (`ASC`, `DESC`) | `DESC` |

## Example API Calls

### Basic Search Examples

```bash
# 1. Find all Plumbing jobs
GET /api/jobs/search?serviceType=Plumbing

# 2. Find jobs that include "Pipe Repair" service
GET /api/jobs/search?selectedService=Pipe%20Repair

# 3. Find jobs with max budget of $200 or less
GET /api/jobs/search?maxPrice=200

# 4. Find jobs starting after Oct 10, 2025
GET /api/jobs/search?startDate=2025-10-10

# 5. Find urgent jobs
GET /api/jobs/search?additionalInfo=urgent
```

### Combined Filter Examples

```bash
# 6. Complex search: Plumbing jobs with Pipe Repair, budget ≤ $300
GET /api/jobs/search?serviceType=Plumbing&selectedService=Pipe%20Repair&maxPrice=300

# 7. Jobs in date range with specific specialist
GET /api/jobs/search?startDate=2025-10-01&endDate=2025-12-31&specialistChoice=John%20Doe

# 8. Urgent electrical jobs sorted by price
GET /api/jobs/search?serviceType=Electrical&additionalInfo=urgent&sortBy=maxPrice&sortOrder=ASC
```

### Pagination Examples

```bash
# 9. First page (20 results)
GET /api/jobs/search?limit=20&offset=0

# 10. Second page (next 20 results)
GET /api/jobs/search?limit=20&offset=20

# 11. Find all plumbing jobs, paginated
GET /api/jobs/search?serviceType=Plumbing&limit=10&offset=0
```

## Response Format

### Successful Search Response
```json
{
  "success": true,
  "message": "Job search completed successfully",
  "data": [
    {
      "id": 1,
      "serviceType": "Plumbing", 
      "selectedServices": ["Leak Repair", "Pipe Installation"],
      "startDate": "2025-10-10",
      "endDate": "2025-10-12", 
      "maxPrice": 150,
      "specialistChoice": "John Doe",
      "additionalInfo": "Urgent kitchen leak",
      "documents": ["invoice.pdf"]
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "filters": {
    "serviceType": "Plumbing",
    "limit": 20,
    "offset": 0,
    "sortBy": "startDate",
    "sortOrder": "DESC"
  }
}
```

### Error Response Examples
```json
{
  "success": false,
  "message": "Limit must be between 1 and 100"
}
```

## HTTPie Test Commands

```bash
# Install HTTPie first: pip install httpie

# Test basic search
http GET http://localhost:3000/api/jobs/search serviceType==Plumbing

# Test with multiple filters
http GET http://localhost:3000/api/jobs/search \
  serviceType==Plumbing \
  selectedService=="Pipe Repair" \
  maxPrice==200

# Test pagination
http GET http://localhost:3000/api/jobs/search \
  limit==10 \
  offset==0 \
  sortBy==maxPrice \
  sortOrder==ASC

# Test date filtering
http GET http://localhost:3000/api/jobs/search \
  startDate==2025-10-10 \
  endDate==2025-12-31
```

## cURL Test Commands

```bash
# Basic search
curl "http://localhost:3000/api/jobs/search?serviceType=Plumbing"

# Complex search with URL encoding
curl "http://localhost:3000/api/jobs/search?serviceType=Plumbing&selectedService=Pipe%20Repair&maxPrice=200"

# Pagination
curl "http://localhost:3000/api/jobs/search?limit=10&offset=20&sortBy=maxPrice&sortOrder=ASC"
```

## Features Implemented

- ✅ **Dynamic Filtering**: Support for any combination of filters
- ✅ **Case-Insensitive Search**: String fields use ILIKE for flexible matching  
- ✅ **JSON Array Search**: Uses PostgreSQL `?` operator for selectedServices
- ✅ **Date Range Filtering**: Greater than/less than date comparisons
- ✅ **Price Filtering**: Numeric comparison for budget constraints
- ✅ **Pagination**: Limit/offset with total count and hasMore indicator
- ✅ **Sorting**: Multiple sort fields with ASC/DESC options
- ✅ **Input Validation**: Parameter validation with helpful error messages
- ✅ **Structured Logging**: Comprehensive logging for debugging
- ✅ **SQL Injection Protection**: Parameterized queries via Neon client
- ✅ **Consistent API**: Same response format as other endpoints