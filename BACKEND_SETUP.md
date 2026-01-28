# 后端设置指南

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

默认配置：
- PORT=5000
- 数据库路径：`./database/pantrymap.db`

### 3. 迁移数据

将 `frontend/pantries.json` 数据导入数据库：

```bash
npm run migrate
```

这会：
- 创建数据库和表结构
- 导入所有 335 个 pantries
- 导入相关的 inventory、sensors、stats、wishlist 数据

### 4. 启动服务器

**开发模式（自动重启）：**
```bash
npm run dev
```

**生产模式：**
```bash
npm start
```

服务器将在 `http://localhost:5000` 运行

### 5. 测试 API

```bash
# 健康检查
curl http://localhost:5000/api/health

# 获取所有 pantries
curl http://localhost:5000/api/pantries

# 获取单个 pantry
curl http://localhost:5000/api/pantries/p-1

# 带筛选的查询
curl "http://localhost:5000/api/pantries?status=open&type=fridge"
```

## 📡 API 端点

### Pantries

- `GET /api/pantries` - 获取所有 pantries
  - 查询参数：
    - `status`: 筛选状态 (open/closed/low-inventory)
    - `type`: 筛选类型 (fridge/shelf/all)
    - `bounds`: 地图边界 (minLat,maxLat,minLng,maxLng)

- `GET /api/pantries/:id` - 获取单个 pantry

- `POST /api/pantries` - 创建新 pantry

- `PUT /api/pantries/:id` - 更新 pantry

- `PUT /api/pantries/:id/inventory` - 更新库存

- `PUT /api/pantries/:id/sensors` - 更新传感器数据

### Messages

- `GET /api/messages/:pantryId` - 获取 pantry 的留言

- `POST /api/messages` - 创建新留言

## 🗄️ 数据库结构

- **pantries** - 主要 pantry 信息
- **inventory** - 库存分类和数量
- **sensors** - IoT 传感器数据
- **stats** - 统计和分析数据
- **wishlist** - 愿望清单
- **messages** - 社区留言/评论

## 🔄 前端集成

前端已更新为自动使用后端 API。如果后端不可用，会自动回退到静态 JSON 文件。

API 基础 URL 在 `api.js` 中配置：
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

## 🐛 故障排除

**端口被占用：**
```bash
# 修改 .env 文件中的 PORT 值
PORT=5001
```

**数据库错误：**
```bash
# 删除数据库文件重新迁移
rm backend/database/pantrymap.db
npm run migrate
```

**CORS 错误：**
- 确保前端和后端在不同端口运行
- 后端已配置 CORS，允许所有来源

## 📝 下一步

- [ ] 添加用户认证系统
- [ ] 实现实时数据更新（WebSocket）
- [ ] 添加数据验证和错误处理
- [ ] 部署到生产环境（PostgreSQL/MySQL）
- [ ] 添加 API 文档（Swagger）


