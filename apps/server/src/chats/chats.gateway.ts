import { OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
export class ChatsGateway implements OnModuleInit {
	@WebSocketServer()
	server!: Server;

	constructor(private readonly jwt: JwtService) {}

	onModuleInit(): void {
		// no-op
	}

	emitNewMessage(event: { dialogId: string; payload: any }) {
		this.server.to(`dlg:${event.dialogId}`).emit('message', event.payload);
	}

	@SubscribeMessage('join')
	async join(@MessageBody() data: { dialogId: string }, @ConnectedSocket() client: Socket) {
		const token = (client.handshake.auth as any)?.token as string | undefined;
		if (token) {
			await this.jwt.verifyAsync(token).catch(() => client.disconnect(true));
		}
		const room = `dlg:${data.dialogId}`;
		client.join(room);
		return { joined: room };
	}
}
