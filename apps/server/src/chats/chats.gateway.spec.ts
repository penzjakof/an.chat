import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatsGateway } from './chats.gateway';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';

describe('ChatsGateway', () => {
  let gateway: ChatsGateway;
  let rtmService: TalkyTimesRTMService;
  let jwtService: JwtService;
  let mockServer: jest.Mocked<Server>;
  let mockClient: jest.Mocked<Socket>;

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;

    mockClient = {
      id: 'test-client-id',
      handshake: {
        auth: {
          token: 'valid-jwt-token',
          profileId: '7162437'
        }
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatsGateway,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: TalkyTimesRTMService,
          useValue: {
            subscribeToUser: jest.fn(),
            unsubscribeFromUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({
              sub: 'user-session-id',
              profileId: 7162437
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get<ChatsGateway>(ChatsGateway);
    rtmService = module.get<TalkyTimesRTMService>(TalkyTimesRTMService);
    jwtService = module.get<JwtService>(JwtService);

    // Встановлюємо mock server
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should handle client connection', async () => {
      await gateway.handleConnection(mockClient);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token');
    });

    it('should handle client disconnection', () => {
      gateway.handleDisconnect(mockClient);
      
      // Перевіряємо що клієнт був видалений з внутрішніх структур
      expect(mockClient.leave).not.toHaveBeenCalled(); // Тестуємо що немає помилок
    });

    it('should reject invalid JWT token', async () => {
      jwtService.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      mockClient.handshake.auth.token = 'invalid-token';

      await expect(gateway.handleConnection(mockClient)).rejects.toThrow();
    });
  });

  describe('Dialog Management', () => {
    beforeEach(async () => {
      await gateway.handleConnection(mockClient);
    });

    it('should handle join dialog event', async () => {
      const dialogData = { dialogId: '7162437-123456' };

      await gateway.join(dialogData, mockClient);

      expect(mockClient.join).toHaveBeenCalledWith('dlg:7162437-123456');
      expect(rtmService.subscribeToUser).toHaveBeenCalledWith(7162437);
    });

    it('should handle leave dialog event', () => {
      const dialogData = { dialogId: '7162437-123456' };

      gateway.leave(dialogData, mockClient);

      expect(mockClient.leave).toHaveBeenCalledWith('dlg:7162437-123456');
    });

    it('should extract profileId from dialogId correctly', async () => {
      const dialogData = { dialogId: '117326723-987654' };

      await gateway.join(dialogData, mockClient);

      expect(rtmService.subscribeToUser).toHaveBeenCalledWith(117326723);
    });

    it('should handle invalid dialogId format', async () => {
      const dialogData = { dialogId: 'invalid-format' };

      await gateway.join(dialogData, mockClient);

      // RTM підписка не повинна викликатися для невалідного формату
      expect(rtmService.subscribeToUser).not.toHaveBeenCalled();
    });
  });

  describe('RTM Event Handling', () => {
    it('should handle RTM new message event', () => {
      const messageData = {
        messageId: 12345,
        idUserFrom: 126445481,
        idUserTo: 7162437,
        dateCreated: '2025-08-30T13:00:00Z',
        content: { text: 'Test message' }
      };

      gateway.handleRTMNewMessage(messageData);

      expect(mockServer.emit).toHaveBeenCalledWith('message_toast', {
        messageId: 12345,
        idUserFrom: 126445481,
        idUserTo: 7162437,
        dateCreated: '2025-08-30T13:00:00Z',
        type: 'new_message'
      });
    });

    it('should handle RTM message read event', () => {
      const readData = {
        messageId: 12345,
        idUserFrom: 7162437,
        idUserTo: 126445481,
        dateRead: '2025-08-30T13:01:00Z'
      };

      gateway.handleRTMMessageRead(readData);

      expect(mockServer.to).toHaveBeenCalledWith('dlg:7162437-126445481');
      expect(mockServer.emit).toHaveBeenCalledWith('message_read', readData);
    });

    it('should handle RTM dialog limit changed event', () => {
      const limitData = {
        idUser: 7162437,
        idInterlocutor: 119308595,
        limitLeft: 8
      };

      gateway.handleRTMDialogLimitChanged(limitData);

      expect(mockServer.to).toHaveBeenCalledWith('dlg:7162437-119308595');
      expect(mockServer.emit).toHaveBeenCalledWith('dialog_limit_changed', limitData);
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast message to all clients for toast notifications', () => {
      const messageData = {
        messageId: 12345,
        idUserFrom: 126445481,
        idUserTo: 7162437,
        dateCreated: '2025-08-30T13:00:00Z'
      };

      gateway.handleRTMNewMessage(messageData);

      // Перевіряємо що повідомлення відправлено всім клієнтам, а не конкретній кімнаті
      expect(mockServer.emit).toHaveBeenCalledWith('message_toast', expect.any(Object));
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should broadcast to specific dialog room for other events', () => {
      const readData = {
        messageId: 12345,
        idUserFrom: 7162437,
        idUserTo: 126445481,
        dateRead: '2025-08-30T13:01:00Z'
      };

      gateway.handleRTMMessageRead(readData);

      expect(mockServer.to).toHaveBeenCalledWith('dlg:7162437-126445481');
    });
  });

  describe('Error Handling', () => {
    it('should handle RTM service errors gracefully', async () => {
      rtmService.subscribeToUser = jest.fn().mockImplementation(() => {
        throw new Error('RTM service error');
      });

      const dialogData = { dialogId: '7162437-123456' };

      // Не повинно кидати помилку
      await expect(gateway.join(dialogData, mockClient)).resolves.not.toThrow();
    });

    it('should handle malformed RTM events', () => {
      const malformedData = {
        // Відсутні обов'язкові поля
        messageId: null,
        idUserFrom: undefined,
      };

      // Не повинно кидати помилку
      expect(() => gateway.handleRTMNewMessage(malformedData as any)).not.toThrow();
    });
  });
});
