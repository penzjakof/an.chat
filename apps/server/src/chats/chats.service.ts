import { Inject, Injectable, Optional } from '@nestjs/common';
import type { SiteProvider, SiteProviderDialogsQuery } from '../providers/site-provider.interface';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import type { RequestAuthContext } from '../common/auth/auth.types';
import { ChatsGateway } from './chats.gateway';

@Injectable()
export class ChatsService {
	constructor(
		@Inject(TALKY_TIMES_PROVIDER) private readonly provider: SiteProvider,
		@Optional() private readonly gateway?: ChatsGateway,
	) {}

	private toCtx(auth: RequestAuthContext) {
		return { agencyCode: auth.agencyCode, operatorCode: auth.operatorCode };
	}

	fetchDialogs(auth: RequestAuthContext, query?: SiteProviderDialogsQuery): Promise<unknown> {
		return this.provider.fetchDialogs(this.toCtx(auth), query);
	}

	fetchMessages(auth: RequestAuthContext, dialogId: string, cursor?: string): Promise<unknown> {
		return this.provider.fetchMessages(this.toCtx(auth), dialogId, cursor);
	}

	async sendText(auth: RequestAuthContext, dialogId: string, text: string): Promise<unknown> {
		const result = await this.provider.sendTextMessage(this.toCtx(auth), dialogId, text);
		this.gateway?.emitNewMessage({ dialogId, payload: result });
		return result;
	}
}
