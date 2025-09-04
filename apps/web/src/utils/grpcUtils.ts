/**
 * Утиліти для роботи з gRPC-Web запитами до TalkTimes API
 */

/**
 * Кодує число у varint формат (protobuf)
 */
export function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  
  while (value >= 0x80) {
    bytes.push((value & 0xFF) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0xFF);
  
  return new Uint8Array(bytes);
}

/**
 * Декодує varint з байтового масиву
 */
export function decodeVarint(bytes: Uint8Array, offset = 0): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  
  for (let i = offset; i < bytes.length; i++) {
    const byte = bytes[i];
    bytesRead++;
    
    value |= (byte & 0x7F) << shift;
    
    if ((byte & 0x80) === 0) {
      break;
    }
    
    shift += 7;
  }
  
  return { value, bytesRead };
}

/**
 * Створює gRPC-Web body для GetRestrictions запиту
 */
export function createGetRestrictionsBody(idInterlocutor: number): Uint8Array {
  const varintBytes = encodeVarint(idInterlocutor);
  const payload = new Uint8Array(1 + varintBytes.length);
  
  // Protobuf тег 0x08 (field 1, varint)
  payload[0] = 0x08;
  payload.set(varintBytes, 1);
  
  // gRPC заголовок (5 байт: 4 байти нулів + розмір payload)
  const result = new Uint8Array(5 + payload.length);
  result[4] = payload.length; // Розмір payload
  result.set(payload, 5);
  
  return result;
}

/**
 * Парсить відповідь від GetRestrictions API
 */
export function parseGetRestrictionsResponse(response: ArrayBuffer): {
  hasExclusivePosts: boolean;
  categories: string[];
  rawData: Uint8Array;
} {
  const bytes = new Uint8Array(response);
  
  // Пропускаємо gRPC заголовок (перші 5 байт)
  let offset = 5;
  
  const result = {
    hasExclusivePosts: false,
    categories: [] as string[],
    rawData: bytes
  };
  
  // Парсимо protobuf поля
  while (offset < bytes.length - 20) { // Залишаємо місце для grpc-status
    if (offset >= bytes.length) break;
    
    const tag = bytes[offset];
    
    if (tag === 0x08) {
      // VARINT поле - прапорець exclusive posts
      const { value } = decodeVarint(bytes, offset + 1);
      result.hasExclusivePosts = value === 1;
      offset += 2; // Тег + 1 байт для простого varint
      
    } else if (tag === 0x12 || tag === 0x1a || tag === 0x22 || tag === 0x2a) {
      // STRING поля - категорії
      if (offset + 1 >= bytes.length) break;
      
      const length = bytes[offset + 1];
      if (offset + 2 + length > bytes.length) break;
      
      const categoryBytes = bytes.slice(offset + 2, offset + 2 + length);
      const category = new TextDecoder().decode(categoryBytes);
      
      if (category && !result.categories.includes(category)) {
        result.categories.push(category);
      }
      
      offset += 2 + length;
      
    } else {
      offset++;
    }
  }
  
  return result;
}

/**
 * Відправляє запит до нашого бекенду для перевірки TalkTimes restrictions
 */
export async function checkDialogRestrictions(profileId: number, idInterlocutor: number): Promise<{
  hasExclusivePosts: boolean;
  categories: string[];
  categoryCounts?: Record<string, number>;
  tier?: 'special' | 'specialplus';
  success: boolean;
  error?: string;
}> {
  try {
    // Імпортуємо apiPost динамічно щоб уникнути циклічних залежностей
    const { apiPost } = await import('@/lib/api');
    
    const result = await apiPost<{
      hasExclusivePosts?: boolean;
      categories?: string[];
      categoryCounts?: Record<string, number>;
      tier?: 'special' | 'specialplus';
      success?: boolean;
      error?: string;
    }>('/api/chats/tt-restrictions', { profileId, idInterlocutor });
    
    return {
      hasExclusivePosts: result.hasExclusivePosts || false,
      categories: result.categories || [],
      categoryCounts: result.categoryCounts,
      tier: result.tier,
      success: result.success !== false, // true якщо не false
      error: result.error
    };
    
  } catch (error) {
    console.error('❌ Error checking dialog restrictions:', error);
    return {
      hasExclusivePosts: false,
      categories: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Логує результати перевірки обмежень у консоль
 */
export function logRestrictionsCheck(
  idInterlocutor: number,
  result: { hasExclusivePosts: boolean; categories: string[]; success: boolean; error?: string }
) {
  const timestamp = new Date().toLocaleTimeString();
  
  if (!result.success) {
    console.log(`🚫 [${timestamp}] TalkTimes Restrictions Check FAILED for user ${idInterlocutor}:`);
    console.log(`   Error: ${result.error}`);
    return;
  }
  
  console.log(`✅ [${timestamp}] TalkTimes Restrictions Check SUCCESS for user ${idInterlocutor}:`);
  console.log(`   🎪 Exclusive Posts: ${result.hasExclusivePosts ? '⚡ ENABLED' : '❌ DISABLED'}`);
  console.log(`   📋 Categories: [${result.categories.join(', ')}]`);
  
  if (result.hasExclusivePosts) {
    console.log(`   🎯 This dialog supports EXCLUSIVE POSTS! Lightning icon will be shown.`);
  }
}
