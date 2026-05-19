# 📋 Confluence MCP - Шпаргалка

## 🚀 Быстрый доступ

### В терминале
```bash
confluence-status      # Проверить статус MCP
confluence-test        # Тестировать API подключение
confluence-mcp         # Перейти в директорию проекта
```

### В Claude Code чате
Просто используйте естественный язык! MCP инструменты доступны автоматически.

---

## 📚 Примеры команд

### 🔍 Поиск и навигация

```
Покажи список всех моих Confluence spaces
```
```
Найди все страницы про "API" 
```
```
Найди страницы в space AIN про "authentication"
```
```
Покажи последние изменённые страницы
```

### 📖 Чтение контента

```
Прочитай страницу с ID 99975794
```
```
Найди и покажи страницу "API Guidelines" в space AIN
```
```
Покажи информацию о space AIN
```
```
Список всех вложений на странице 99975794
```

### ✍️ Создание контента

```
Создай новую страницу в space AIN:
- Заголовок: "REST API Design Principles"
- Добавь секции: Introduction, Best Practices, Examples
```
```
Создай страницу с документацией по новому API endpoint
```

### 🔄 Обновление контента

```
Обнови страницу 99975794 - добавь секцию про rate limiting
```
```
Измени заголовок страницы 99975794 на "Updated API Docs"
```

### 🏷️ Метки и организация

```
Добавь метки "api", "documentation", "v2" к странице 99975794
```
```
Добавь метку "deprecated" к странице 12345
```

---

## 🔧 CQL поиск (Confluence Query Language)

Используйте CQL для продвинутого поиска:

```
type=page AND title~"API"
type=page AND space=AIN
type=page ORDER BY lastmodified DESC
type=page AND label=documentation
type=page AND creator=currentUser()
```

Примеры в Claude:

```
Найди все страницы типа page с "API" в заголовке
```
```
Покажи последние 10 изменённых страниц в space AIN
```

---

## 🎨 Форматирование контента

Confluence использует Storage Format (HTML):

```html
<h1>Заголовок</h1>
<p>Параграф с <strong>жирным</strong> и <em>курсивом</em>.</p>
<ul>
  <li>Пункт списка 1</li>
  <li>Пункт списка 2</li>
</ul>
<pre><code>Код</code></pre>
```

Просто скажите Claude что хотите, и он сформатирует правильно!

---

## 🛠️ Управление MCP

### Статус
```bash
claude mcp list
npm run status
```

### Тестирование
```bash
npm run test:api        # Тест Confluence API
npm test                # Тест MCP протокола
```

### Переустановка
```bash
npm run uninstall:user
npm run install:user
```

### Удаление
```bash
claude mcp remove confluence -s user
```

---

## 📊 Типы Confluence Spaces

- **personal** - Персональные spaces пользователей
- **global** - Общие spaces компании
- **knowledge_base** - Базы знаний
- **collaboration** - Spaces для совместной работы

---

## 💡 Советы

1. **Используйте space keys** - они короче чем названия (например, "AIN" вместо "AI Innovation")
2. **Сохраняйте ID страниц** - для быстрого доступа к часто используемым страницам
3. **Используйте метки** - для организации контента
4. **CQL мощный** - изучите его для сложных поисков
5. **Версионирование** - Confluence автоматически сохраняет версии, не бойтесь обновлять

---

## 🔗 Полезные ссылки

- Ваш Confluence: https://arlo.atlassian.net/wiki
- API Docs: https://developer.atlassian.com/cloud/confluence/rest/
- CQL Guide: https://developer.atlassian.com/server/confluence/advanced-searching-using-cql/
- Storage Format: https://confluence.atlassian.com/doc/confluence-storage-format-790796544.html

---

## 🆘 Помощь

Если что-то не работает:

1. Проверьте статус: `confluence-status`
2. Тестируйте API: `confluence-test`
3. Проверьте `.env` файл с credentials
4. Переустановите MCP: `npm run uninstall:user && npm run install:user`

---

**Готово! Confluence MCP настроен и готов к использованию! 🎉**
