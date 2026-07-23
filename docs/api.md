# DevTrack API Documentation

## Overview

DevTrack provides 90+ REST API endpoints for user settings, goals, metrics, notifications, public profiles, badges, integrations, AI features, rooms, webhooks, and developer productivity insights.

This document serves as a human-readable guide to the available APIs. For the complete machine-readable specification, refer to the OpenAPI document included in the repository.

---

## Interactive Documentation

DevTrack includes Swagger UI for exploring and testing API endpoints.

After starting the development server, open:

`http://localhost:3000/api-docs`

The complete OpenAPI 3.1 specification is available at:

`public/openapi.yaml`

---

## Authentication

Most user-specific endpoints require authentication through NextAuth session cookies.

### Authentication Methods

**Cookie-based Authentication (Recommended)**
- Uses NextAuth session cookies (`next-auth.session-token`)
- Automatically handled when using the DevTrack web interface
- For API calls, include the session cookie in the `Cookie` header

**Bearer Token Authentication**
- Some endpoints support bearer token authentication
- Used for cron jobs and webhooks
- Include `Authorization: Bearer <TOKEN>` header

### Session Cookie Format

```
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN
```

### Unauthenticated Requests

Unauthenticated requests typically return:

```json
{
  "error": "Unauthorized"
}
```

with HTTP status `401`.

### Rate Limits

- **Public endpoints** (`/api/public/*`): Rate-limited to prevent abuse
- **Authenticated endpoints**: No strict rate limiting for authenticated users
- **GitHub API**: Subject to GitHub's rate limits (5000 requests/hour for authenticated, 60/hour for unauthenticated)
- **Webhooks**: Validated for SSRF protection before delivery

### Authentication Code Examples

```bash
# curl with cookie authentication
curl http://localhost:3000/api/goals \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

```javascript
// JavaScript with cookie authentication
const response = await fetch('http://localhost:3000/api/goals', {
  headers: {
    'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
  }
});
```

```python
# Python with cookie authentication
import requests

response = requests.get(
    'http://localhost:3000/api/goals',
    headers={
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
    }
)
```

---

## API Route Reference

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth GitHub OAuth handler — session creation and token exchange |
| GET | `/api/auth/link-github` | Initiate linking an additional GitHub account |
| GET | `/api/auth/link-github/callback` | OAuth callback for linked account |

---

### Goals

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/goals` | List all goals for the authenticated user |
| POST | `/api/goals` | Create a new goal |
| PATCH | `/api/goals/{id}` | Update a goal |
| DELETE | `/api/goals/{id}` | Delete a goal |
| GET | `/api/goals/history` | Weekly goal completion history |
| POST | `/api/goals/sync` | Sync goal progress against live GitHub metrics |

#### Example: Create a goal

**Request:**
```json
POST /api/goals
{
  "title": "Weekly Commits",
  "target": 20,
  "unit": "commits"
}
```

**Response:**
```json
{
  "id": "goal_abc123",
  "title": "Weekly Commits",
  "target": 20,
  "current": 0,
  "unit": "commits",
  "createdAt": "2025-06-15T10:00:00Z"
}
```

**Code Examples:**

```bash
# curl
curl -X POST http://localhost:3000/api/goals \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"title":"Weekly Commits","target":20,"unit":"commits"}'
```

```javascript
// JavaScript (fetch)
const response = await fetch('http://localhost:3000/api/goals', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
  },
  body: JSON.stringify({
    title: 'Weekly Commits',
    target: 20,
    unit: 'commits'
  })
});
const goal = await response.json();
```

```python
# Python (requests)
import requests

response = requests.post(
    'http://localhost:3000/api/goals',
    headers={
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
    },
    json={
        'title': 'Weekly Commits',
        'target': 20,
        'unit': 'commits'
    }
)
goal = response.json()
```

---

### Metrics

