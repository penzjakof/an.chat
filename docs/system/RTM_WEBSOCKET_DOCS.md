# 📡 RTM + WebSocket System Documentation

## 🎯 System Overview

AnChat V1 implements a hybrid real-time architecture combining:
- **Internal WebSocket** (Socket.io) for frontend-backend communication  
- **External RTM TalkyTimes** for receiving messages from external service

## 🏗️ Architecture

### WebSocket Pool System
- **One persistent socket per user profile** instead of per dialog
- **Automatic reconnection** with exponential backoff
- **Resource cleanup** with 30-second inactivity timers
- **Multi-profile support** for switching between accounts

### RTM Integration
- **Real-time message reception** from TalkyTimes
- **Event processing** for MessageSent, MessageRead, DialogLimitChanged
- **Toast notifications** for incoming messages
- **Robust reconnection** with working cookies
- **Dialog auto-update**: Automatic update of dialog list when receiving RTM messages
- **Message deduplication**: TTL-based deduplication to prevent duplicate toasts (30s)
- **Full message type support**: All TalkyTimes message types with proper content
- **Client profile fetching**: Automatic loading of client names/avatars for new dialogs
 - **Email events**: New email toasts with separate list item (“Новий лист”) even if dialog exists

## 📁 Key Files

### Frontend
- `apps/web/src/contexts/WebSocketPoolContext.tsx` - Socket pool management
- `apps/web/src/hooks/useDialogWebSocket.ts` - Dialog-specific WebSocket hook
- `apps/web/src/components/Toast.tsx` - Toast notification component
- `apps/web/src/contexts/ToastContext.tsx` - Global toast state management

### Backend  
- `apps/server/src/chats/chats.gateway.ts` - Socket.io gateway
- `apps/server/src/providers/talkytimes/rtm.service.ts` - RTM service
- `apps/server/src/providers/talkytimes/session.service.ts` - Session management

## 🔄 Data Flow

```
TalkyTimes RTM → RTMService → ChatsGateway → WebSocket → Frontend → Toast + Dialog Update
```

1. **RTM receives** MessageSent/MessageNew from TalkyTimes
2. **RTMService processes** and emits rtm.message.new event with full message data
3. **ChatsGateway handles** event, deduplicates by messageId (30s TTL), broadcasts message_toast
4. **Frontend receives** message_toast and:
   - Shows toast notification if not from self
   - Updates existing dialog or creates new one in list
   - For emails: always create a separate email item with a blue “Новий лист” badge
   - For chat messages: if only an email item exists for that pair, create a normal chat item
   - Fetches client profile data (name/avatar) if needed
5. **Toast displays** with animation and auto-closes after 5 seconds
6. **Dialog list updates** in real-time with proper sorting by dateUpdated

## 🧪 Testing

Comprehensive test suite covering:
- RTM Service connection and message handling
- ChatsGateway WebSocket events and RTM integration  
- WebSocket Pool socket management and dialog switching
- Toast Component rendering, animations, and interactions

Run tests: `./test-rtm-websocket.sh`

## ✅ Production Ready

- Error handling at all levels
- Automatic reconnection with exponential backoff
- Resource cleanup and memory management
- Performance optimizations (minimal logging)
- JWT authentication for all WebSocket connections
- Comprehensive test coverage

## 🚀 Key Optimizations Applied

1. **Removed excessive logging** from browser console
2. **Implemented exponential backoff** for RTM reconnections
3. **Added proper resource cleanup** in RTM service
4. **Optimized WebSocket Pool** for better performance
5. **Created comprehensive test suite** for reliability
6. **Fixed toast visibility issues** with explicit styling
7. **Dialog auto-update system** with real-time list synchronization
8. **RTM message deduplication** with 30-second TTL to prevent duplicate toasts
9. **Client profile caching** with fallback to API for missing data
10. **Full message type support** with proper content parsing and display

The system is now production-ready with robust real-time messaging! 🎉
