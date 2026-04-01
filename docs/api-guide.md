# AlertyBlurty API Usage Guide

This guide provides examples for using the AlertyBlurty API.

## Base URL

```
http://localhost:5041/api
```

## Authentication

AlertyBlurty uses JWT Bearer tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Quick Start

### 1. Register a New Organization

```bash
curl -X POST http://localhost:5041/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "fullName": "Admin User",
    "phoneNumber": "+15551234567",
    "timezone": "America/New_York",
    "organizationName": "My Organization"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2025-10-14T12:00:00Z",
    "user": {
      "id": "guid",
      "email": "admin@example.com",
      "fullName": "Admin User",
      "role": "SuperAdmin"
    }
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:5041/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'
```

### 3. Get Current User Profile

```bash
curl -X GET http://localhost:5041/api/users/me \
  -H "Authorization: Bearer <your-token>"
```

## Team Management

### Create a Team

```bash
curl -X POST http://localhost:5041/api/teams \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Infrastructure Team",
    "description": "Handles all infrastructure alerts",
    "requireAdminApprovalForSwaps": true
  }'
```

### Add Team Member

```bash
curl -X POST http://localhost:5041/api/teams/{teamId}/members \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-guid",
    "rotationOrder": 1
  }'
```

### Get Team Members

```bash
curl -X GET http://localhost:5041/api/teams/{teamId}/members \
  -H "Authorization: Bearer <your-token>"
```

## Incident Management

### Get All Open Incidents

```bash
curl -X GET http://localhost:5041/api/incidents/open \
  -H "Authorization: Bearer <your-token>"
```

### Get Incidents by Team

```bash
curl -X GET "http://localhost:5041/api/incidents/team/{teamId}?status=Open" \
  -H "Authorization: Bearer <your-token>"
```

Status values: `Open`, `Acknowledged`, `Resolved`

### Acknowledge an Incident

```bash
curl -X POST http://localhost:5041/api/incidents/{incidentId}/acknowledge \
  -H "Authorization: Bearer <your-token>"
```

## Zabbix Webhook Integration

### Send Zabbix Alert

This endpoint is called by Zabbix when an alert triggers. No authentication required.

```bash
curl -X POST http://localhost:5041/api/webhooks/zabbix/{teamId} \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "12345",
    "triggerId": "67890",
    "triggerName": "High CPU usage",
    "triggerDescription": "CPU usage exceeded 90% for 5 minutes",
    "hostName": "web-server-01",
    "severity": 4,
    "status": "PROBLEM",
    "eventTime": "2025-10-13T12:00:00Z"
  }'
```

Response when alert created:
```json
{
  "success": true,
  "incidentId": "incident-guid",
  "status": "Open",
  "message": "Webhook processed successfully"
}
```

### Send OK (Resolved) Event

```bash
curl -X POST http://localhost:5041/api/webhooks/zabbix/{teamId} \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "12346",
    "triggerId": "67890",
    "triggerName": "High CPU usage",
    "triggerDescription": "CPU usage is back to normal",
    "hostName": "web-server-01",
    "severity": 0,
    "status": "OK",
    "eventTime": "2025-10-13T12:30:00Z"
  }'
```

## User Management

### Create Additional User (Admin/SuperAdmin only)

```bash
curl -X POST http://localhost:5041/api/users \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "UserPassword123!",
    "fullName": "John Doe",
    "phoneNumber": "+15559876543",
    "timezone": "America/Los_Angeles",
    "role": "User"
  }'
```

Role values: `User`, `Admin`, `SuperAdmin`

### Update User

```bash
curl -X PUT http://localhost:5041/api/users/{userId} \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Doe",
    "phoneNumber": "+15559876544",
    "timezone": "America/Chicago",
    "role": "Admin",
    "isActive": true
  }'
```

### Get Users by Organization

```bash
curl -X GET http://localhost:5041/api/users/organization/{organizationId} \
  -H "Authorization: Bearer <your-token>"
```

## Swagger UI

For interactive API documentation and testing, visit:

```
http://localhost:5041/swagger
```

### Using JWT in Swagger:

1. Click the **Authorize** button (lock icon)
2. Enter: `Bearer <your-jwt-token>`
3. Click **Authorize**
4. Now you can test authenticated endpoints

## Error Responses

All errors return a consistent format:

```json
{
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2025-10-13T12:00:00Z"
}
```

Common status codes:
- `400` - Bad Request (invalid data)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## Incident Grouping Logic

AlertyBlurty automatically groups related alerts:

- Multiple events from the **same host** and **same trigger** are grouped into one incident
- The `eventCount` field tracks how many times the alert fired
- The `lastOccurrenceUtc` field updates with each new event
- Only one SMS notification is sent (on first occurrence)

Example:
1. **Event 1**: "web-01 CPU High" → Creates Incident A, sends SMS
2. **Event 2**: "web-01 CPU High" (same host/trigger) → Updates Incident A (eventCount=2), **no new SMS**
3. **Event 3**: "web-02 CPU High" (different host) → Creates Incident B, sends SMS

## Rate Limiting & Best Practices

1. **Webhook Endpoint**: No rate limit (designed for high-volume Zabbix alerts)
2. **Authentication**: Tokens expire after 24 hours (configurable)
3. **SMS Notifications**: Automatically rate-limited by incident grouping
4. **API Calls**: No built-in rate limiting, use responsibly

## Testing with Postman

Import these environment variables:

```json
{
  "base_url": "http://localhost:5041",
  "jwt_token": "your-token-here"
}
```

Then use `{{base_url}}` and `{{jwt_token}}` in your requests.

## Next Steps

- Configure your Zabbix server to send webhooks to AlertyBlurty
- Set up on-call schedules for your teams
- Test the SMS notification flow
- Monitor the `/health` endpoint for uptime
