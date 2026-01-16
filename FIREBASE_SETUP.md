# Инструкция по настройке Firebase

## Шаг 1: Получение конфигурации Firebase

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Выберите ваш проект (или создайте новый)
3. Нажмите на иконку настроек ⚙️ → **Project Settings**
4. Прокрутите вниз до раздела **Your apps**
5. Если вы еще не добавили веб-приложение:
   - Нажмите на иконку **</>** (Web)
   - Введите название приложения (например, "L Clasico")
   - Нажмите **Register app**
6. Скопируйте значения из **Firebase SDK snippet** → **Config**

## Шаг 2: Обновление firebase-config.js

Откройте файл `firebase-config.js` и замените значения в объекте `firebaseConfig`:

```javascript
const firebaseConfig = {
    apiKey: "ВАШ_API_KEY",
    authDomain: "ваш-проект.firebaseapp.com",
    projectId: "ваш-проект",
    storageBucket: "ваш-проект.appspot.com",
    messagingSenderId: "ВАШ_SENDER_ID",
    appId: "ВАШ_APP_ID"
};
```

## Шаг 3: Настройка Firestore Database

1. В Firebase Console перейдите в **Firestore Database**
2. Нажмите **Create database**
3. Выберите режим:
   - **Start in test mode** (для разработки) - данные будут доступны всем на 30 дней
   - **Start in production mode** (для продакшена) - нужно настроить правила безопасности
4. Выберите регион (например, `europe-west`)
5. Нажмите **Enable**

## Шаг 4: Настройка правил безопасности (опционально)

Для продакшена настройте правила в **Firestore Database** → **Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Разрешить всем читать матчи
    match /matches/{matchId} {
      allow read: if true;
      allow write: if false; // Только через админку
    }
  }
}
```

## Шаг 5: Тестирование

1. Откройте `index.html` в браузере
2. Откройте консоль разработчика (F12)
3. Проверьте, что нет ошибок Firebase
4. Откройте приложение в двух разных вкладках
5. Войдите в админку в одной вкладке и добавьте матч
6. Убедитесь, что изменения мгновенно отображаются во второй вкладке

## Возможные проблемы

### Ошибка: "Firebase not initialized"
- Проверьте, что вы правильно заполнили `firebase-config.js`
- Убедитесь, что файлы загружаются в правильном порядке в `index.html`

### Ошибка: "Missing or insufficient permissions"
- Проверьте правила безопасности в Firestore
- Для тестирования используйте "test mode"

### Данные не синхронизируются
- Проверьте подключение к интернету
- Откройте консоль и проверьте наличие ошибок
- Убедитесь, что Firestore Database создана и активна