All metrics routes require authentication. Most support a `?refresh=1` or `?bypassCache=1` query parameter to force a fresh fetch.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/metrics/contributions` | Commit activity over time (supports `?days=30`) |
| GET | `/api/metrics/contributions/daily` | Daily contribution breakdown |
| GET | `/api/metrics/contributions/hourly` | Hourly contribution breakdown |
| GET | `/api/metrics/streak` | Current and longest commit streak |
| GET | `/api/metrics/prs` | PR summary: open, merged, closed counts |
| GET | `/api/metrics/pr-breakdown` | PR status breakdown chart data |
| GET | `/api/metrics/pr-review-time` | PR review time trend over time |
| GET | `/api/metrics/repos` | Top repositories ranked by commit activity (supports `?days=30`) |
| GET | `/api/metrics/repos/{owner}/{name}` | Specific repository metadata |
| GET | `/api/metrics/repos/{owner}/{name}/commits` | Commit history for a specific repository |
| GET | `/api/metrics/languages` | Language breakdown by bytes of code |
| GET | `/api/metrics/issues` | Issue open/close metrics |
| GET | `/api/metrics/activity` | Recent activity feed |
| GET | `/api/metrics/weekly-summary` | Weekly activity digest |
| GET | `/api/metrics/ci` | CI build analytics (success/failure rate) |
| GET | `/api/metrics/discussions` | GitHub Discussions participation stats |
| GET | `/api/metrics/achievements` | GitHub achievements unlocked |
| GET | `/api/metrics/achievement-progress` | Progress toward next GitHub achievement tiers |
| GET | `/api/metrics/pinned-repos` | User's pinned repositories |
| GET | `/api/metrics/inactive-repos` | Repositories with no recent commits |
| GET | `/api/metrics/sponsors` | GitHub Sponsors data |
| GET | `/api/metrics/commit-times` | Commits grouped by hour of day |
| GET | `/api/metrics/productive-hours` | Most productive coding hours |
| GET | `/api/metrics/consistency-score` | Developer consistency score |
| GET | `/api/metrics/community-engagement` | Community engagement score |
| GET | `/api/metrics/compare` | Side-by-side comparison with another GitHub user |
| GET | `/api/metrics/coding-activity-insights` | Coding activity pattern insights |
| GET | `/api/metrics/repo-health` | Repository health scores |
| GET | `/api/metrics/repo-analytics` | Detailed repository analytics |
| GET | `/api/metrics/repo-explorer` | Repository explorer data |
| GET | `/api/metrics/devtrack-badges` | DevTrack badge set for the user |

---

### Notifications

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/notifications` | List recent notifications |
| PATCH | `/api/notifications` | Mark all notifications as read |
| PATCH | `/api/notifications/{id}` | Mark a specific notification as read |
| GET | `/api/notifications/weekly` | Weekly notification digest |
| POST | `/api/notifications/discord-sync` | Send notification to Discord webhook |

#### Example: GET /api/notifications

**Response:**
```json
[
  {
    "id": "123",
    "title": "Weekly Digest",
    "message": "You made 42 commits this week.",
    "read": false,
    "created_at": "2025-06-15T10:00:00Z"
  }
]
```

**Code Examples:**

```bash
# curl
curl http://localhost:3000/api/notifications \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

```javascript
// JavaScript (fetch)
const response = await fetch('http://localhost:3000/api/notifications', {
  headers: {
    'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
  }
});
const notifications = await response.json();
```

```python
# Python (requests)
import requests

response = requests.get(
    'http://localhost:3000/api/notifications',
    headers={
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
    }
)
notifications = response.json()
```

---

### User Management

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/user/settings` | Get current user settings |
| PATCH | `/api/user/settings` | Update user settings |
| POST | `/api/user/settings/discord-test` | Send a test Discord webhook |
| GET | `/api/user/github-accounts` | List linked GitHub accounts |
| POST | `/api/user/github-accounts` | Link a new GitHub account |
| DELETE | `/api/user/github-accounts/{githubId}` | Remove a linked GitHub account |
| GET | `/api/user/github-orgs` | List GitHub organization memberships |
| GET | `/api/user/orgs` | List organizations (alternative endpoint) |
| GET | `/api/user/pinned-repos` | Get pinned repositories |
| PATCH | `/api/user/pinned-repos` | Update pinned repositories |
| GET | `/api/user/pinned-repos/details` | Get pinned repository details |
| GET | `/api/user/dashboard-layout` | Get customizable dashboard layout |
| PATCH | `/api/user/dashboard-layout` | Update dashboard layout |
| GET | `/api/user/data-export` | Export all user data as JSON |
| GET | `/api/user/export` | Export user data (alternative format) |

