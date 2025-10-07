# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server with hot reload (uses --watch)
```

### Database Operations
```bash
npm run db:generate  # Generate Drizzle migrations from schema changes
npm run db:migrate   # Apply pending migrations to database
npm run db:studio    # Open Drizzle Studio for database inspection
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm run format       # Format code with Prettier
npm run format:check # Check formatting without making changes
```

## Architecture Overview

### Project Structure
This is a Node.js Express API using ES modules with a modular MVC architecture:

- **Entry Points**: `src/index.js` → `src/server.js` → `src/app.js`
- **Database**: Drizzle ORM with Neon PostgreSQL serverless
- **Authentication**: JWT-based with secure HTTP-only cookies
- **Validation**: Zod schema validation
- **Logging**: Winston logger with environment-aware configuration

### Import Path Aliases
The project uses Node.js subpath imports for clean module resolution:
- `#config/*` → `./src/config/*`
- `#controllers/*` → `./src/controllers/*` 
- `#middleware/*` → `./src/middleware/*`
- `#models/*` → `./src/models/*`
- `#routes/*` → `./src/routes/*`
- `#services/*` → `./src/services/*`
- `#utils/*` → `./src/utils/*`
- `#validations/*` → `./src/validations/*`

### Database Architecture
- **ORM**: Drizzle with Neon serverless PostgreSQL
- **Models**: Located in `src/models/`, currently contains `accounts` table
- **Migrations**: Generated and stored in `drizzle/` directory
- **Configuration**: `drizzle.config.js` points to models and migration output

### Authentication Flow
- Uses JWT tokens stored in HTTP-only cookies for security
- Password hashing with bcrypt (salt rounds: 10)
- User service handles registration with duplicate email checking
- Cookie configuration adapts to environment (secure in production)

### Request/Response Pattern
1. **Routes** (`src/routes/`) define endpoints and delegate to controllers
2. **Controllers** (`src/controllers/`) handle request validation and orchestration
3. **Services** (`src/services/`) contain business logic and database operations
4. **Validations** (`src/validations/`) use Zod schemas for input validation
5. **Utils** (`src/utils/`) provide reusable functionality (JWT, cookies, formatting)

### Error Handling
- Controllers catch errors and pass to Express error middleware
- Validation errors are formatted with custom utility
- Winston logger captures errors with stack traces
- Service layer throws semantic errors (e.g., "User already exists")

### Environment Configuration
- Uses dotenv for environment variables
- Logger adapts transports based on NODE_ENV and VERCEL_ENV
- Database URL configured via DATABASE_URL environment variable
- JWT secret configurable via JWT_SECRET (defaults provided for development)

## Development Notes

### Database Schema Changes
When modifying models in `src/models/`:
1. Update the schema definition
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply changes
4. Use `npm run db:studio` to verify changes

### Adding New Routes
Follow the established pattern:
1. Define route in `src/routes/` 
2. Import and use controller function
3. Create controller in `src/controllers/` that uses validation
4. Create service functions in `src/services/` for business logic
5. Add Zod validation schema in `src/validations/`

### Common Issues
- The `password` field is referenced in auth controller but missing from validation schema and user model
- Error message typo in format utility (`messsage` instead of `message`)  
- Cookie clear function has incorrect parameter (`value` instead of `name`)
- createUser service doesn't return the created user object as expected by controller