import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TalkyTimesRTMService } from './rtm.service';
import { TalkyTimesSessionService } from './session.service';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('TalkyTimesRTMService', () => {
  let service: TalkyTimesRTMService;
  let eventEmitter: EventEmitter2;
  let sessionService: TalkyTimesSessionService;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(async () => {
    // Створюємо mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.CONNECTING,
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      connecting: false,
      connected: false,
      connect: jest.fn(),
    } as any;

    (WebSocket as jest.MockedClass<typeof WebSocket>).mockImplementation(() => mockWebSocket);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TalkyTimesRTMService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: TalkyTimesSessionService,
          useValue: {
            getAllActiveSessions: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<TalkyTimesRTMService>(TalkyTimesRTMService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    sessionService = module.get<TalkyTimesSessionService>(TalkyTimesSessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RTM Connection Management', () => {
    it('should initialize RTM connection on module init', async () => {
      await service.onModuleInit();
      expect(WebSocket).toHaveBeenCalledWith('wss://talkytimes.com/rtm', expect.any(Object));
    });

    it('should handle WebSocket connection events', async () => {
      await service.onModuleInit();
      
      // Симулюємо підключення
      const connectHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (connectHandler) {
        connectHandler();
      }

      expect(mockWebSocket.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle reconnection with exponential backoff', async () => {
      jest.useFakeTimers();
      
      await service.onModuleInit();
      
      // Симулюємо закриття з'єднання
      const closeHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) {
        closeHandler(1000, 'Normal closure');
      }

      // Перевіряємо що таймер встановлено
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
      
      jest.useRealTimers();
    });

    it('should cleanup resources on module destroy', () => {
      service.onModuleDestroy();
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('RTM Message Handling', () => {
    it('should handle MessageSent events correctly', async () => {
      await service.onModuleInit();
      
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const mockMessage = JSON.stringify({
        push: {
          channel: 'personal:#7162437',
          pub: {
            data: {
              type: 'MessageSent',
              data: {
                message: {
                  id: 12345,
                  idUserFrom: 126445481,
                  idUserTo: 7162437,
                  content: { text: 'Test message' },
                  dateCreated: '2025-08-30T13:00:00Z',
                  type: 'text'
                }
              }
            }
          }
        }
      });

      if (messageHandler) {
        messageHandler(mockMessage);
      }

      expect(eventEmitter.emit).toHaveBeenCalledWith('rtm.message.new', {
        messageId: 12345,
        idUserFrom: 126445481,
        idUserTo: 7162437,
        dateCreated: '2025-08-30T13:00:00Z',
        content: { text: 'Test message' }
      });
    });

    it('should handle chat_MessageDisplayAttributesApplied events', async () => {
      await service.onModuleInit();
      
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const mockMessage = JSON.stringify({
        push: {
          channel: 'personal:#7162437',
          pub: {
            data: {
              type: 'chat_MessageDisplayAttributesApplied',
              data: {
                idMessage: 12345,
                idUserFrom: 7162437,
                idUserTo: 119308595,
                dateCreated: '2025-08-30T13:00:00Z'
              }
            }
          }
        }
      });

      if (messageHandler) {
        messageHandler(mockMessage);
      }

      expect(eventEmitter.emit).toHaveBeenCalledWith('rtm.message.new', {
        messageId: 12345,
        idUserFrom: 7162437,
        idUserTo: 119308595,
        dateCreated: '2025-08-30T13:00:00Z'
      });
    });

    it('should handle chat_DialogLimitChanged events', async () => {
      await service.onModuleInit();
      
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const mockMessage = JSON.stringify({
        push: {
          channel: 'personal:#7162437',
          pub: {
            data: {
              type: 'chat_DialogLimitChanged',
              data: {
                idUser: 7162437,
                idInterlocutor: 119308595,
                limitLeft: 8
              }
            }
          }
        }
      });

      if (messageHandler) {
        messageHandler(mockMessage);
      }

      expect(eventEmitter.emit).toHaveBeenCalledWith('rtm.dialog.limit.changed', {
        idUser: 7162437,
        idInterlocutor: 119308595,
        limitLeft: 8
      });
    });
  });

  describe('RTM Subscription Management', () => {
    it('should subscribe to user channel', () => {
      const profileId = 7162437;
      service.subscribeToUser(profileId);
      
      // Перевіряємо що підписка додана
      expect(service['subscriptions'].has(`personal:#${profileId}`)).toBe(true);
    });

    it('should unsubscribe from user channel', () => {
      const profileId = 7162437;
      service.subscribeToUser(profileId);
      service.unsubscribeFromUser(profileId);
      
      // Перевіряємо що підписка видалена
      expect(service['subscriptions'].has(`personal:#${profileId}`)).toBe(false);
    });
  });
});