#### Example: GET /api/user/settings

**Response:**
```json
{
  "timezone": "UTC",
  "publicProfile": true,
  "discordNotifications": false,
  "discordWebhookUrl": null,
  "wakatimeConnected": false
}
```

**Code Examples:**

```bash
# curl
curl http://localhost:3000/api/user/settings \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

```javascript
// JavaScript (fetch)
const response = await fetch('http://localhost:3000/api/user/settings', {
  headers: {
    'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
  }
});
const settings = await response.json();
```

```python
# Python (requests)
import requests

response = requests.get(
    'http://localhost:3000/api/user/settings',
    headers={
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN'
    }
)
settings = response.json()
```

---

### Public Profiles

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/public/{username}` | Public profile data for a DevTrack user |
| GET | `/api/public/privacy` | Get current user's privacy settings |
| PATCH | `/api/public/privacy` | Update privacy settings |

The `/api/public/{username}` endpoint is rate-limited. It only returns data for users who have `is_public = true`.

---

### Leaderboard

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/leaderboard` | Public leaderboard rankings |
| POST | `/api/leaderboard/refresh` | Trigger leaderboard refresh |
| POST | `/api/leaderboard/rebuild` | Full leaderboard rebuild (requires `LEADERBOARD_REBUILD_TOKEN`) |

#### Query Parameters for GET /api/leaderboard

| Parameter | Description |
|-----------|-------------|
| `lang` | Filter by primary language |
| `period` | Filter by time period (`week`, `month`, `year`) |

---

### Badges

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/badge/commits` | SVG commit-count badge for embedding in READMEs |
| GET | `/api/badge/streak-shield` | shields.io-compatible streak badge |

---

### AI Features

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/personality` | Generate AI Code Personality Report |
| POST | `/api/ai/roast` | AI roast or hype of coding style (requires `GROQ_API_KEY`) |
| POST | `/api/ai/weekly-summary` | AI-generated weekly summary (Groq or Anthropic) |
| GET/POST | `/api/ai-insights` | General AI insights |
| POST | `/api/project-tutor` | AI Project Tutor powered by Groq |

#### POST /api/personality

Runs deterministic scoring in `src/lib/personality-analysis.ts` to compute dimensions (working style, commit pattern, collaboration style, perfectionism score, etc.), then optionally calls Groq to generate prose, an archetype name, and a tagline.

If `GROQ_API_KEY` is not configured, a complete fallback report is returned from the deterministic scoring alone.

---

### CV / Career Intelligence

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/cv/analyze` | Analyze GitHub activity for CV bullet points |
| POST | `/api/cv/generate` | AI-generate a full CV from GitHub data |
| POST | `/api/cv/export` | Export CV in a specified format |

---

### Rooms

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/rooms` | List rooms the user belongs to |
| POST | `/api/rooms` | Create a new room |
| GET | `/api/rooms/{roomId}` | Get room details |
| PATCH | `/api/rooms/{roomId}` | Update room settings |
| DELETE | `/api/rooms/{roomId}` | Delete a room |
| POST | `/api/rooms/{roomId}/invite` | Generate or refresh an invite link |
| GET | `/api/rooms/{roomId}/members` | List room members |
| POST | `/api/rooms/{roomId}/members` | Join a room (by invite code) |
| DELETE | `/api/rooms/{roomId}/members/{username}` | Remove a member from the room |
| GET | `/api/rooms/{roomId}/messages` | List messages in the room |
| POST | `/api/rooms/{roomId}/messages` | Post a message to the room |

---

### Milestones

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/milestones` | List milestones for the authenticated user |
| POST | `/api/milestones` | Create a new milestone |
| PATCH | `/api/milestones/{id}` | Update a milestone |
| DELETE | `/api/milestones/{id}` | Delete a milestone |

