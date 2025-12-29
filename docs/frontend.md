# Frontend Documentation

The frontend is built with Next.js 15, React 19, and TypeScript.

## Project Structure

```
frontend/src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth layout group
│   │   ├── login/         # Login page
│   │   └── register/      # Register page
│   ├── (dashboard)/       # Dashboard layout group
│   │   ├── chat/          # AI chat page
│   │   ├── dashboard/     # Dashboard page
│   │   └── profile/       # Profile page
│   ├── api/               # API routes (proxy to backend)
│   ├── auth/callback/     # OAuth callback handler
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # React context providers
├── components/
│   ├── areas/             # Area dashboard cards (Jobs, etc.)
│   ├── auth/              # Auth components
│   ├── chat/              # Chat components
│   ├── jobs/              # Jobs area components
│   ├── layout/            # Header, Sidebar
│   ├── pipelines/         # Pipeline execution components
│   ├── theme/             # Theme toggle
│   └── ui/                # Shared UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
├── stores/                # Zustand state stores
└── types/                 # TypeScript types
```

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `page.tsx` | Landing page |
| `/login` | `login/page.tsx` | Login form |
| `/register` | `register/page.tsx` | Registration form |
| `/chat` | `chat/page.tsx` | AI chat interface |
| `/dashboard` | `dashboard/page.tsx` | User dashboard |
| `/profile` | `profile/page.tsx` | Profile settings |
| `/auth/callback` | `auth/callback/page.tsx` | OAuth callback |
| `/pipelines` | `pipelines/page.tsx` | Pipeline execution |
| `/jobs` | `jobs/page.tsx` | Jobs area overview |
| `/jobs/list` | `jobs/list/page.tsx` | Job listings |
| `/jobs/profiles` | `jobs/profiles/page.tsx` | Job search profiles |
| `/jobs/resumes` | `jobs/resumes/page.tsx` | Resume management |
| `/jobs/search` | `jobs/search/page.tsx` | Job search pipelines |
| `/jobs/chat` | `jobs/chat/page.tsx` | Jobs-specific AI chat |

## State Management

Using Zustand for global state:

### Auth Store

```typescript
import { useAuthStore } from "@/stores";

const { 
  isAuthenticated,
  user,
  accessToken,
  setAuth,
  clearAuth,
  setUser,
} = useAuthStore();
```

### Chat Store

```typescript
import { useChatStore } from "@/stores";

const {
  messages,
  addMessage,
  updateMessage,
  addToolCall,
  updateToolCall,
  clearMessages,
} = useChatStore();
```

### Conversation Store

```typescript
import { useConversationStore } from "@/stores";

const {
  conversations,
  currentConversationId,
  currentMessages,
  setConversations,
  setCurrentConversationId,
} = useConversationStore();
```

### Theme Store

```typescript
import { useThemeStore } from "@/stores";

const { theme, setTheme, toggleTheme } = useThemeStore();
```

## Custom Hooks

### useAuth

Handles authentication operations:

```typescript
import { useAuth } from "@/hooks";

const { login, logout, register, isLoading, error } = useAuth();

// Login
await login({ email: "user@example.com", password: "secret" });

// Register
await register({ email: "user@example.com", password: "secret", full_name: "John Doe" });

// Logout
await logout();
```

### useChat

Manages WebSocket chat with the AI agent:

```typescript
import { useChat } from "@/hooks";

const {
  messages,
  isConnected,
  isProcessing,
  connect,
  disconnect,
  sendMessage,
  clearMessages,
} = useChat({ conversationId: "optional-id" });

// Connect to WebSocket
useEffect(() => {
  connect();
  return () => disconnect();
}, []);

// Send message
sendMessage("Hello, AI!");
```

### useLocalChat

Same API as `useChat` but stores messages locally (for anonymous users):

```typescript
import { useLocalChat } from "@/hooks";

const { messages, isConnected, sendMessage, ... } = useLocalChat();
```

### useConversations

Fetches and manages conversation history:

```typescript
import { useConversations } from "@/hooks";

const { fetchConversations, isLoading } = useConversations();

useEffect(() => {
  fetchConversations();
}, []);
```

### useJobProfiles

Manages job search profiles:

```typescript
import { useJobProfiles } from "@/hooks";

const {
  profiles,
  currentProfile,
  defaultProfile,
  isLoading,
  hasProfiles,
  hasCompleteProfile,
  fetchProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  setDefault,
} = useJobProfiles();
```

### useResumes

Manages resume uploads:

```typescript
import { useResumes } from "@/hooks";

const {
  resumes,
  isLoading,
  uploadResume,
  deleteResume,
  setPrimary,
  fetchResumes,
} = useResumes();
```

### usePipelines

Fetches and filters pipelines:

```typescript
import { usePipelines } from "@/hooks";

const {
  pipelines,
  isLoading,
  fetchPipelines,
  filterByArea,
  filterByTags,
  availableAreas,
  availableTags,
} = usePipelines({ area: "jobs" });
```

## Components

### Chat Components

**ChatContainer**
Main chat interface that handles both authenticated and anonymous users:

```tsx
import { ChatContainer } from "@/components/chat";

<ChatContainer useLocalStorage={false} />
```

**MessageList**
Renders list of chat messages:

```tsx
import { MessageList } from "@/components/chat";

<MessageList messages={messages} />
```

**MessageItem**
Individual message with markdown support and tool call visualization:

```tsx
import { MessageItem } from "@/components/chat";

<MessageItem message={message} />
```

**ToolCallCard**
Displays AI tool invocations:

```tsx
import { ToolCallCard } from "@/components/chat";

<ToolCallCard toolCall={toolCall} />
```

**ChatInput**
Message input with submit handling:

```tsx
import { ChatInput } from "@/components/chat";

<ChatInput 
  onSend={sendMessage} 
  disabled={!isConnected} 
  isProcessing={isProcessing} 
/>
```

### UI Components

Using shadcn/ui-style components:

```tsx
import { Button, Card, Input, Label } from "@/components/ui";

<Button variant="default">Click me</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>
```

## API Client

### Client-side (browser)

```typescript
import { apiClient } from "@/lib/api-client";

// GET request
const data = await apiClient.get<User>("/api/users/me");

// POST request
const user = await apiClient.post<User>("/api/auth/register", {
  email: "user@example.com",
  password: "secret",
});
```

### Server-side (API routes)

```typescript
import { backendFetch } from "@/lib/server-api";

// In API route
export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await backendFetch<User>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data);
}
```

## Environment Variables

Create `.env.local` in the frontend directory:

```env
# Backend API URL (for server-side requests)
BACKEND_URL=http://localhost:8000

# Public API URL (for client-side, if different)
NEXT_PUBLIC_API_URL=http://localhost:8000

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## Styling

Using Tailwind CSS v4 with CSS variables for theming:

```css
/* app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  /* ... */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  /* ... */
}
```

Use Tailwind classes with CSS variables:

```tsx
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Click me
  </button>
</div>
```

## Testing

### Unit Tests (Vitest)

```bash
cd frontend
bun test
```

### E2E Tests (Playwright)

```bash
cd frontend
bun run e2e
```

Test files are in `e2e/`:
- `auth.spec.ts` - Authentication flows
- `chat.spec.ts` - Chat functionality
- `home.spec.ts` - Home page
- `jobs.spec.ts` - Jobs area functionality

