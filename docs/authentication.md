# Authentication Documentation

The application supports multiple authentication methods: JWT tokens, OAuth (Google), and API keys.

## JWT Authentication

### Flow

```
1. User submits email/password to POST /api/v1/auth/login
2. Backend validates credentials
3. Backend returns:
   - access_token (JWT, 30 min expiry)
   - refresh_token (JWT, 7 days expiry)
4. Frontend stores tokens
5. Frontend includes access_token in Authorization header
6. When access_token expires, use refresh_token to get new tokens
```

### Tokens

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | 30 minutes | API authentication |
| Refresh Token | 7 days | Obtain new access tokens |

### API Usage

**Login:**
```http
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=secret123
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Authenticated Request:**
```http
GET /api/v1/users/me
Authorization: Bearer eyJ...access_token...
```

**Refresh Token:**
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ...refresh_token..."
}
```

**Logout:**
```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refresh_token": "eyJ...refresh_token..."
}
```

### Session Management

Each login creates a session record that tracks:
- User ID
- Refresh token hash
- IP address
- User agent
- Created/expires timestamps

Users can view and revoke their active sessions:

```http
GET /api/v1/sessions          # List sessions
DELETE /api/v1/sessions/{id}  # Revoke session
```

## Google OAuth

### Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://localhost:8000/api/v1/oauth/google/callback`

5. Configure environment variables:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/oauth/google/callback
```

### Flow

```
1. User clicks "Continue with Google"
2. Frontend redirects to: GET /api/v1/oauth/google/login
3. Backend redirects to Google OAuth consent screen
4. User grants permission
5. Google redirects to: GET /api/v1/oauth/google/callback?code=...
6. Backend exchanges code for tokens
7. Backend creates/links user account
8. Backend redirects to frontend: /auth/callback?access_token=...&refresh_token=...
9. Frontend stores tokens
```

### Frontend Implementation

```typescript
// components/auth/login-form.tsx
const handleGoogleLogin = () => {
  window.location.href = `${API_URL}/api/v1/oauth/google/login`;
};

// app/auth/callback/page.tsx
const handleCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  
  if (accessToken && refreshToken) {
    setAuth({ accessToken, refreshToken });
    router.push("/chat");
  }
};
```

## API Key Authentication

For service-to-service or machine authentication:

### Configuration

```env
API_KEY=your-secure-api-key-here
API_KEY_HEADER=X-API-Key
```

### Usage

```http
GET /api/v1/some-endpoint
X-API-Key: your-secure-api-key-here
```

### Protecting Routes

```python
from app.api.deps import ValidAPIKey

@router.get("/service-endpoint")
async def service_endpoint(api_key: ValidAPIKey):
    # Only accessible with valid API key
    return {"status": "ok"}
```

## Role-Based Access Control

### Roles

| Role | Description |
|------|-------------|
| `user` | Standard user access |
| `admin` | Full access, can manage users |

### Superuser Flag

The `is_superuser` flag grants access to:
- Admin panel (`/admin`)
- User management endpoints
- System configuration

### Usage in Routes

```python
from app.api.deps import CurrentUser, CurrentAdmin, CurrentSuperuser

# Any authenticated user
@router.get("/profile")
async def get_profile(user: CurrentUser):
    return user

# Admin role required
@router.get("/admin/users")
async def list_all_users(admin: CurrentAdmin):
    return await user_service.get_multi()

# Superuser required
@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: UUID, superuser: CurrentSuperuser):
    return await user_service.delete(user_id)
```

### Custom Role Checks

```python
from app.api.deps import RoleChecker
from app.db.models.user import UserRole

@router.get("/moderator-only")
async def moderator_endpoint(
    user: Annotated[User, Depends(RoleChecker(UserRole.MODERATOR))]
):
    return {"message": "Welcome, moderator!"}
```

## WebSocket Authentication

WebSocket connections pass the token as a query parameter:

```typescript
const wsUrl = `ws://localhost:8000/api/v1/ws/agent?token=${accessToken}`;
const ws = new WebSocket(wsUrl);
```

Backend validation:
```python
from app.api.deps import get_current_user_ws

@router.websocket("/ws/agent")
async def agent_ws(
    websocket: WebSocket,
    user: User = Depends(get_current_user_ws),
):
    await websocket.accept()
    # User is authenticated
```

## Security Best Practices

### Environment Variables

```env
# Generate with: openssl rand -hex 32
SECRET_KEY=your-32-char-minimum-secret-key

# Never use defaults in production
API_KEY=generate-a-secure-random-key
```

### Token Security

- Access tokens are short-lived (30 min)
- Refresh tokens are stored hashed in the database
- Tokens are invalidated on logout
- Sessions can be individually revoked

### Rate Limiting

Authentication endpoints are rate-limited:

```python
from app.core.rate_limit import limiter

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
    ...
```

### CORS

Configure allowed origins in `.env`:

```env
CORS_ORIGINS=["http://localhost:3000"]
```

## Troubleshooting

### "Invalid or expired token"

1. Check if token has expired (30 min for access tokens)
2. Use refresh token to get new access token
3. If refresh token expired, user must log in again

### "User account is disabled"

1. Check `is_active` flag in database
2. Admin can re-enable via admin panel

### OAuth "Failed to get user info"

1. Verify Google OAuth credentials are correct
2. Check redirect URI matches exactly
3. Ensure Google+ API is enabled

