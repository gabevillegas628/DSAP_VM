# Instance Manager - Docker/Podman Implementation Guide

## Overview

The Instance Manager is a Node.js CLI tool that automates the creation and management of multiple isolated instances of the DNA Analysis application. Each instance runs independently with its own database, port, and configuration while sharing the same PostgreSQL and PgBouncer infrastructure.

## Table of Contents

1. [How Instance Creation Works](#how-instance-creation-works)
2. [Containerization Architecture](#containerization-architecture)
3. [Connection Pooling with PgBouncer](#connection-pooling-with-pgbouncer)
4. [Environment Variable Setup](#environment-variable-setup)
5. [Port Management](#port-management)
6. [Instance File Structure](#instance-file-structure)
7. [Common Operations](#common-operations)

---

## How Instance Creation Works

### The Creation Flow

When you create a new instance, the script executes these steps in sequence:

#### 1. **User Input Collection** (`createInstance()` - Line 93)

```
- Instance name (alphanumeric, hyphens, underscores only)
- Port selection (auto-assign or manual)
- Director account details (name, email, password)
```

**Port Selection:**
- **Auto-assign**: Finds the next available port starting from 5000
- **Manual**: Validates port (1024-65535), checks for conflicts with both system and other instances
- Multiple instances can share a port, but only one can run at a time

#### 2. **Database Creation** (`createDatabase()` - Line 795)

```bash
# Creates:
- Database: {instanceName}_db
- User: {instanceName}_user
- Password: Auto-generated 24-char random string
```

**What happens:**
```javascript
podman exec postgres createdb -U postgres {instanceName}_db
podman exec postgres psql -U postgres -c "CREATE USER {user} WITH ENCRYPTED PASSWORD '{password}'"
podman exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE {db} TO {user}"
podman exec postgres psql -U postgres -c "ALTER DATABASE {db} OWNER TO {user}"
```

**Configuration saved** (`db-config.json`):
```json
{
  "name": "instance_db",
  "user": "instance_user",
  "password": "randomly_generated_password",
  "host": "127.0.0.1",
  "port": 16432,          // PgBouncer port (pooled)
  "directPort": 15432,    // Direct PostgreSQL (for migrations)
  "url": "postgresql://user:pass@127.0.0.1:16432/db?pgbouncer=true",
  "directUrl": "postgresql://user:pass@127.0.0.1:15432/db"
}
```

#### 3. **File Setup** (`setupInstanceFiles()` - Line 853)

**Directory structure created:**
```
instances/{instanceName}/
├── server/              # Backend code (copied from base)
│   ├── .env            # Environment variables
│   ├── index.js        # Entry point
│   ├── uploads/        # User-uploaded files
│   │   └── profile-pics/
│   └── ...
├── client/             # Frontend code (copied from base)
│   └── ...
├── config.json         # Instance metadata
└── db-config.json      # Database credentials
```

**Initial `.env` file** (uses DIRECT_URL for setup):
```bash
DATABASE_URL="postgresql://user:pass@127.0.0.1:15432/db"  # Direct connection for setup
DIRECT_URL="postgresql://user:pass@127.0.0.1:15432/db"
PORT=5000
NODE_ENV=production
HOST=0.0.0.0
# Email and other configs copied from base server/.env
INSTANCE_NAME=instanceName
```

#### 4. **Dependency Installation** (`installDependencies()` - Line 930)

```bash
cd instances/{instanceName}/server && npm install
cd instances/{instanceName}/client && npm install
```

#### 5. **Database Schema Setup** (`runMigrations()` - Line 946)

```bash
cd server/
npx prisma generate        # Generate Prisma client
npx prisma db push --accept-data-loss  # Apply schema to database
```

**Uses:** Direct PostgreSQL connection (port 15432) because Prisma needs transaction support

#### 6. **Director Account Creation** (`createDirectorAccount()` - Line 983)

- Hashes password with bcrypt (10 rounds)
- Creates director user directly in the database via Prisma
- Sets role: 'director', status: 'approved'

#### 7. **Switch to PgBouncer** (`switchToPgBouncer()` - Line 610)

**Updates `.env` file** to use pooled connection:
```bash
DATABASE_URL="postgresql://user:pass@127.0.0.1:16432/db?pgbouncer=true"  # NOW using PgBouncer
DIRECT_URL="postgresql://user:pass@127.0.0.1:15432/db"  # Keep direct for migrations
PORT=5000
NODE_ENV=production
HOST=0.0.0.0
INSTANCE_NAME=instanceName
```

**Why switch?**
- Setup/migrations need direct connection (transactions)
- Runtime should use pooled connection (better performance)

#### 8. **Frontend Build** (`buildFrontend()` - Line 1036)

```bash
cd client/
npm run build  # Creates production build
```

#### 9. **PM2 Startup** (`startInstance()` - Line 1049)

```bash
pm2 delete {instanceName}  # Remove if exists (to reload env)
pm2 start index.js --name {instanceName} --cwd {serverDir} --time
pm2 save  # Persist across reboots
```

**Health verification:**
- Checks PM2 status is 'online'
- Attempts TCP connection to port (10 attempts)
- Returns success/failure with reason

---

## Containerization Architecture

### Infrastructure Containers

The system uses **Podman** (Docker-compatible) to run two critical infrastructure containers:

#### 1. PostgreSQL Container

**Container name:** `postgres`

**Exposed port:** `15432` → Container's `5432`

**Purpose:**
- Hosts all instance databases
- Single PostgreSQL server, multiple databases
- Each instance gets its own database with dedicated user

**Access:**
```bash
# From host
podman exec postgres psql -U postgres -d {database_name}

# From application (direct connection)
postgresql://user:pass@127.0.0.1:15432/database
```

#### 2. PgBouncer Container

**Container name:** `pgbouncer`

**Image:** `edoburu/pgbouncer` (supports wildcard database config)

**Exposed port:** `16432` → Container's `5432`

**Purpose:**
- Connection pooling for all databases
- Reduces connection overhead
- Improves performance under load

**Configuration:**
- Uses `DATABASE_URL` environment variable with wildcard support
- Automatically routes to any database in the PostgreSQL container
- No per-database registration required

**Access:**
```bash
# From application (pooled connection)
postgresql://user:pass@127.0.0.1:16432/database?pgbouncer=true
```

### Container Management Commands

**Check status:**
```bash
podman ps --filter name=postgres --filter name=pgbouncer
```

**Start infrastructure:**
```bash
podman start postgres  # Start database first
# Wait 5 seconds for PostgreSQL to initialize
podman start pgbouncer  # Then start connection pooler
```

**Stop infrastructure:**
```bash
podman stop pgbouncer postgres  # Stop in reverse order
```

**View logs:**
```bash
podman logs postgres --tail 50
podman logs pgbouncer --tail 50
```

### Why Containerization?

1. **Isolation**: Database runs independently of host system
2. **Portability**: Easy to move to different servers
3. **Consistency**: Same PostgreSQL version everywhere
4. **No host pollution**: No need to install PostgreSQL system-wide
5. **Easy cleanup**: Remove containers to completely clean up

---

## Connection Pooling with PgBouncer

### What is Connection Pooling?

Each database connection has overhead (memory, TCP socket, authentication). Connection pooling maintains a pool of ready-to-use connections that are shared among requests.

### How It Works in This Setup

```
Application Instance → PgBouncer (127.0.0.1:16432) → PostgreSQL (container)
     [Port 5000]         [Connection Pool]              [15432]
```

### Two Connection Modes

| Purpose | Port | URL | When Used |
|---------|------|-----|-----------|
| **Pooled (Runtime)** | 16432 | `postgresql://user:pass@127.0.0.1:16432/db?pgbouncer=true` | Normal app operation |
| **Direct (Setup)** | 15432 | `postgresql://user:pass@127.0.0.1:15432/db` | Migrations, schema changes |

### Why Two Modes?

**PgBouncer limitations:**
- Transaction pooling mode doesn't support some features
- Prisma migrations need full transaction support
- Schema operations need direct connection

**Solution:**
- `DATABASE_URL`: Points to PgBouncer (runtime)
- `DIRECT_URL`: Points directly to PostgreSQL (migrations)

### The Switch Process

1. **During setup** (`setupInstanceFiles()`):
   ```bash
   DATABASE_URL="postgresql://...@127.0.0.1:15432/db"  # Direct
   DIRECT_URL="postgresql://...@127.0.0.1:15432/db"    # Direct
   ```

2. **Run migrations:**
   ```bash
   npx prisma generate
   npx prisma db push  # Uses DATABASE_URL (currently direct)
   ```

3. **After setup** (`switchToPgBouncer()`):
   ```bash
   DATABASE_URL="postgresql://...@127.0.0.1:16432/db?pgbouncer=true"  # Pooled!
   DIRECT_URL="postgresql://...@127.0.0.1:15432/db"                   # Still direct
   ```

4. **Future migrations:**
   ```bash
   # Prisma automatically uses DIRECT_URL when it detects ?pgbouncer=true
   ```

### PgBouncer Configuration

The `edoburu/pgbouncer` image uses environment-based configuration:

```bash
DATABASE_URL=postgres://postgres:password@postgres:5432/*
# The asterisk (*) allows connection to ANY database
```

**Benefits:**
- No manual database registration
- Auto-discovery of new instance databases
- Single configuration for all instances

---

## Environment Variable Setup

### Base Server Configuration

The instance manager copies configuration from the base `server/.env` file:

**Copied variables:**
```bash
EMAIL_USER=
EMAIL_PASSWORD=
SENDGRID_API_KEY=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=
S3_BUCKET_NAME=
JWT_SECRET=
```

### Instance-Specific Variables

**Always set per instance:**
```bash
DATABASE_URL=        # Pooled connection URL
DIRECT_URL=          # Direct connection URL
PORT=                # Unique port for this instance
NODE_ENV=production  # Production mode
HOST=0.0.0.0        # Listen on all interfaces
INSTANCE_NAME=       # Instance identifier
```

### Environment File Locations

```
base/
└── server/.env          # Template configuration (shared secrets)

instances/
└── {instanceName}/
    └── server/.env      # Instance-specific configuration
```

### Configuration Method

**Code location:** `getEmailConfig()` - Line 905

```javascript
// Reads base server/.env
// Extracts configuration lines matching specific patterns
// Returns them as a multi-line string
// Included in setupInstanceFiles() for new instances
```

### Runtime vs Setup Configuration

#### Setup Phase (Lines 872-880)
```javascript
const serverEnv = `
DATABASE_URL="${dbConfig.directUrl}"      // Direct PostgreSQL
DIRECT_URL="${dbConfig.directUrl}"        // Direct PostgreSQL
PORT=${port}
NODE_ENV=production
HOST=0.0.0.0
${this.getEmailConfig()}
INSTANCE_NAME=${instanceName}
`.trim();
```

#### Runtime Phase (Lines 619-627)
```javascript
const serverEnv = `
DATABASE_URL="${dbConfig.url}"            // PgBouncer pooled
DIRECT_URL="${dbConfig.directUrl}"        // Direct PostgreSQL
PORT=${port}
NODE_ENV=production
HOST=0.0.0.0
${this.getEmailConfig()}
INSTANCE_NAME=${instanceName}
`.trim();
```

**Key difference:** `DATABASE_URL` switches from direct to pooled after migrations complete.

---

## Port Management

### Port Assignment Strategy

**Base port:** 5000 (configurable via `this.basePort`)

**Auto-assignment algorithm** (`findAvailablePort()` - Line 560):
1. Start at base port (5000)
2. Check if any existing instance uses this port
3. Check if port is available on the system
4. If taken, increment and retry
5. Return first available port

### Port Conflict Handling

**Scenario 1: System-level conflict**
```
User selects port 8080
Port is in use by another process
→ Warning shown, user can continue anyway
```

**Scenario 2: Instance-level conflict**
```
User selects port 5000
Another instance already configured for port 5000
→ Shows which instance(s) use that port
→ Explains only one can run at a time
→ User can continue (port sharing)
```

**Scenario 3: Runtime conflict** (`startInstance()` - Line 1059)
```
Starting instance A on port 5000
Instance B already running on port 5000
→ Asks user to stop instance B
→ If approved, stops B and starts A
→ If declined, startup cancelled
```

### Port Validation

**Valid range:** 1024-65535
- Ports below 1024 require root privileges (avoided)
- Ports above 65535 don't exist

### Port Sharing

Multiple instances **can** be configured for the same port, but only one can run at a time. This is useful for:
- Development/staging/production instances on same port
- Swapping instances without changing URLs
- A/B testing configurations

---

## Instance File Structure

### Complete Directory Layout

```
DSAP_VM/
├── Scripts/
│   └── Instance_manager_Docker.js
├── server/                        # BASE SERVER CODE
│   ├── .env                      # Template configuration
│   ├── index.js
│   ├── prisma/
│   └── ...
├── client/                        # BASE CLIENT CODE
│   ├── package.json
│   └── ...
└── instances/                     # INSTANCE DIRECTORY
    └── {instanceName}/
        ├── config.json            # Instance metadata
        ├── db-config.json         # Database credentials
        ├── server/                # Instance server (copy)
        │   ├── .env              # Instance environment
        │   ├── index.js
        │   ├── uploads/          # User uploads
        │   │   └── profile-pics/
        │   ├── node_modules/
        │   └── ...
        └── client/               # Instance client (copy)
            ├── build/            # Production build
            ├── node_modules/
            └── ...
```

### Configuration Files

#### `config.json` - Instance Metadata
```json
{
  "name": "myInstance",
  "port": 5000,
  "database": {
    "name": "myinstance_db",
    "user": "myinstance_user",
    "password": "...",
    "host": "127.0.0.1",
    "port": 16432,
    "directPort": 15432,
    "url": "postgresql://...:16432/...?pgbouncer=true",
    "directUrl": "postgresql://...:15432/..."
  },
  "paths": {
    "instance": "/full/path/to/instances/myInstance",
    "server": "/full/path/to/instances/myInstance/server",
    "client": "/full/path/to/instances/myInstance/client",
    "uploads": "/full/path/to/instances/myInstance/server/uploads"
  },
  "created": "2025-01-17T10:30:00.000Z"
}
```

#### `db-config.json` - Database Only
```json
{
  "name": "myinstance_db",
  "user": "myinstance_user",
  "password": "randomly_generated_password",
  "host": "127.0.0.1",
  "port": 16432,
  "directPort": 15432,
  "url": "postgresql://myinstance_user:password@127.0.0.1:16432/myinstance_db?pgbouncer=true",
  "directUrl": "postgresql://myinstance_user:password@127.0.0.1:15432/myinstance_db"
}
```

---

## Common Operations

### Creating a New Instance

```bash
node Instance_manager_Docker.js
# Choose option 1: Create new instance
# Follow prompts for name, port, director account
```

### Starting/Stopping Instances

```bash
# Via script
node Instance_manager_Docker.js
# Choose option 5: Start/Stop Instances

# Via PM2 directly
pm2 start myInstance
pm2 stop myInstance
pm2 restart myInstance
pm2 delete myInstance  # Remove from PM2 (doesn't delete files)
```

### Rebuilding an Instance

**When to rebuild:**
- Updated base code (server or client)
- Fixed bugs
- Added new features
- Changed Prisma schema

**What it preserves:**
- Database and all data
- User uploads
- Configuration (port, credentials)

**What it updates:**
- Server code
- Client code
- Dependencies
- Optionally: database schema

```bash
node Instance_manager_Docker.js
# Choose option 2: Manage existing instances
# Choose 'b': Rebuild instance
```

**Rebuild process:**
1. Stops instance
2. Creates rollback backup
3. Backs up uploads directory
4. Backs up .env file
5. Removes old code
6. Copies fresh code from base
7. Restores .env and uploads
8. Reinstalls dependencies
9. Optionally runs schema migrations
10. Rebuilds frontend
11. Starts instance
12. Verifies health

**On failure:** Automatically rolls back to previous state

### Deleting an Instance

```bash
node Instance_manager_Docker.js
# Choose option 2: Manage existing instances
# Choose 'd': Delete instance
# Type "DELETE" to confirm
```

**Deletion process:**
1. Stops PM2 process
2. Terminates database connections
3. Drops database
4. Drops database user
5. Removes all files

### Managing Infrastructure

```bash
node Instance_manager_Docker.js
# Choose option 6: Manage Infrastructure

# Options:
# 1. Start infrastructure (postgres + pgbouncer)
# 2. Stop infrastructure
# 3. Restart infrastructure
# 4. Check status
# 5. View logs
```

### Viewing Logs

```bash
# Via script (many options)
node Instance_manager_Docker.js
# Choose option 4: View logs

# Via PM2 directly
pm2 logs myInstance           # Live tail
pm2 logs myInstance --lines 100  # Last 100 lines
pm2 logs myInstance --err     # Errors only
```

### Port Changes

```bash
node Instance_manager_Docker.js
# Choose option 5: Start/Stop Instances
# Choose option 3: Resurrect with port change
# Select instance and enter new port
```

**What it updates:**
- `config.json` port value
- `.env` PORT variable
- Restarts instance on new port

---

## Technical Details

### Process Management

**PM2 features used:**
- `--name`: Identifier for the instance
- `--cwd`: Working directory (server folder)
- `--time`: Add timestamps to logs
- Auto-restart on crash
- `pm2 save`: Persist configuration across reboots

### Health Verification

**Method:** `verifyInstanceHealth()` - Line 1152

**Checks performed:**
1. PM2 reports status as 'online'
2. TCP connection succeeds to port
3. Up to 10 retry attempts with 1s delay
4. Returns { healthy: boolean, reason: string }

### Password Generation

**Method:** `generatePassword()` - Line 2018

```javascript
Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
// Produces: 24-character alphanumeric string
```

### Instance Status

**Possible statuses:**
- `online`: Running normally
- `stopped`: Intentionally stopped
- `errored`: Crashed or failed
- `not in PM2`: Never started or deleted from PM2
- `unknown`: PM2 query failed

### Database User Permissions

Each instance database user receives:
```sql
GRANT ALL PRIVILEGES ON DATABASE {db} TO {user};
ALTER DATABASE {db} OWNER TO {user};
```

Full ownership allows:
- Creating/dropping tables
- Managing schema
- All CRUD operations

---

## Troubleshooting

### Instance Won't Start

**Check infrastructure:**
```bash
podman ps
# Ensure postgres and pgbouncer are running
```

**Check logs:**
```bash
pm2 logs myInstance --err
```

**Common issues:**
- Database connection failed (check credentials in .env)
- Port already in use (use different port)
- Missing dependencies (rebuild instance)

### Database Connection Issues

**Test direct connection:**
```bash
podman exec postgres psql -U myinstance_user -d myinstance_db
```

**Test PgBouncer:**
```bash
psql "postgresql://myinstance_user:password@127.0.0.1:16432/myinstance_db"
```

### Port Conflicts

**Find what's using a port:**
```bash
# Linux
netstat -tulpn | grep :5000

# Windows
netstat -ano | findstr :5000
```

### Failed Instance Creation

The script offers automatic cleanup on failure. If cleanup wasn't run:

```bash
# Manual cleanup
pm2 delete myInstance
podman exec postgres dropdb -U postgres myinstance_db
podman exec postgres psql -U postgres -c "DROP USER myinstance_user"
rm -rf instances/myInstance
```

---

## Best Practices

1. **Always use PgBouncer** in production (automatic after setup)
2. **Backup databases** before rebuilding with schema changes
3. **Test port changes** in development first
4. **Monitor PM2 logs** after starting instances
5. **Use auto-assign ports** unless you have specific requirements
6. **Keep base server/.env** updated with shared secrets
7. **Rebuild instances** after updating base code
8. **Check infrastructure status** before creating instances

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Host System                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Instance A  │  │  Instance B  │  │  Instance C  │      │
│  │  Port: 5000  │  │  Port: 5001  │  │  Port: 5002  │      │
│  │  PM2: online │  │  PM2: online │  │  PM2: stopped│      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                  │                                 │
│         │ DB Connection    │ DB Connection                   │
│         ▼                  ▼                                 │
│  ┌──────────────────────────────────────┐                   │
│  │      PgBouncer Container             │                   │
│  │      Port: 16432 (exposed)           │                   │
│  │      Connection Pooling              │                   │
│  └──────────────┬───────────────────────┘                   │
│                 │                                            │
│                 │ Pooled Connections                         │
│                 ▼                                            │
│  ┌──────────────────────────────────────┐                   │
│  │      PostgreSQL Container            │                   │
│  │      Port: 15432 (exposed)           │                   │
│  │  ┌────────────┬─────────────┬─────┐  │                   │
│  │  │ instance_a │ instance_b  │ ... │  │                   │
│  │  │    _db     │    _db      │     │  │                   │
│  │  └────────────┴─────────────┴─────┘  │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  File System:                                                │
│  instances/                                                  │
│    ├── instance_a/  (database, server, client, config)      │
│    ├── instance_b/  (database, server, client, config)      │
│    └── instance_c/  (database, server, client, config)      │
└─────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements

- Support for Docker Compose
- Automated backups
- SSL/TLS termination
- Nginx reverse proxy integration
- Resource limits per instance
- Monitoring dashboard
- Automated testing after rebuild

---

## Getting Help

For issues or questions:
1. Check logs: `pm2 logs {instanceName}`
2. Verify infrastructure: `podman ps`
3. Check configuration: `cat instances/{name}/config.json`
4. Review this README
5. Check instance status: Quick status check (option 3)
