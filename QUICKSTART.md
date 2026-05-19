# 🚀 Быстрый старт Confluence MCP

## Статус установки

✅ **MCP сервер установлен в user scope** - доступен во всех проектах Claude Code!

## 🎯 Как использовать

### В Claude Code чате

Просто начните разговор и используйте команды на естественном языке:

```
Покажи мне список моих Confluence spaces
Найди все страницы про "API documentation"
Создай новую страницу в space AIN с заголовком "Test Page"
Прочитай содержимое страницы с ID 99975794
Добавь метки "documentation" и "api" к странице 99975794
```

### Доступные инструменты

MCP предоставляет следующие инструменты:

1. **confluence_search** - поиск по CQL
2. **confluence_list_spaces** - список всех spaces
3. **confluence_get_page** - получить страницу по ID
4. **confluence_get_page_by_title** - найти страницу по названию
5. **confluence_get_space** - информация о space
6. **confluence_create_page** - создать новую страницу
7. **confluence_update_page** - обновить существующую страницу
8. **confluence_add_labels** - добавить метки
9. **confluence_get_attachments** - список вложений

## 🔧 Управление

### Проверить статус
```bash
npm run status
# или
claude mcp list
```

### Тестировать API подключение
```bash
npm run test:api
```

### Тестировать MCP протокол
```bash
npm test
```

### Переустановить (если нужно)
```bash
npm run uninstall:user
npm run install:user
```

### Удалить
```bash
npm run uninstall:user
# или
claude mcp remove confluence -s user
```

## 📝 Примеры использования

### Поиск страниц
```
Найди все страницы про "API" в Confluence
```

### Создание страницы
```
Создай страницу в space AIN:
- Заголовок: "API Guidelines"
- Содержимое: основные принципы дизайна API
```

### Обновление страницы
```
Обнови страницу 99975794, добавь секцию про аутентификацию
```

### Работа с метками
```
Добавь метки "backend", "api", "documentation" к странице 99975794
```

## 🔗 Полезные ссылки

- **Confluence**: https://arlo.atlassian.net/wiki
- **API Documentation**: https://developer.atlassian.com/cloud/confluence/rest/
- **CQL Reference**: https://developer.atlassian.com/server/confluence/advanced-searching-using-cql/

## ⚙️ Конфигурация

MCP настроен в `~/.claude.json` со следующими параметрами:

- **Site**: arlo.atlassian.net
- **Email**: gkravchunas@arlo.com
- **API Token**: ••••••••••••

Для обновления токена:
1. Создайте новый токен: https://id.atlassian.com/manage-profile/security/api-tokens
2. Обновите `.env` в этой директории
3. Переустановите: `npm run uninstall:user && npm run install:user`

## 🎨 Следующие шаги

- [ ] Добавить поддержку Mermaid диаграмм
- [ ] Добавить поддержку Draw.io диаграмм
- [ ] Добавить upload изображений
- [ ] Добавить работу с комментариями
