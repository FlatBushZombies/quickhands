# Database Field Mapping

## Actual Neon Database Schema (snake_case)

The following are the actual field names as they appear in your Neon PostgreSQL database:

```sql
service_request table fields:
- id (SERIAL PRIMARY KEY)
- service_type (TEXT)
- selected_services (JSON/JSONB)
- start_date (DATE)
- end_date (DATE)  
- max_price (NUMERIC)
- specialist_choice (TEXT)
- additional_info (TEXT)
- documents (JSON/JSONB)
```

## API Response Format (camelCase)

The API automatically transforms database fields to camelCase for consistent frontend usage:

```json
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
```

## Field Mapping

| Database Field (snake_case) | API Response (camelCase) | API Parameter |
|------------------------------|--------------------------|---------------|
| `service_type` | `serviceType` | `serviceType` |
| `selected_services` | `selectedServices` | `selectedService` (for filtering) |
| `start_date` | `startDate` | `startDate` |
| `end_date` | `endDate` | `endDate` |
| `max_price` | `maxPrice` | `maxPrice` |
| `specialist_choice` | `specialistChoice` | `specialistChoice` |
| `additional_info` | `additionalInfo` | `additionalInfo` |
| `documents` | `documents` | N/A |

## Sort Field Mapping

When using the `sortBy` parameter, you can use camelCase field names which are automatically converted:

| API Parameter | Database Field |
|---------------|----------------|
| `sortBy=startDate` | `start_date` |
| `sortBy=endDate` | `end_date` |
| `sortBy=maxPrice` | `max_price` |
| `sortBy=serviceType` | `service_type` |
| `sortBy=id` | `id` |

## Implementation Details

1. **Database Queries**: Use snake_case field names to match your Neon schema
2. **API Input**: Accept camelCase parameters for consistency
3. **API Output**: Transform to camelCase for frontend consumption
4. **Sort Fields**: Automatic mapping from camelCase to snake_case

This ensures the API maintains a consistent camelCase interface while properly querying your snake_case database schema.