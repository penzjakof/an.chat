"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TalkyTimesProvider = void 0;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function shouldRetry(error, attempt, maxRetries) {
    if (attempt >= maxRetries)
        return false;
    if (error.name === 'AbortError')
        return false;
    if (error.name === 'TypeError' && error.message.includes('fetch'))
        return true;
    if (error.status >= 500)
        return true;
    if (error.status === 429)
        return true;
    if (error.status === 408)
        return true;
    return false;
}
async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res;
    }
    catch (error) {
        clearTimeout(timeout);
        throw error;
    }
}
class TalkyTimesProvider {
    baseUrl;
    sessionService;
    connectionPool;
    stickersCache = new Map();
    STICKERS_CACHE_TTL = 30 * 60 * 1000;
    constructor(baseUrl, sessionService, connectionPool) {
        this.baseUrl = baseUrl;
        this.sessionService = sessionService;
        this.connectionPool = connectionPool;
        console.log('TalkyTimesProvider baseUrl:', this.baseUrl);
    }
    async fetchWithConnectionPool(url, options = {}) {
        const { maxRetries = DEFAULT_MAX_RETRIES, baseDelayMs = DEFAULT_BASE_DELAY_MS, timeoutMs = DEFAULT_TIMEOUT_MS, retryCondition = shouldRetry, ...fetchOptions } = options;
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal
                });
                clearTimeout(timeout);
                if (!res.ok) {
                    const error = new Error(`HTTP ${res.status}: ${res.statusText}`);
                    error.status = res.status;
                    error.response = res;
                    if (retryCondition(error, attempt, maxRetries)) {
                        lastError = error;
                        console.warn(`🔄 Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying...`);
                        const delayMs = baseDelayMs * Math.pow(2, attempt);
                        await delay(delayMs);
                        continue;
                    }
                    throw error;
                }
                if (attempt > 0) {
                    console.log(`✅ Request succeeded after ${attempt + 1} attempts`);
                }
                return res;
            }
            catch (error) {
                clearTimeout(timeout);
                lastError = error;
                if (retryCondition(error, attempt, maxRetries)) {
                    console.warn(`🔄 Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying...`);
                    const delayMs = baseDelayMs * Math.pow(2, attempt);
                    const jitter = Math.random() * 0.1 * delayMs;
                    await delay(delayMs + jitter);
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }
    async makeRequest(options) {
        if (options.method !== 'GET') {
            console.log(`🌐 TalkyTimesProvider.makeRequest: ${options.method} ${options.url} for profile ${options.profileId}`);
        }
        if (this.isMock()) {
            return {
                success: true,
                data: {
                    cursor: '',
                    photos: []
                }
            };
        }
        try {
            const session = await this.sessionService.getActiveSession(options.profileId);
            if (!session) {
                return { success: false, error: `No active session found for profile ${options.profileId}` };
            }
            const fullUrl = options.url.startsWith('http') ? options.url : `${this.baseUrl}${options.url}`;
            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cookie': session.cookies,
                'Referer': `${this.baseUrl}/chat/${options.profileId}_123456`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                ...options.headers
            };
            console.log(`🌐 Making ${options.method} request to ${fullUrl}`);
            const retryOptions = {
                timeoutMs: 15000,
                maxRetries: options.method === 'GET' ? 3 : 2,
                baseDelayMs: options.method === 'GET' ? 1000 : 2000,
            };
            const response = await this.fetchWithConnectionPool(fullUrl, {
                method: options.method,
                headers,
                body: options.data ? JSON.stringify(options.data) : undefined,
                ...retryOptions
            });
            const result = await response.json();
            if (options.method !== 'GET' || result.error) {
                console.log(`✅ Request successful:`, result);
            }
            return { success: true, data: result };
        }
        catch (error) {
            console.error(`💥 Error making request:`, error);
            return { success: false, error: error.message };
        }
    }
    async sendPhoto(ctx, params) {
        console.log(`📸 TalkyTimesProvider.sendPhoto: profile ${params.idProfile} → user ${params.idRegularUser}, photo ${params.idPhoto}`);
        if (this.isMock()) {
            return {
                success: true,
                data: {
                    messageId: `mock-msg-${Date.now()}`,
                    photoId: params.idPhoto
                }
            };
        }
        try {
            const session = await this.sessionService.getActiveSession(params.idProfile);
            if (!session) {
                return { success: false, error: `No active session found for profile ${params.idProfile}` };
            }
            const url = `${this.baseUrl}/api/send-photo`;
            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cookie': session.cookies,
                'Referer': `${this.baseUrl}/chat/${params.idProfile}_${params.idRegularUser}`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            };
            const payload = {
                idProfile: params.idProfile,
                idRegularUser: params.idRegularUser,
                idPhoto: params.idPhoto
            };
            console.log(`🌐 Sending photo request to ${url}`, payload);
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Photo send failed with status ${response.status}:`, errorText);
                return { success: false, error: `HTTP ${response.status}: ${errorText}` };
            }
            const result = await response.json();
            console.log(`✅ Photo sent successfully:`, result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error(`💥 Error sending photo:`, error);
            return { success: false, error: error.message };
        }
    }
    isMock() {
        const ttBaseUrl = process.env.TT_BASE_URL || '';
        const result = ttBaseUrl.startsWith('mock:') || ttBaseUrl === '';
        if (!this._lastMockState || this._lastMockState !== result) {
            console.log(`🔍 isMock mode changed: TT_BASE_URL="${ttBaseUrl}", result=${result}`);
            this._lastMockState = result;
        }
        return result;
    }
    _lastMockState;
    async getOperatorRef(opts) {
        try {
            if (opts.profileId !== undefined && opts.profileId !== null) {
                const ref = await this.sessionService.getActiveOperatorRefForProfile(String(opts.profileId));
                if (ref)
                    return ref;
            }
            if (opts.ctx?.operatorCode) {
                const active = await this.sessionService.hasActiveShiftForOperatorCode(opts.ctx.operatorCode);
                if (active)
                    return opts.ctx.operatorCode;
            }
        }
        catch { }
        return null;
    }
    async applyOperatorRefHeader(headers, opts) {
        const ref = await this.getOperatorRef(opts);
        if (ref)
            headers['x-requested-with'] = ref;
    }
    buildHeaders(ctx) {
        const headers = { 'x-requested-with': ctx.agencyCode };
        if (ctx.operatorCode)
            headers['x-gateway'] = ctx.operatorCode;
        return headers;
    }
    async fetchDialogs(ctx, filters) {
        if (this.isMock()) {
            return {
                status: "error",
                details: { message: "Page not found.", code: 0 }
            };
        }
        const qs = new URLSearchParams();
        if (filters?.search)
            qs.set('search', filters.search);
        if (filters?.status)
            qs.set('status', filters.status);
        const url = `${this.baseUrl}/dialogs?${qs.toString()}`;
        const res = await fetchWithTimeout(url, { method: 'GET', headers: this.buildHeaders(ctx) });
        return res.json();
    }
    async fetchDialogsByProfile(profileId, criteria = ['active'], cursor = '', limit = 15) {
        const isMockMode = this.isMock();
        if (cursor || isMockMode) {
            console.log(`🔍 TalkyTimes.fetchDialogsByProfile: profileId=${profileId}, isMock=${isMockMode}, cursor="${cursor}"`);
        }
        if (isMockMode) {
            console.log(`🎭 Mock fetchDialogsByProfile for profile ${profileId}`);
            let session = await this.sessionService.getSession(profileId);
            if (!session) {
                session = await this.sessionService.authenticateProfile(profileId, 'mock_login', 'mock_password');
            }
            const validProfileIds = ['7162437', '7162438'];
            if (!validProfileIds.includes(profileId)) {
                return {
                    dialogs: [],
                    cursor: ""
                };
            }
            const allMockDialogs = [
                {
                    idUser: parseInt(profileId),
                    idInterlocutor: 112752976 + parseInt(profileId.slice(-1)),
                    idLastReadMsg: 42214651246,
                    dateUpdated: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                    hasNewMessage: true,
                    isActive: true,
                    type: "active",
                    status: "active",
                    isOnline: true,
                    lastMessage: {
                        id: 43258791390 + parseInt(profileId.slice(-1)),
                        content: { message: `Активний онлайн діалог` },
                        dateCreated: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                        idUserFrom: 112752976 + parseInt(profileId.slice(-1)),
                        idUserTo: parseInt(profileId)
                    },
                    unreadMessagesCount: 2
                },
                {
                    idUser: parseInt(profileId),
                    idInterlocutor: 112752977 + parseInt(profileId.slice(-1)),
                    idLastReadMsg: 42214651247,
                    dateUpdated: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                    hasNewMessage: false,
                    isActive: true,
                    type: "active",
                    status: "active",
                    isOnline: false,
                    lastMessage: {
                        id: 43258791391 + parseInt(profileId.slice(-1)),
                        content: { message: `Активний офлайн діалог` },
                        dateCreated: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                        idUserFrom: 112752977 + parseInt(profileId.slice(-1)),
                        idUserTo: parseInt(profileId)
                    },
                    unreadMessagesCount: 0
                },
                {
                    idUser: parseInt(profileId),
                    idInterlocutor: 123456789 + parseInt(profileId.slice(-1)),
                    idLastReadMsg: null,
                    dateUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                    hasNewMessage: true,
                    isActive: false,
                    type: "unanswered",
                    status: "unanswered",
                    isOnline: false,
                    lastMessage: {
                        id: 43258791392 + parseInt(profileId.slice(-1)),
                        content: { message: `Неотвеченное офлайн` },
                        dateCreated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                        idUserFrom: 123456789 + parseInt(profileId.slice(-1)),
                        idUserTo: parseInt(profileId)
                    },
                    unreadMessagesCount: 1
                },
                {
                    idUser: parseInt(profileId),
                    idInterlocutor: 123456790 + parseInt(profileId.slice(-1)),
                    idLastReadMsg: null,
                    dateUpdated: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                    hasNewMessage: true,
                    isActive: false,
                    type: "unanswered",
                    status: "unanswered",
                    isOnline: true,
                    lastMessage: {
                        id: 43258791393 + parseInt(profileId.slice(-1)),
                        content: { message: `Неотвеченное онлайн` },
                        dateCreated: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                        idUserFrom: 123456790 + parseInt(profileId.slice(-1)),
                        idUserTo: parseInt(profileId)
                    },
                    unreadMessagesCount: 2
                },
                {
                    idUser: parseInt(profileId),
                    idInterlocutor: 987654321 + parseInt(profileId.slice(-1)),
                    idLastReadMsg: 42214651248,
                    dateUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    hasNewMessage: false,
                    isActive: false,
                    type: "bookmarked",
                    status: "bookmarked",
                    isOnline: true,
                    lastMessage: {
                        id: 43258791394 + parseInt(profileId.slice(-1)),
                        content: { message: `Закладка онлайн` },
                        dateCreated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        idUserFrom: parseInt(profileId),
                        idUserTo: 987654321 + parseInt(profileId.slice(-1))
                    },
                    unreadMessagesCount: 0
                }
            ];
            let filteredDialogs = allMockDialogs;
            if (criteria && criteria.length > 0) {
                const statusCriteria = criteria.filter(c => ['active', 'unanswered', 'bookmarked'].includes(c));
                if (statusCriteria.length > 0) {
                    filteredDialogs = filteredDialogs.filter(dialog => statusCriteria.includes(dialog.status));
                }
                if (criteria.includes('online')) {
                    filteredDialogs = filteredDialogs.filter(dialog => dialog.isOnline);
                }
            }
            const mockCursor = cursor ?
                new Date(new Date(cursor).getTime() - 24 * 60 * 60 * 1000).toISOString() :
                new Date(Date.now() - 60 * 60 * 1000).toISOString();
            return {
                dialogs: filteredDialogs,
                cursor: mockCursor,
                hasMore: filteredDialogs.length > 0
            };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            throw new Error(`No active session for profile ${profileId}. Please authenticate first.`);
        }
        try {
            const url = 'https://talkytimes.com/platform/chat/dialogs/by-criteria';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            console.log(`🚀 TalkyTimes API request for profile ${profileId}:`, {
                criteria,
                cursor,
                limit,
                url
            });
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    criteria,
                    cursor,
                    limit
                }),
                timeoutMs: 15000,
                maxRetries: 2,
                baseDelayMs: 1500
            });
            if (!res.ok) {
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    throw new Error(`Session expired for profile ${profileId}. Please re-authenticate.`);
                }
                throw new Error(`HTTP ${res.status}`);
            }
            const result = await res.json();
            console.log(`📥 TalkyTimes API response for profile ${profileId}:`, {
                dialogsCount: result.dialogs?.length,
                cursor: result.cursor,
                hasMore: result.hasMore,
                hasMoreField: 'hasMore' in result
            });
            return result;
        }
        catch (error) {
            console.error('TalkyTimes fetchDialogsByProfile error:', error);
            throw error;
        }
    }
    async fetchMessages(ctx, dialogId, cursor) {
        if (this.isMock()) {
            return {
                messages: [
                    {
                        id: 43256456550,
                        dateCreated: "2025-08-29T11:50:36+00:00",
                        idUserFrom: 94384965,
                        idUserTo: 126232553,
                        type: "text",
                        content: { message: "Привіт! Як справи?" }
                    },
                    {
                        id: 43256456966,
                        dateCreated: "2025-08-29T11:50:40+00:00",
                        idUserFrom: 126232553,
                        idUserTo: 94384965,
                        type: "text",
                        content: { message: "Привіт! Все добре, дякую!" }
                    },
                    {
                        id: 43256457321,
                        dateCreated: "2025-08-29T11:50:43+00:00",
                        idUserFrom: 94384965,
                        idUserTo: 126232553,
                        type: "text",
                        content: { message: "Чудово! Що робиш?" }
                    }
                ]
            };
        }
        const [idProfile, idRegularUser] = dialogId.split('-').map(Number);
        const url = 'https://talkytimes.com/platform/chat/messages';
        const requestBody = {
            idLastMessage: cursor ? parseInt(cursor) : undefined,
            idRegularUser: idRegularUser,
            limit: 15,
            withoutTranslation: false
        };
        console.log(`📤 TalkyTimes fetchMessages request:`, {
            url,
            profileId: idProfile,
            regularUserId: idRegularUser,
            requestBody
        });
        const headers = this.buildHeaders(ctx);
        console.log(`📋 Request headers:`, headers);
        try {
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes fetchMessages error ${res.status}:`, errorText);
                throw new Error(`HTTP ${res.status}: ${errorText}`);
            }
            const data = await res.json();
            console.log(`📥 TalkyTimes fetchMessages response:`, {
                status: res.status,
                hasData: !!data,
                dataLength: data?.messages?.length
            });
            return data;
        }
        catch (error) {
            console.error(`💥 TalkyTimes fetchMessages critical error:`, error);
            throw error;
        }
    }
    async fetchMessagesByProfile(profileId, dialogId, cursor) {
        console.log(`🔍 fetchMessagesByProfile: isMock=${this.isMock()}, baseUrl=${this.baseUrl}`);
        if (this.isMock()) {
            console.log(`🎭 Mock mode: generating messages for profile ${profileId}, dialog ${dialogId}, cursor=${cursor}`);
            const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
            const baseId = (cursor && cursor !== 'null' && cursor !== 'undefined') ? parseInt(cursor) : 43256456550;
            const messages = [];
            const messageCount = 7;
            for (let i = messageCount; i >= 1; i--) {
                const messageId = baseId - i * 100;
                const isFromUser = i % 2 === 0;
                messages.push({
                    id: messageId,
                    dateCreated: new Date(Date.now() - i * 10 * 60 * 1000).toISOString(),
                    idUserFrom: isFromUser ? idInterlocutor : idUser,
                    idUserTo: isFromUser ? idUser : idInterlocutor,
                    type: "text",
                    content: {
                        message: isFromUser
                            ? `Повідомлення від користувача ${i}`
                            : `Відповідь оператора ${i}`
                    }
                });
            }
            return {
                success: true,
                messages
            };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
            const idRegularUser = idInterlocutor;
            const url = 'https://talkytimes.com/platform/chat/messages';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/chat/${idUser}_${idInterlocutor}`;
            console.log(`🚀 TalkyTimes messages request for profile ${profileId}:`, {
                dialogId,
                idUser: idUser,
                idInterlocutor: idInterlocutor,
                idRegularUser,
                cursor,
                url,
                referer: headers['referer']
            });
            const requestBody = {};
            if (cursor && cursor !== 'null' && cursor !== 'undefined') {
                requestBody.idLastMessage = parseInt(cursor);
            }
            requestBody.idRegularUser = idRegularUser;
            requestBody.limit = 15;
            requestBody.withoutTranslation = false;
            console.log(`📤 Request body:`, requestBody);
            console.log(`📋 Full headers:`, headers);
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                timeoutMs: 15000,
                maxRetries: 3,
                baseDelayMs: 1000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const data = await res.json();
            console.log(`📥 TalkyTimes messages response for profile ${profileId}:`, {
                messagesCount: data?.messages?.length || 0,
                dialogId
            });
            if (data && Array.isArray(data.messages)) {
                return { success: true, messages: data.messages };
            }
            else {
                console.warn('Unexpected TalkyTimes messages response format:', data);
                return { success: false, error: 'Invalid response format' };
            }
        }
        catch (error) {
            console.error('TalkyTimes fetchMessagesByProfile error:', error);
            return { success: false, error: 'Connection error' };
        }
    }
    async sendTextMessage(ctx, dialogId, text) {
        if (this.isMock()) {
            return { idMessage: `mock-${Date.now()}` };
        }
        const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
        if (!idUser || !idInterlocutor) {
            throw new Error(`Invalid dialogId format: ${dialogId}`);
        }
        const session = await this.sessionService.getSession(String(idUser));
        if (!session) {
            throw new Error(`No active session for profile ${idUser}. Please authenticate first.`);
        }
        const url = 'https://talkytimes.com/platform/chat/send/text';
        const headers = this.sessionService.getRequestHeaders(session);
        headers['referer'] = `https://talkytimes.com/chat/${idUser}_${idInterlocutor}`;
        headers['origin'] = 'https://talkytimes.com';
        await this.applyOperatorRefHeader(headers, { ctx, profileId: idUser });
        const body = {
            message: text,
            idRegularUser: idInterlocutor,
            withoutTranslation: false
        };
        const res = await this.fetchWithConnectionPool(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            timeoutMs: 15000,
            maxRetries: 2,
            baseDelayMs: 1500
        });
        if (!res.ok) {
            const errorText = await res.text();
            if (res.status === 401) {
                await this.sessionService.removeSession(String(idUser));
            }
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
    }
    async getOriginalPhotoUrl(profileId, idRegularUser, previewUrl) {
        if (this.isMock()) {
            return { success: true, url: previewUrl };
        }
        const session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = `https://talkytimes.com/platform/operator/get-photo/${idRegularUser}?preview=${encodeURIComponent(previewUrl)}`;
            const headers = this.sessionService.getRequestHeaders(session);
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${idRegularUser}`;
            headers['origin'] = 'https://talkytimes.com';
            await this.applyOperatorRefHeader(headers, { profileId });
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                timeoutMs: 15000,
                maxRetries: 1
            });
            if (!res.ok) {
                const text = await res.text();
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                }
                return { success: false, error: `HTTP ${res.status}: ${text}` };
            }
            const data = await res.json();
            const originalUrl = data?.data?.url || data?.url;
            if (originalUrl) {
                return { success: true, url: originalUrl };
            }
            return { success: false, error: 'Invalid response format' };
        }
        catch (error) {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getUnansweredMails(profileId, offset = 0, limit = 15) {
        try {
            console.log(`📧 TalkyTimes.getUnansweredMails: profileId=${profileId}, offset=${offset}, limit=${limit}, isMock=${this.isMock()}`);
            if (this.isMock()) {
                return { success: true, data: { data: { counters: { countTotal: 0, countNew: 0 }, inboxCounters: { countTotal: 0, countNew: 0 }, mails: [], profiles: [] } } };
            }
            const session = await this.sessionService.getSession(profileId);
            if (!session) {
                return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
            }
            const url = 'https://talkytimes.com/platform/connections/mails';
            const payload = {
                type: 'inbox/unanswered',
                offset,
                limit,
                femaleIds: [parseInt(profileId)],
                idRegularUser: ''
            };
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['origin'] = 'https://talkytimes.com';
            headers['referer'] = 'https://talkytimes.com/mails/inbox/unanswered';
            console.log(`📧 Requesting unanswered mails for profile ${profileId}`);
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const text = await res.text();
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                }
                return { success: false, error: `HTTP ${res.status}: ${text}` };
            }
            const data = await res.json();
            return { success: true, data };
        }
        catch (error) {
            console.error('TalkyTimes.getUnansweredMails error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async fetchProfileData(profileId) {
        if (this.isMock()) {
            const mockProfileData = {
                id: parseInt(profileId) || 126232553,
                name: `Mock Profile ${profileId}`,
                personal: {
                    avatar_large: `https://picsum.photos/100/100?random=${profileId}`,
                    avatar_xl: `https://picsum.photos/592/538?random=${profileId}`,
                    age: 25 + (parseInt(profileId) % 30)
                },
                is_online: Math.random() > 0.5
            };
            return { success: true, profileData: mockProfileData };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/private/personal-profile';
            const headers = this.sessionService.getRequestHeaders(session);
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                timeoutMs: 15000,
                maxRetries: 2,
                baseDelayMs: 2000
            });
            if (!res.ok) {
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}` };
            }
            const data = await res.json();
            if (data && data.id) {
                return { success: true, profileData: data };
            }
            else {
                return { success: false, error: 'Invalid response format' };
            }
        }
        catch (error) {
            console.error('TalkyTimes fetchProfileData error:', error);
            return { success: false, error: 'Connection error' };
        }
    }
    async fetchProfiles(profileId, userIds) {
        if (this.isMock()) {
            const mockProfiles = userIds.map(id => ({
                id,
                id_user: id,
                name: `Mock User ${id}`,
                personal: {
                    avatar_small: `https://picsum.photos/50/50?random=${id}`,
                    avatar_large: `https://picsum.photos/100/100?random=${id}`,
                    avatar_xl: `https://picsum.photos/592/538?random=${id}`,
                    age: 25 + (id % 30)
                },
                is_online: Math.random() > 0.5,
                last_visit: new Date(Date.now() - Math.random() * 86400000).toISOString()
            }));
            return { success: true, profiles: mockProfiles };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/connections/profiles';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            if (userIds && userIds.length > 0) {
                const firstId = userIds[0];
                headers['referer'] = `https://talkytimes.com/user/${String(firstId).padStart(12, '0')}`;
                headers['origin'] = 'https://talkytimes.com';
            }
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ids: userIds }),
                timeoutMs: 15000
            });
            if (!res.ok) {
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}` };
            }
            const data = await res.json();
            if (data?.data?.profiles) {
                return { success: true, profiles: data.data.profiles };
            }
            else {
                return { success: false, error: 'Invalid response format' };
            }
        }
        catch (error) {
            console.error('TalkyTimes fetchProfiles error:', error);
            return { success: false, error: 'Connection error' };
        }
    }
    async fetchClientPhotos(profileId, clientId) {
        if (this.isMock()) {
            return { success: true, data: { public: [], private: [], isTrusted: 2 } };
        }
        const session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = `https://talkytimes.com/platform/operator/get-photos/${clientId}`;
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/user/${String(clientId).padStart(12, '0')}`;
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                timeoutMs: 15000,
                maxRetries: 2
            });
            if (!res.ok) {
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                }
                const text = await res.text();
                return { success: false, error: `HTTP ${res.status}: ${text}` };
            }
            const data = await res.json();
            return { success: true, data: data?.data ?? data };
        }
        catch (error) {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getConnections(profileId, idsInterlocutor) {
        if (this.isMock()) {
            const data = (idsInterlocutor || []).map((id) => ({
                idUser: parseInt(profileId),
                idInterlocutor: id,
                likedByMe: false,
                visitedByMe: false,
                winkedByMe: false,
                followedByMe: false,
                blockedByMe: false,
                blockedByInterlocutor: Math.random() < 0.2
            }));
            return { success: true, data };
        }
        const session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/connection/get';
            const headers = this.sessionService.getRequestHeaders(session);
            headers['origin'] = 'https://talkytimes.com';
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${idsInterlocutor?.[0] ?? ''}`;
            await this.applyOperatorRefHeader(headers, { profileId });
            const body = {
                idsInterlocutor: idsInterlocutor
            };
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                timeoutMs: 15000,
                maxRetries: 1,
                baseDelayMs: 1000
            });
            if (!res.ok) {
                const text = await res.text();
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                }
                return { success: false, error: `HTTP ${res.status}: ${text}` };
            }
            const data = await res.json();
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async validateCredentials(email, password) {
        if (this.isMock()) {
            const profileId = `mock_${Date.now()}`;
            await this.sessionService.authenticateProfile(profileId, email, password);
            return { success: true, profileId };
        }
        try {
            const loginUrl = 'https://talkytimes.com/platform/auth/login';
            const res = await this.fetchWithConnectionPool(loginUrl, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'accept-language': 'en-US,en;q=0.9',
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    'origin': 'https://talkytimes.com',
                    'pragma': 'no-cache',
                    'referer': 'https://talkytimes.com/auth/login',
                    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    email,
                    password,
                    captcha: ''
                }),
                timeoutMs: 20000,
                maxRetries: 1,
                baseDelayMs: 3000
            });
            if (!res.ok) {
                return { success: false, error: `HTTP ${res.status}` };
            }
            const data = await res.json();
            if (data?.data?.result === true && data?.data?.idUser) {
                const profileId = data.data.idUser.toString();
                const setCookieHeaders = res.headers.getSetCookie?.() || [];
                const cookieValues = setCookieHeaders.map(header => {
                    return header.split(';')[0].trim();
                }).filter(Boolean);
                const cookies = cookieValues.join('; ');
                const refreshToken = data.data.refreshToken;
                console.log(`🍪 Saving ${setCookieHeaders.length} set-cookie headers as ${cookieValues.length} cookies for profile ${profileId}`);
                console.log(`🍪 Raw headers: ${setCookieHeaders.join(' | ')}`);
                console.log(`🍪 Clean cookies: ${cookies}`);
                await this.sessionService.saveSession(profileId, {
                    cookies,
                    refreshToken,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                });
                return { success: true, profileId };
            }
            else {
                return { success: false, error: 'Невірні облікові дані' };
            }
        }
        catch (error) {
            console.error('TalkyTimes login validation error:', error);
            return { success: false, error: 'Помилка з\'єднання з TalkyTimes' };
        }
    }
    async searchDialogByPair(profileId, clientId) {
        console.log(`🔍 TalkyTimes.searchDialogByPair: profileId=${profileId}, clientId=${clientId}, isMock=${this.isMock()}`);
        if (this.isMock()) {
            console.log(`🎭 Mock mode: generating dialog for profile ${profileId} and client ${clientId}`);
            const mockDialog = {
                idUser: parseInt(profileId),
                idInterlocutor: clientId,
                idLastReadMsg: 43266034646,
                idInterlocutorLastReadMsg: 43257663229,
                dateUpdated: new Date().toISOString(),
                draft: "",
                hasNewMessage: false,
                highlightExpireDate: null,
                highlightType: "none",
                isActive: true,
                isBlocked: false,
                isBookmarked: false,
                isHidden: false,
                isPinned: false,
                lastMessage: {
                    id: 43266256908,
                    dateCreated: new Date().toISOString(),
                    idUserFrom: parseInt(profileId),
                    idUserTo: clientId,
                    type: "text",
                    content: {
                        message: "Тестове повідомлення для пошуку діалогу"
                    }
                },
                messagesLeft: 2,
                type: "active",
                unreadMessagesCount: 0
            };
            return {
                success: true,
                dialog: mockDialog
            };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/chat/dialogs/by-pairs';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            console.log(`🚀 TalkyTimes search dialog request for profile ${profileId}:`, {
                profileId,
                clientId,
                url
            });
            const requestBody = {
                idsRegularUser: [clientId],
                withoutTranslation: false
            };
            console.log(`📤 Request body:`, requestBody);
            console.log(`📋 Full headers:`, headers);
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes search dialog API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const result = await res.json();
            console.log(`📥 TalkyTimes search dialog response for profile ${profileId}:`, {
                dialogsCount: result?.length,
                hasDialog: result?.length > 0
            });
            if (result && Array.isArray(result) && result.length > 0) {
                return {
                    success: true,
                    dialog: result[0]
                };
            }
            else {
                return {
                    success: false,
                    error: 'Dialog not found'
                };
            }
        }
        catch (error) {
            console.error('TalkyTimes searchDialogByPair error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async fetchRestrictions(profileId, clientId) {
        console.log(`🔍 TalkyTimes.fetchRestrictions: profileId=${profileId}, clientId=${clientId}, isMock=${this.isMock()}`);
        if (this.isMock()) {
            console.log(`🎭 Mock mode: generating restrictions for profile ${profileId} and client ${clientId}`);
            const mockRestrictions = {
                lettersLeft: Math.floor(Math.random() * 10)
            };
            return {
                success: true,
                lettersLeft: mockRestrictions.lettersLeft
            };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/correspondence/restriction';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${clientId}`;
            console.log(`🚀 TalkyTimes restrictions request for profile ${profileId}:`, {
                profileId,
                clientId,
                url,
                referer: headers['referer']
            });
            const requestBody = {
                idRegularUser: clientId
            };
            console.log(`📤 Request body:`, requestBody);
            console.log(`📋 Full headers:`, headers);
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes restrictions API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const result = await res.json();
            console.log(`📥 TalkyTimes restrictions response for profile ${profileId}:`, result);
            if (result && result.data && typeof result.data.messagesLeft === 'number') {
                return {
                    success: true,
                    lettersLeft: result.data.messagesLeft
                };
            }
            else {
                return {
                    success: false,
                    error: 'Invalid response format'
                };
            }
        }
        catch (error) {
            console.error('TalkyTimes fetchRestrictions error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getStickers(profileId, interlocutorId) {
        console.log(`😀 TalkyTimes.getStickers: profileId=${profileId}, interlocutorId=${interlocutorId}, isMock=${this.isMock()}`);
        const cacheKey = `stickers-${profileId}`;
        const now = Date.now();
        const cached = this.stickersCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < this.STICKERS_CACHE_TTL) {
            console.log(`📋 Using cached stickers for profile ${profileId} (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
            return cached.data;
        }
        if (this.isMock()) {
            console.log(`🎭 Mock mode: generating stickers for profile ${profileId}`);
            const mockCategories = [
                {
                    name: 'Funny Faces',
                    stickers: [
                        { id: 1001, url: 'https://via.placeholder.com/64x64?text=😀' },
                        { id: 1002, url: 'https://via.placeholder.com/64x64?text=😂' },
                        { id: 1003, url: 'https://via.placeholder.com/64x64?text=😍' },
                        { id: 1004, url: 'https://via.placeholder.com/64x64?text=🤔' },
                    ]
                },
                {
                    name: 'Hearts',
                    stickers: [
                        { id: 2001, url: 'https://via.placeholder.com/64x64?text=❤️' },
                        { id: 2002, url: 'https://via.placeholder.com/64x64?text=💛' },
                        { id: 2003, url: 'https://via.placeholder.com/64x64?text=💚' },
                        { id: 2004, url: 'https://via.placeholder.com/64x64?text=💙' },
                    ]
                },
                {
                    name: 'Animals',
                    stickers: [
                        { id: 3001, url: 'https://via.placeholder.com/64x64?text=🐱' },
                        { id: 3002, url: 'https://via.placeholder.com/64x64?text=🐶' },
                        { id: 3003, url: 'https://via.placeholder.com/64x64?text=🐼' },
                        { id: 3004, url: 'https://via.placeholder.com/64x64?text=🦁' },
                    ]
                }
            ];
            const result = { success: true, categories: mockCategories };
            this.stickersCache.set(cacheKey, { data: result, timestamp: now });
            return result;
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/chat/stickers';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${interlocutorId}`;
            console.log(`🚀 TalkyTimes stickers request for profile ${profileId}:`, {
                profileId,
                interlocutorId,
                url,
                referer: headers['referer']
            });
            const requestBody = {
                idInterlocutor: interlocutorId
            };
            console.log(`📤 Request body:`, requestBody);
            console.log(`📋 Full headers:`, headers);
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes stickers API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const result = await res.json();
            console.log(`📥 TalkyTimes stickers response for profile ${profileId}:`, result);
            if (result && result.categories && Array.isArray(result.categories)) {
                const response = {
                    success: true,
                    categories: result.categories
                };
                this.stickersCache.set(cacheKey, { data: response, timestamp: now });
                return response;
            }
            else {
                return {
                    success: false,
                    error: 'Invalid response format'
                };
            }
        }
        catch (error) {
            console.error('TalkyTimes getStickers error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async sendSticker(ctx, params) {
        console.log(`😀 TalkyTimes.sendSticker: profile ${params.idProfile} → user ${params.idRegularUser}, sticker ${params.stickerId}`);
        if (this.isMock()) {
            return {
                success: true,
                data: {
                    messageId: `sticker-msg-${Date.now()}`,
                    stickerId: params.stickerId,
                    stickerUrl: params.stickerUrl
                }
            };
        }
        try {
            const session = await this.sessionService.getActiveSession(params.idProfile);
            if (!session) {
                return { success: false, error: `No active session found for profile ${params.idProfile}` };
            }
            const url = `${this.baseUrl}/api/send-sticker`;
            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cookie': session.cookies,
                'Referer': `${this.baseUrl}/chat/${params.idProfile}_${params.idRegularUser}`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            };
            const payload = {
                idProfile: params.idProfile,
                idRegularUser: params.idRegularUser,
                stickerId: params.stickerId,
                stickerUrl: params.stickerUrl
            };
            console.log(`🌐 Sending sticker request to ${url}`, payload);
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Sticker send failed with status ${response.status}:`, errorText);
                return { success: false, error: `HTTP ${response.status}: ${errorText}` };
            }
            const result = await response.json();
            console.log(`✅ Sticker sent successfully:`, result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error(`💥 Error sending sticker:`, error);
            return { success: false, error: error.message };
        }
    }
    async getVirtualGiftLimits(profileId, clientId) {
        console.log(`🎁 TalkyTimes.getVirtualGiftLimits: profileId=${profileId}, clientId=${clientId}, isMock=${this.isMock()}`);
        if (this.isMock()) {
            console.log(`🎭 Mock mode: generating gift limits for profile ${profileId} and client ${clientId}`);
            const mockLimits = {
                limit: Math.floor(Math.random() * 20) + 1,
                canSendWithoutLimit: Math.random() > 0.8
            };
            return { success: true, data: mockLimits };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/virtual-gift/limit/get';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${clientId}`;
            console.log(`🚀 TalkyTimes get gift limits request for profile ${profileId}:`, {
                profileId,
                clientId,
                url,
                referer: headers['referer']
            });
            const requestBody = {
                idUserFrom: parseInt(profileId),
                idUserTo: clientId
            };
            console.log(`📤 Request body:`, requestBody);
            console.log(`📋 Full headers:`, headers);
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes get gift limits API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const result = await res.json();
            console.log(`📥 TalkyTimes get gift limits response for profile ${profileId}:`, result);
            if (result && typeof result.limit === 'number' && typeof result.canSendWithoutLimit === 'boolean') {
                return { success: true, data: result };
            }
            else {
                return { success: false, error: 'Invalid response format' };
            }
        }
        catch (error) {
            console.error('TalkyTimes getVirtualGiftLimits error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async sendStickerById(profileId, interlocutorId, stickerId) {
        console.log(`😀 TalkyTimes.sendStickerById: profile ${profileId} → user ${interlocutorId}, sticker ${stickerId}`);
        if (this.isMock()) {
            return {
                success: true,
                data: {
                    messageId: `sticker-msg-${Date.now()}`,
                    stickerId: stickerId
                }
            };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/chat/send/sticker';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${interlocutorId}`;
            console.log(`🚀 TalkyTimes send sticker request for profile ${profileId}:`, {
                profileId,
                interlocutorId,
                stickerId,
                url,
                referer: headers['referer']
            });
            const requestBody = {
                idSticker: stickerId,
                idRegularUser: interlocutorId
            };
            console.log(`📤 Request body:`, requestBody);
            console.log(`📋 Full headers:`, headers);
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes send sticker API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const result = await res.json();
            console.log(`📥 TalkyTimes send sticker response for profile ${profileId}:`, result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error(`💥 Error sending sticker by ID:`, error);
            return { success: false, error: error.message };
        }
    }
    async sendExclusivePost(profileId, idRegularUser, payload) {
        try {
            if (this.isMock()) {
                return { success: true, data: { idMessage: `mock-exclusive-${Date.now()}` } };
            }
            const session = await this.sessionService.getSession(profileId.toString());
            if (!session) {
                return { success: false, error: `No active session for profile ${profileId}` };
            }
            const url = 'https://talkytimes.com/platform/chat/send/new-post';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${idRegularUser}/posts`;
            const body = {
                idRegularUser,
                idsGalleryPhotos: payload.idsGalleryPhotos || [],
                idsGalleryVideos: payload.idsGalleryVideos || [],
                text: payload.text || ''
            };
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                timeoutMs: 20000,
                maxRetries: 1
            });
            if (!res.ok) {
                const errorText = await res.text();
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const data = await res.json();
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getVirtualGiftList(profileId, clientId, cursor = '', limit = 30) {
        console.log(`🎁 TalkyTimes.getVirtualGiftList: profileId=${profileId}, clientId=${clientId}, cursor=${cursor}, limit=${limit}, isMock=${this.isMock()}`);
        if (this.isMock()) {
            console.log(`🎭 Mock mode: generating gift list for profile ${profileId} and client ${clientId}`);
            const mockItems = [
                {
                    id: 1180,
                    cost: 3340,
                    name: "Ocean diamond",
                    imageSrc: "https://picsum.photos/100/100?random=diamond",
                    animationSrc: null,
                    category: { id: 74, name: "Labor Day in the U.S." },
                    gender: "female"
                },
                {
                    id: 1181,
                    cost: 4490,
                    name: "Forever mine ring",
                    imageSrc: "https://picsum.photos/100/100?random=ring",
                    animationSrc: null,
                    category: { id: 74, name: "Labor Day in the U.S." },
                    gender: "female"
                },
                {
                    id: 1182,
                    cost: 95,
                    name: "Fresh XL bouquet",
                    imageSrc: "https://picsum.photos/100/100?random=flowers",
                    animationSrc: null,
                    category: { id: 75, name: "Flowers" },
                    gender: "unisex"
                },
                {
                    id: 1183,
                    cost: 1090,
                    name: "Floral symphony",
                    imageSrc: "https://picsum.photos/100/100?random=floral",
                    animationSrc: null,
                    category: { id: 75, name: "Flowers" },
                    gender: "female"
                },
                {
                    id: 1184,
                    cost: 240,
                    name: "Hair styling set",
                    imageSrc: "https://picsum.photos/100/100?random=hair",
                    animationSrc: null,
                    category: { id: 75, name: "Beauty" },
                    gender: "female"
                },
                {
                    id: 1185,
                    cost: 89,
                    name: "Glam bag",
                    imageSrc: "https://picsum.photos/100/100?random=bag",
                    animationSrc: null,
                    category: { id: 75, name: "Beauty" },
                    gender: "female"
                },
                {
                    id: 1186,
                    cost: 690,
                    name: "Eagle power",
                    imageSrc: "https://picsum.photos/100/100?random=eagle",
                    animationSrc: null,
                    category: { id: 77, name: "Animals" },
                    gender: "male"
                },
                {
                    id: 1187,
                    cost: 289,
                    name: "I heart you!",
                    imageSrc: null,
                    animationSrc: "https://i.gstatvb.com/1b9c94ba16c5a89a891483b104a276581675182874.rng.json",
                    category: { id: 7, name: "animated" },
                    gender: null
                },
                {
                    id: 1188,
                    cost: 450,
                    name: "Dancing cat",
                    imageSrc: "https://picsum.photos/100/100?random=cat",
                    animationSrc: "https://picsum.photos/100/100?random=dancing",
                    category: { id: 7, name: "animated" },
                    gender: "unisex"
                },
                {
                    id: 1189,
                    cost: 320,
                    name: "Sparkling heart",
                    imageSrc: null,
                    animationSrc: "https://picsum.photos/100/100?random=sparkle",
                    category: { id: 7, name: "animated" },
                    gender: "unisex"
                }
            ];
            const mockCursor = cursor ? parseInt(cursor) + 10 : "35";
            return {
                success: true,
                data: {
                    cursor: mockCursor.toString(),
                    items: mockItems.slice(0, limit)
                }
            };
        }
        let session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/virtual-gift/gift/list';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/chat/${profileId}_${clientId}`;
            console.log(`🚀 TalkyTimes get gift list request for profile ${profileId}:`, {
                profileId,
                clientId,
                cursor,
                limit,
                url,
                referer: headers['referer']
            });
            const requestBody = {
                limit,
                cursor: cursor || '',
                idRegularUser: clientId
            };
            console.log(`📤 Request body:`, requestBody);
            console.log(`📋 Full headers:`, headers);
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes get gift list API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const result = await res.json();
            console.log(`📥 TalkyTimes get gift list response for profile ${profileId}:`, result);
            if (result && result.items && Array.isArray(result.items)) {
                console.log(`🎁 Processing ${result.items.length} gift items`);
                result.items.slice(0, 3).forEach((item, index) => {
                    console.log(`🎁 Item ${index + 1}: ${item.name}, imageSrc: ${item.imageSrc}`);
                });
            }
            if (result && result.items && Array.isArray(result.items)) {
                return { success: true, data: result };
            }
            else {
                return { success: false, error: 'Invalid response format' };
            }
        }
        catch (error) {
            console.error('TalkyTimes getVirtualGiftList error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getEmailHistory(profileId, clientId, correspondenceId, page = 1, limit = 10) {
        try {
            console.log(`📧 TalkyTimes.getEmailHistory: profileId=${profileId}, clientId=${clientId}, correspondenceId=${correspondenceId}, page=${page}, limit=${limit}, isMock=${this.isMock()}`);
            if (this.isMock()) {
                console.log(`🎭 Mock mode: simulating email history for profile ${profileId} with client ${clientId}`);
                await new Promise(resolve => setTimeout(resolve, 500));
                const mockEmails = [
                    {
                        id: "9085270527",
                        id_user_from: profileId,
                        id_user_to: clientId.toString(),
                        id_correspondence: correspondenceId,
                        content: "<p>Привіт! Як справи?</p>",
                        date_created: new Date().toISOString(),
                        date_read: new Date().toISOString(),
                        is_paid: false,
                        is_sent: "1",
                        is_deleted: "0",
                        status: "read",
                        title: "Привітання",
                        attachments: {
                            images: [
                                {
                                    id: "img_12345",
                                    url_thumbnail: "https://talkytimes.com/uploads/images/thumbnail_12345.jpg",
                                    url_original: "https://talkytimes.com/uploads/images/original_12345.jpg"
                                },
                                {
                                    id: "img_67890",
                                    url_thumbnail: "https://talkytimes.com/uploads/images/thumbnail_67890.jpg",
                                    url_original: "https://talkytimes.com/uploads/images/original_67890.jpg"
                                }
                            ],
                            videos: []
                        }
                    }
                ];
                return {
                    success: true,
                    data: {
                        status: "success",
                        history: mockEmails,
                        limit: limit,
                        page: page
                    }
                };
            }
            const session = await this.sessionService.getSession(profileId);
            if (!session) {
                throw new Error('Failed to get session for profile');
            }
            if (!session.cookies) {
                throw new Error('Session cookies are missing');
            }
            const url = 'https://talkytimes.com/platform/correspondence/emails-history';
            const payload = {
                page: page,
                limit: limit,
                id_correspondence: correspondenceId,
                id_interlocutor: clientId,
                id_user: parseInt(profileId),
                without_translation: false
            };
            console.log(`📧 Making API request to: ${url}`);
            console.log(`📧 Payload:`, JSON.stringify(payload, null, 2));
            const headers = {
                'accept': 'application/json',
                'accept-language': 'en-US,en;q=0.9',
                'baggage': 'sentry-environment=PROD,sentry-release=PROD%3A68578-1-71d5,sentry-public_key=36f772c5edd5474cbfbbc825a80816b8,sentry-trace_id=a494bc58364b41d89afcab5b46233489,sentry-sampled=false,sentry-sample_rand=0.38253945589427885,sentry-sample_rate=0.0001',
                'content-type': 'application/json',
                'origin': 'https://talkytimes.com',
                'priority': 'u=1, i',
                'referer': `https://talkytimes.com/mails/view/${profileId}_${clientId}`,
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'sentry-trace': 'a494bc58364b41d89afcab5b46233489-b3d30c6c2f41a5f9-0',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'x-requested-with': '2055',
                'Cookie': session.cookies
            };
            await this.applyOperatorRefHeader(headers, { profileId });
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                timeoutMs: DEFAULT_TIMEOUT_MS
            });
            console.log(`📧 TalkyTimes getEmailHistory response:`, response.status);
            const responseData = await response.json();
            return {
                success: true,
                data: responseData
            };
        }
        catch (error) {
            console.error('TalkyTimes getEmailHistory error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getForbiddenCorrespondenceTags(profileId, idInterlocutor) {
        try {
            console.log(`⚠️ TalkyTimes.getForbiddenCorrespondenceTags: profileId=${profileId}, idInterlocutor=${idInterlocutor}, isMock=${this.isMock()}`);
            if (this.isMock()) {
                const tags = Math.random() < 0.3 ? ['special_plus'] : [];
                return { success: true, tags };
            }
            const session = await this.sessionService.getSession(profileId.toString());
            if (!session) {
                return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
            }
            const url = 'https://talkytimes.com/platform/correspondence/video/forbidden-tags';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/user/${String(idInterlocutor).padStart(12, '0')}`;
            const payload = { idInterlocutor };
            console.log('⚠️ Forbidden-tags request:', { url, headers: { ...headers, Cookie: '***' }, payload });
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                timeoutMs: 15000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ Forbidden-tags API error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId.toString());
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const data = await res.json();
            const tags = Array.isArray(data) ? data.filter((x) => typeof x === 'string') : [];
            return { success: true, tags };
        }
        catch (error) {
            console.error('TalkyTimes.getForbiddenCorrespondenceTags error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async sendLetter(profileId, idUserTo, payload) {
        try {
            console.log('✉️ TalkyTimes.sendLetter:', { profileId, idUserTo, textLen: payload.content?.length, photos: payload.photoIds?.length || 0, videos: payload.videoIds?.length || 0, isMock: this.isMock() });
            if (this.isMock()) {
                return { success: true, data: { status: 'success', details: [] } };
            }
            const session = await this.sessionService.getSession(profileId.toString());
            if (!session) {
                return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
            }
            const url = 'https://talkytimes.com/platform/correspondence/send-letter';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = `https://talkytimes.com/mails/view/${profileId}_${idUserTo}`;
            const body = {
                idUserTo,
                content: payload.content,
                images: (payload.photoIds || []).slice(0, 10).map(id => ({ idPhoto: id })),
                videos: (payload.videoIds || []).slice(0, 10).map(id => ({ idVideo: id })),
            };
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                timeoutMs: 20000
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ TalkyTimes sendLetter error ${res.status}:`, errorText);
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId.toString());
                    return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
                }
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }
            const data = await res.json();
            return { success: true, data };
        }
        catch (error) {
            console.error('TalkyTimes.sendLetter error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async sendVirtualGift(profileId, clientId, giftId, message = '') {
        try {
            console.log(`🎁 TalkyTimes.sendVirtualGift: profileId=${profileId}, clientId=${clientId}, giftId=${giftId}, message="${message}", isMock=${this.isMock()}`);
            if (this.isMock()) {
                console.log(`🎭 Mock mode: simulating gift send for profile ${profileId} to client ${clientId}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return {
                    success: true,
                    data: {
                        success: true,
                        message: `Подарунок успішно відправлено! Повідомлення: "${message || 'Без повідомлення'}"`,
                        giftId,
                        timestamp: new Date().toISOString()
                    }
                };
            }
            const session = await this.sessionService.getSession(profileId);
            if (!session) {
                throw new Error('Failed to get session for profile');
            }
            const url = 'https://talkytimes.com/platform/virtual-gift/send';
            const payload = {
                idUserTo: clientId,
                idGift: giftId,
                message: message || 'kiss'
            };
            console.log(`🎁 Making API request to: ${url}`);
            console.log(`🎁 Payload:`, JSON.stringify(payload, null, 2));
            const vgHeaders = {
                'accept': 'application/json',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'origin': 'https://talkytimes.com',
                'referer': `https://talkytimes.com/virtual-gifts/buy/000${clientId}/cart/checkout`,
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'Cookie': session.cookies
            };
            await this.applyOperatorRefHeader(vgHeaders, { profileId });
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: vgHeaders,
                body: JSON.stringify(payload),
                timeoutMs: DEFAULT_TIMEOUT_MS
            });
            console.log(`🎁 TalkyTimes sendVirtualGift response:`, response.status);
            const responseData = await response.json();
            return {
                success: true,
                data: responseData
            };
        }
        catch (error) {
            console.error('TalkyTimes sendVirtualGift error:', error);
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getTtRestrictions(ctx, profileId, idInterlocutor) {
        try {
            console.log('⚡ TalkyTimes.getTtRestrictions: profileId=', profileId, 'idInterlocutor=', idInterlocutor, 'isMock=', this.isMock());
            if (this.isMock()) {
                return {
                    success: true,
                    hasExclusivePosts: true,
                    categories: ['erotic', 'special', 'special_plus', 'limited']
                };
            }
            const session = await this.sessionService.getSession(profileId.toString());
            if (!session) {
                throw new Error(`No session found for profile ${profileId}`);
            }
            console.log(`✅ Session found for profile ${profileId}, expires at ${session.expiresAt}`);
            const body = this.createGetRestrictionsBody(idInterlocutor);
            const url = `${this.baseUrl}/platform/core.api.platform.chat.DialogService/GetRestrictions`;
            const referer = `${this.baseUrl}/chat/${profileId}_${idInterlocutor}`;
            console.log('🚀 TalkyTimes get restrictions request for profile', profileId, ':', {
                profileId: profileId.toString(),
                idInterlocutor,
                url,
                referer
            });
            const headers = {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/grpc-web+proto',
                'x-grpc-web': '1',
                'x-user-agent': 'connect-es/2.0.2',
                'cookie': session.cookies,
                'referer': referer,
                'origin': 'https://talkytimes.com'
            };
            await this.applyOperatorRefHeader(headers, { profileId });
            console.log('📤 Request body length:', body.length, 'bytes');
            console.log('📋 Full headers:', headers);
            const response = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
                timeoutMs: 15000,
                maxRetries: 2
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const responseBuffer = await response.arrayBuffer();
            const parsed = this.parseGetRestrictionsResponse(new Uint8Array(responseBuffer));
            const counts = {};
            for (const c of parsed.allCategories || parsed.categories) {
                counts[c] = (counts[c] || 0) + 1;
            }
            let tier = undefined;
            if (parsed.hasExclusivePosts) {
                tier = parsed.hasExtendedTags ? 'special' : 'specialplus';
            }
            return {
                success: true,
                hasExclusivePosts: parsed.hasExclusivePosts,
                categories: parsed.categories,
                categoryCounts: counts,
                tier
            };
        }
        catch (error) {
            console.error('⚡ TalkyTimes getTtRestrictions error:', error);
            return {
                success: false,
                error: error.message || 'Unknown error',
                hasExclusivePosts: false,
                categories: []
            };
        }
    }
    createGetRestrictionsBody(dialogId) {
        const varintBytes = this.encodeVarint(dialogId);
        const payload = new Uint8Array(1 + varintBytes.length);
        payload[0] = 0x08;
        payload.set(varintBytes, 1);
        const result = new Uint8Array(5 + payload.length);
        result[4] = payload.length;
        result.set(payload, 5);
        return result;
    }
    encodeVarint(value) {
        const bytes = [];
        while (value >= 0x80) {
            bytes.push((value & 0xFF) | 0x80);
            value >>>= 7;
        }
        bytes.push(value & 0xFF);
        return new Uint8Array(bytes);
    }
    decodeVarint(bytes, offset = 0) {
        let value = 0;
        let shift = 0;
        let bytesRead = 0;
        for (let i = offset; i < bytes.length; i++) {
            const byte = bytes[i];
            bytesRead++;
            value |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0)
                break;
            shift += 7;
        }
        return { value, bytesRead };
    }
    parseGetRestrictionsResponse(bytes) {
        let offset = 5;
        const result = {
            hasExclusivePosts: false,
            categories: [],
            allCategories: [],
            hasExtendedTags: false
        };
        while (offset < bytes.length - 20) {
            if (offset >= bytes.length)
                break;
            const tag = bytes[offset];
            if (tag === 0x08) {
                const { value } = this.decodeVarint(bytes, offset + 1);
                result.hasExclusivePosts = value === 1;
                offset += 2;
            }
            else if (tag === 0x12 || tag === 0x1a || tag === 0x22 || tag === 0x2a) {
                if (tag === 0x22 || tag === 0x2a)
                    result.hasExtendedTags = true;
                if (offset + 1 >= bytes.length)
                    break;
                const length = bytes[offset + 1];
                if (offset + 2 + length > bytes.length)
                    break;
                const categoryBytes = bytes.slice(offset + 2, offset + 2 + length);
                const category = new TextDecoder().decode(categoryBytes);
                if (category) {
                    result.allCategories.push(category);
                    if (!result.categories.includes(category))
                        result.categories.push(category);
                }
                offset += 2 + length;
            }
            else {
                offset++;
            }
        }
        return result;
    }
    async fetchMyPublicProfile(profileId) {
        if (this.isMock()) {
            return {
                success: true,
                profileData: {
                    personal: {
                        name: 'Мій профіль',
                        age: 28,
                        city: 'Київ',
                        country: 'Україна',
                        gender: 'male',
                        description: 'Це мій профіль для тестування',
                        avatar_xl: 'https://picsum.photos/592/538?random=myprofile'
                    },
                    preferences: {
                        gender: 'female',
                        age_from: 20,
                        age_to: 35
                    },
                    is_online: true,
                    last_visit: new Date().toISOString(),
                    date_created: new Date().toISOString()
                }
            };
        }
        const session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/private/personal-profile';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = 'https://talkytimes.com/my/profile';
            headers['origin'] = 'https://talkytimes.com';
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                timeoutMs: 15000,
                maxRetries: 2
            });
            if (!res.ok) {
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                }
                const text = await res.text();
                return { success: false, error: `HTTP ${res.status}: ${text}` };
            }
            const data = await res.json();
            return { success: true, profileData: data };
        }
        catch (error) {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async fetchMyPhotos(profileId) {
        if (this.isMock()) {
            return {
                success: true,
                data: {
                    public: [
                        {
                            id: 1,
                            url_xl: 'https://picsum.photos/300/300?random=my1',
                            url_large: 'https://picsum.photos/200/200?random=my1',
                            url_medium: 'https://picsum.photos/150/150?random=my1',
                            url_small: 'https://picsum.photos/100/100?random=my1',
                            url_xs: 'https://picsum.photos/50/50?random=my1',
                            url_original: 'https://picsum.photos/800/600?random=my1',
                            is_main: 1,
                            isMain: 1,
                            is_hidden: false
                        },
                        {
                            id: 2,
                            url_xl: 'https://picsum.photos/300/300?random=my2',
                            url_large: 'https://picsum.photos/200/200?random=my2',
                            url_medium: 'https://picsum.photos/150/150?random=my2',
                            url_small: 'https://picsum.photos/100/100?random=my2',
                            url_xs: 'https://picsum.photos/50/50?random=my2',
                            url_original: 'https://picsum.photos/800/600?random=my2',
                            is_main: 0,
                            isMain: 0,
                            is_hidden: false
                        }
                    ],
                    private: []
                }
            };
        }
        const session = await this.sessionService.getSession(profileId);
        if (!session) {
            return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
        }
        try {
            const url = 'https://talkytimes.com/platform/private/my-photos';
            const headers = this.sessionService.getRequestHeaders(session);
            await this.applyOperatorRefHeader(headers, { profileId });
            headers['referer'] = 'https://talkytimes.com/my/photos';
            headers['origin'] = 'https://talkytimes.com';
            const res = await this.fetchWithConnectionPool(url, {
                method: 'POST',
                headers,
                timeoutMs: 15000,
                maxRetries: 2
            });
            if (!res.ok) {
                if (res.status === 401) {
                    await this.sessionService.removeSession(profileId);
                }
                const text = await res.text();
                return { success: false, error: `HTTP ${res.status}: ${text}` };
            }
            const data = await res.json();
            return { success: true, data: data?.data ?? data };
        }
        catch (error) {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
    async getPostDetails(idPost, idProfile, idInterlocutor, ctx) {
        try {
            const session = await this.sessionService.getSession(String(idProfile));
            if (!session)
                throw new Error(`Session not found for profile ${idProfile}`);
            const url = `https://talkytimes.com/platform/chat/dialog/post`;
            const headers = this.sessionService.getRequestHeaders(session);
            headers['referer'] = `https://talkytimes.com/chat/${idProfile}_${idInterlocutor}/post/${idPost}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idPost,
                    idInterlocutor,
                    withoutTranslation: true
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log('✅ TalkyTimes getPostDetails success:', { idPost, idProfile, idInterlocutor, hasPhotos: data.photos?.length || 0, hasVideos: data.videos?.length || 0 });
            return data;
        }
        catch (error) {
            console.error('❌ TalkyTimes getPostDetails error:', error);
            throw error;
        }
    }
}
exports.TalkyTimesProvider = TalkyTimesProvider;
//# sourceMappingURL=talkytimes.provider.js.map