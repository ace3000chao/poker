# 前端(React + Vite + Tailwind)

脚手架文件已手写完成。**dev 本地机无外网,无法 `npm install`**。

依赖安装二选一(待定,见项目记忆 frontend-offline-blocker):
1. 在测试服务器 106.55.169.208(有外网)`npm install` 后回传 `node_modules`/构建产物
2. 配置国内镜像源:`npm config set registry https://registry.npmmirror.com` 再试

安装后:

```bash
npm install
npm run dev      # 开发服务器 :5173,/api 代理到 :5000 Flask
npm run build    # 生产构建到 dist/
```

技术基线:React 18 + React Router 6 + Vite 5 + Tailwind 3,移动端优先。
