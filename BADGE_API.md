# DevTrack Badge API Documentation

## Overview

The DevTrack Badge API provides public, shareable SVG badges that contributors can embed in their GitHub README to showcase their DevTrack statistics.

## Endpoints

### 1. Streak Badge
**Endpoint:** `GET /api/badge/streak?user=<githubLogin>`

Returns an SVG badge displaying the user's current commit streak.

**Query Parameters:**
- `user` (required): GitHub username

**Example:**
```
GET /api/badge/streak?user=octocat
```

**Response:**
- Content-Type: `image/svg+xml;charset=utf-8`
- SVG showing current streak (orange if active, indigo if none)
- Cached for 1 hour

### 2. Commits Badge
**Endpoint:** `GET /api/badge/commits?user=<githubLogin>`

Returns an SVG badge displaying commits made this month.

**Query Parameters:**
- `user` (required): GitHub username

**Example:**
```
GET /api/badge/commits?user=octocat
```

**Response:**
- Content-Type: `image/svg+xml;charset=utf-8`
- SVG showing commits count for current month
- Cached for 1 hour

## Usage

### Markdown Embedding

Add to your GitHub README:

```markdown
<!-- Streak Badge -->
![DevTrack Streak](https://devtrack.app/api/badge/streak?user=yourname)

<!-- Commits Badge -->
![DevTrack Commits](https://devtrack.app/api/badge/commits?user=yourname)

<!-- Both Together -->
![DevTrack Streak](https://devtrack.app/api/badge/streak?user=yourname) ![DevTrack Commits](https://devtrack.app/api/badge/commits?user=yourname)
```

### Features

- **Public Access**: No authentication required
- **Real-time Data**: Fetches live data from GitHub API
- **Caching**: Responses cached for 1 hour to reduce API load
- **No Auth Required**: Uses publicly available GitHub data
- **Responsive**: Dynamically sized based on content
- **Accessible**: Includes proper SVG labels and titles

## Color Scheme

- **Streak (Active)**: `#f59e0b` (Orange - active streak)
- **Streak (Inactive)**: `#6366f1` (Indigo - no active streak)
- **Commits**: `#6366f1` (Indigo - DevTrack primary)
- **Error**: `#ef4444` (Red)

## Response Headers

All badge endpoints return appropriate caching headers:

```
Content-Type: image/svg+xml;charset=utf-8
Cache-Control: max-age=3600, public
X-Content-Type-Options: nosniff
```

## Error Handling

- **Missing user parameter**: Returns 400 Bad Request
- **Invalid username**: Returns 400 Bad Request
- **User not found**: Returns SVG badge with "N/A" value
- **API errors**: Returns SVG badge with "Error" value

## Rate Limiting

- Badge endpoints enforce **20 requests per minute per IP**
- Requests exceeding this limit receive HTTP 429 with a `Retry-After` header
- Additionally, the GitHub API has its own limits (see below)
- GitHub API: 60 requests/hour (unauthenticated), 5000/hour (authenticated)
- Using `GITHUB_TOKEN` environment variable increases rate limits

## Performance

- Badge generation is fast (typically <200ms)
- SVG is optimized for web delivery
- Caching significantly reduces load on GitHub API
- Badges are approximately 2-5KB in size

## Getting Your Badge

1. Go to your public DevTrack profile: `https://devtrack.app/u/yourname`
2. Scroll to "Get Your Badge" section
3. Copy the markdown for your desired badge(s)
4. Paste into your GitHub README
5. Commit and push to your repository

## Technical Details

### Badge Generation

Badges use a shields.io-style design implemented with SVG:
- Linear gradient background for depth
- White text with subtle shadow
- Rounded corners for modern appearance
- Responsive sizing based on content

### Data Sources

- Streak badge: GitHub API commit search (last 90 days)
- Commits badge: GitHub API commit search (current month)

### Implementation

- Built with Next.js API routes
- Uses Supabase for user verification
- Dynamically generates SVG content
- Server-side caching with HTTP headers

## Customization

To use a different domain:

```markdown
![DevTrack Streak](https://your-domain.com/api/badge/streak?user=yourname)
```

Replace `your-domain.com` with your DevTrack deployment domain.

## Support

For issues or feature requests related to badges:
1. Check the DevTrack documentation
2. Create an issue on GitHub
3. Contact the DevTrack team

## Examples

### Single Badge
```markdown
![DevTrack Streak](https://devtrack.app/api/badge/streak?user=octocat)
```

### Multiple Badges
```markdown
[![DevTrack Streak](https://devtrack.app/api/badge/streak?user=octocat)](https://devtrack.app/u/octocat)
[![DevTrack Commits](https://devtrack.app/api/badge/commits?user=octocat)](https://devtrack.app/u/octocat)
```

### With Profile Link
```markdown
[
  ![DevTrack Streak](https://devtrack.app/api/badge/streak?user=octocat)
](https://devtrack.app/u/octocat)
```


### GSSoC Badge API Rate Limiting
- Badge requests are restricted to **20 requests per minute per IP**
- This is enforced server-side via a sliding window counter per IP address