---

### Local Coding

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/local-coding/keys` | List local coding API keys |
| POST | `/api/local-coding/keys` | Create a new API key |
| DELETE | `/api/local-coding/keys` | Revoke an API key |
| GET | `/api/local-coding/stats` | Aggregated local coding statistics |
| POST | `/api/local-coding/sync` | Ingest coding sessions from the editor plugin |

The local coding plugin authenticates using an API key issued by `/api/local-coding/keys`.

---

### WakaTime Integration

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/wakatime` | Get WakaTime connection status |
| DELETE | `/api/wakatime` | Disconnect WakaTime |
| POST | `/api/wakatime/sync` | Trigger a WakaTime data sync |

---

### Jira Integration

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/integrations/jira/credentials` | Get stored Jira credentials (masked) |
| POST | `/api/integrations/jira/credentials` | Save Jira credentials (encrypted at rest) |
| DELETE | `/api/integrations/jira/credentials` | Remove Jira credentials |

---

### Webhooks

#### GitHub Webhook

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/webhooks/github` | Receive GitHub push events; invalidates the affected user's metrics cache and triggers an SSE push |

The endpoint validates the GitHub webhook signature using `GITHUB_WEBHOOK_SECRET`.

#### Custom Webhooks

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/webhooks/custom` | List the user's configured webhooks |
| POST | `/api/webhooks/custom` | Create a new webhook |
| GET | `/api/webhooks/custom/{id}` | Get webhook details |
| PATCH | `/api/webhooks/custom/{id}` | Update a webhook |
| DELETE | `/api/webhooks/custom/{id}` | Delete a webhook |
| POST | `/api/webhooks/custom/{id}/test` | Send a test payload to the webhook URL |
| POST | `/api/webhooks/custom/{id}/rotate-secret` | Rotate the webhook signing secret |
| GET | `/api/webhooks/custom/{id}/deliveries` | List delivery history |
| POST | `/api/webhooks/custom/{id}/deliveries/{deliveryId}/retry` | Retry a failed delivery |

Webhook target URLs are validated against SSRF attack vectors before delivery.

#### Internal Dispatch

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/webhooks/dispatch/metrics` | Trigger an SSE metrics push for a user |

---

### Streak

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/streak/freeze` | Activate a streak freeze for the current day |

---

### SSE Stream

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/stream` | Server-Sent Events stream for real-time dashboard metric pushes |

The SSE connection is per-user. The server pushes `metrics_updated` events when webhooks or cron jobs detect new data. The client-side `DashboardSSEProvider` and `SSEListener` components handle the connection.

---

### Year in Code (Wrapped)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/wrapped` | Year in Code data aggregation for the wrapped experience |
| GET | `/api/wrapped/og` | OG image for the wrapped share card |

---

### OG Images

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/og/user` | Open Graph image for a user's public profile |

---

### Sponsors

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/sponsors` | GitHub Sponsors data |
| POST | `/api/sponsors/sync` | Sync sponsors data from GitHub |

---

### Contact

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/contact` | Submit contact form (delivered via Resend) |

---

### Scheduled (Cron)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/cron/sync` | `Authorization: Bearer <CRON_SECRET>` | Refresh GitHub achievements and WakaTime data |
| POST | `/api/cron/weekly-digest` | `Authorization: Bearer <CRON_SECRET>` | Send weekly digest emails to subscribed users |

---

### Users

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/users/search` | Search DevTrack users by GitHub login |

---

### Debug

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/debug/health` | Health check endpoint |

---

