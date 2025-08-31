// Тимчасові утиліти для дебагу
export function clearAuthToken() {
  console.log('🧹 Очищаю токен автентифікації...');
  localStorage.removeItem('anchat-auth');
  console.log('✅ Токен очищено. Перенаправляю на логін...');
  window.location.href = '/login';
}

export function inspectAuthToken() {
  const token = localStorage.getItem('anchat-auth');
  console.log('🔍 Інспекція токена:');
  
  if (!token) {
    console.log('❌ Токен відсутній');
    return;
  }
  
  try {
    const parsed = JSON.parse(token);
    console.log('✅ Токен успішно розпарсений:', {
      hasAccessToken: !!parsed.accessToken,
      tokenLength: parsed.accessToken?.length || 0,
      role: parsed.role,
      agencyCode: parsed.agencyCode,
      operatorCode: parsed.operatorCode
    });
    
    if (parsed.accessToken) {
      const parts = parsed.accessToken.split('.');
      console.log('🔍 JWT структура:', {
        partsCount: parts.length,
        isValid: parts.length === 3,
        header: parts[0] ? `${parts[0].substring(0, 20)}...` : 'missing',
        payload: parts[1] ? `${parts[1].substring(0, 20)}...` : 'missing',
        signature: parts[2] ? `${parts[2].substring(0, 20)}...` : 'missing'
      });
    }
  } catch (e) {
    console.error('❌ Помилка парсингу токена:', e);
    console.log('🧹 Рекомендую очистити токен: clearAuthToken()');
  }
}

// Додаємо функції в глобальний об'єкт для доступу з консолі
if (typeof window !== 'undefined') {
  (window as any).clearAuthToken = clearAuthToken;
  (window as any).inspectAuthToken = inspectAuthToken;
  console.log('🛠️ Debug утиліти доступні: clearAuthToken(), inspectAuthToken()');
}
