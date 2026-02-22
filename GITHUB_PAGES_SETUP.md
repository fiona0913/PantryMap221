# GitHub Pages 设置说明

## 快速链接

设置完成后，你的主页面链接将是：

**https://fiona0913.github.io/pantrymap/index.html**

---

## 设置步骤

### 1. 启用 GitHub Pages

1. 打开你的 GitHub 仓库：**https://github.com/fiona0913/pantrymap**
2. 点击 **Settings**（设置）
3. 左侧菜单找到 **Pages**
4. 在 **Source** 部分：
   - 选择 **GitHub Actions**（不是 Deploy from a branch）
5. 保存设置

### 2. 推送代码

我已经创建了 `.github/workflows/deploy-pages.yml` 文件，它会自动部署 `frontend` 目录到 GitHub Pages。

推送代码到 main 分支：

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "Add GitHub Pages deployment workflow"
git push
```

### 3. 等待部署完成

1. 在 GitHub 仓库页面，点击 **Actions** 标签
2. 你会看到 "Deploy to GitHub Pages" workflow 正在运行
3. 等待它完成（通常 1-2 分钟）
4. 完成后，在 **Settings → Pages** 页面会显示你的站点 URL

### 4. 访问你的页面

部署完成后，访问：

- **主页面**：https://fiona0913.github.io/pantrymap/index.html

---

## 注意事项

- 首次部署可能需要几分钟时间
- 如果看到 404，等待几分钟后刷新
- 每次推送到 `main` 分支都会自动重新部署
- 如果后端 API 在 Azure，记得在前端入口或 `index.html` 中更新 `apiBaseUrl`

---

## 如果遇到问题

1. 检查 **Settings → Pages** 是否选择了 **GitHub Actions**
2. 检查 **Actions** 标签中 workflow 是否成功运行
3. 如果失败，查看错误日志并修复
