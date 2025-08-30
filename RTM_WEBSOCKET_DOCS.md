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
TalkyTimes RTM → RTMService → ChatsGateway → WebSocket → Frontend → Toast
```

1. **RTM receives** MessageSent from TalkyTimes
2. **RTMService processes** and emits rtm.message.new event  
3. **ChatsGateway handles** event and broadcasts message_toast to all clients
4. **Frontend receives** message_toast and shows toast if not from self
5. **Toast displays** with animation and auto-closes after 5 seconds

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

The system is now production-ready with robust real-time messaging! 🎉