### Unsubscribe

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/unsubscribe` | Unsubscribe from DevTrack emails |

---

## OpenAPI Specification

DevTrack maintains a machine-readable OpenAPI 3.1 specification:

```text
public/openapi.yaml
```

The OpenAPI specification powers the interactive Swagger UI and should remain synchronized with route implementations.

---

## Keeping Documentation Updated

When adding or modifying API routes:

1. Update the route implementation.
2. Update `public/openapi.yaml`.
3. Verify the endpoint appears correctly in `/api-docs`.
4. Update this document if a new API category or major endpoint group is introduced.

Keeping these resources synchronized ensures contributors, self-hosters, and integrators always have accurate API documentation.

---

## Error Codes and Troubleshooting

### Common HTTP Status Codes

| Status Code | Meaning | Common Causes |
|-------------|---------|----------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request body or parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |
| `502` | Bad Gateway | GitHub API or external service error |
| `503` | Service Unavailable | Temporary service outage |

### Error Response Format

Most errors return a JSON response with an `error` field:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Error Scenarios

#### Authentication Errors (401)

**Problem:** Missing or invalid session cookie

**Solution:**
- Ensure you're logged into DevTrack
- Check that the session cookie is included in requests
- Verify the cookie hasn't expired
- Try re-authenticating through the web interface

```bash
# Check if you're authenticated
curl -v http://localhost:3000/api/goals \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

#### GitHub Rate Limiting (429)

**Problem:** GitHub API rate limit exceeded

**Solution:**
- Wait for the rate limit to reset (typically 1 hour)
- Use authenticated GitHub requests (5000 requests/hour vs 60/hour)
- Implement caching to reduce API calls
- Use the `?refresh=1` parameter sparingly

**Error Response:**
```json
{
  "error": "GitHub rate limit reached. Please try again later."
}
```

#### Webhook Signature Validation (401)

**Problem:** Invalid GitHub webhook signature

**Solution:**
- Ensure `GITHUB_WEBHOOK_SECRET` is set in environment variables
- Verify the webhook secret matches between GitHub and DevTrack
- Check that the webhook is configured correctly in GitHub settings

#### AI Service Unavailable (500)

**Problem:** AI service (Groq/Anthropic) not configured or unavailable

**Solution:**
- Ensure `GROQ_API_KEY` or `ANTHROPIC_API_KEY` is set
- Check the API key is valid and has credits
- Verify network connectivity to the AI service
- Try again later if the service is temporarily down

**Error Response:**
```json
{
  "error": "AI service unavailable"
}
```

#### Invalid Request Body (400)

**Problem:** Missing required fields or invalid data types

**Solution:**
- Check the request body matches the expected schema
- Ensure all required fields are included
- Verify data types are correct (strings, numbers, etc.)
- Check for typos in field names

**Example Error:**
```json
{
  "error": "Missing required field: title"
}
```

### Troubleshooting Steps

1. **Check Authentication**
   ```bash
   curl -v http://localhost:3000/api/user/settings \
     -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
   ```

2. **Verify Endpoint URL**
   - Ensure the URL is correct
   - Check for typos in the path
   - Verify the HTTP method (GET, POST, etc.)

3. **Check Request Body**
   - Validate JSON syntax
   - Ensure Content-Type header is set to `application/json`
   - Verify all required fields are present

4. **Review Server Logs**
   - Check the DevTrack server logs for detailed error messages
   - Look for stack traces or additional context

5. **Test with Swagger UI**
   - Visit `http://localhost:3000/api-docs`
   - Use the interactive documentation to test endpoints
   - Swagger UI provides detailed error information

6. **Check Environment Variables**
   - Verify all required environment variables are set
   - Check for typos in variable names
   - Ensure API keys are valid and not expired

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/Priyanshu-byte-coder/devtrack/issues)
2. Review the [Contributing Guidelines](CONTRIBUTING.md)
3. Join the community Discord (if available)
4. Create a new issue with:
   - The endpoint you're trying to access
   - The request you're making (without sensitive data)
   - The error response you're receiving
   - Steps to reproduce the issue
