# escape-room-admin

密室逃脱门店项目的 Web 管理后台，提供账号、角色权限及系统运维管理界面。

## 项目简介

基于若依 Vue 3 管理端，现有页面涵盖用户、角色、菜单、部门、岗位、字典、参数配置、公告、操作日志、登录日志、在线用户、服务监控和缓存监控。使用 Axios 调用 `escape-room-backend`，结合动态路由与权限指令控制菜单和按钮访问。

目前没有门店订单、积分或收款专用管理页面。源码保留定时任务、代码生成等页面，但对应后端模块默认未启用，使用前需完成模块配置。

## 技术栈

- Vue 3.5、JavaScript（业务源码为 JS / Vue 单文件组件）
- Vite 6、Vue Router 4、Pinia 3
- Element Plus、Axios、ECharts 5
- Sass、自动导入插件、SVG 图标插件

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| escape-room-backend | 后端基础服务 | [escape-room-backend](https://github.com/jiangyi3265/escape-room-backend) |
| escape-room-admin | Web 管理后台 | [escape-room-admin](https://github.com/jiangyi3265/escape-room-admin) |
| escape-room-app | 门店员工与店长端 | [escape-room-app](https://github.com/jiangyi3265/escape-room-app) |

三个仓库属于密室逃脱门店项目。当前后台使用后端的系统管理 API；门店端的订单、积分与收款业务使用本地存储，尚未接入该 Java 后端，微信订阅通知另有云函数支持。

## 快速启动

使用 Node.js 20+ 与 npm，先启动后端和其 MySQL / Redis 依赖。

```bash
npm install
cp .env.development.example .env.development
cp .env.production.example .env.production
cp .env.staging.example .env.staging
npm run dev
```

Windows PowerShell 可用 `Copy-Item` 复制文件；若本地环境文件已经存在则保留原配置。开发服务器默认端口 `80`，`/dev-api` 由 `vite.config.js` 转发至 `http://localhost:8080`。若端口被占用，可执行 `npm run dev -- --port 5173`。

`VITE_APP_TITLE` 设置标题，`VITE_APP_BASE_API` 设置 API 路径。生产与预发布使用 `/prod-api`、`/stage-api`，部署服务器需配置反向代理。所有 `VITE_*` 值会进入前端构建产物，不能填写服务端密码或私钥。

```bash
npm run build:prod
npm run build:stage
npm run preview
```

构建输出为 `dist/`。使用后端自行初始化的账号登录；登录页不预填密码，“记住账号”仅保存用户名，并清理旧版本保存的密码 Cookie。仓库不包含前端解密私钥。

## 项目结构

```text
src/api/          登录、系统管理及监控接口
src/views/        系统管理、监控、登录与工具页面
src/router/       路由定义
src/store/        Pinia 用户、权限、字典和界面状态
src/layout/       导航、侧栏、标签栏和主布局
src/components/   表格、上传、字典等通用组件
src/directive/    角色与权限指令
src/utils/        请求、认证、校验及通用工具
vite/plugins/     构建插件
public/           公共静态资源
```

## 简历描述示例

参与密室逃脱项目管理后台建设，基于 Vue 3、Pinia 与 Element Plus 实现用户、角色、菜单及系统监控界面，通过动态路由、按钮权限与 Axios 请求封装对接若依后端。

## 开源说明

基于 RuoYi-Vue3，保留原项目 MIT `LICENSE` 和代码署名。环境文件仅保存在本地，仓库提供无敏感信息的 `.example` 模板。
