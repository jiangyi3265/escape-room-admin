# escape-room-admin

密室逃脱门店项目的 Web 管理后台，提供门店运营页面，以及账号、角色权限及系统运维管理界面。

## 项目简介

基于若依 Vue 3 管理端。门店运营页面（`src/views/escape/`，调用后端 `/escape/**`）面向不懂技术的操作员：

- 门店概览（首页）：今日收款、待办、近 7 日收款图表、订单现场、积分排行、最近消息，每 30 秒自动刷新
- 订单与收款：订单管理（详情抽屉里可代为推进流程、登记/修改收款、修正节点、取消、删除）、收款台账（明细、合计、每日汇总）
- 积分与任务：打扫审核、积分明细（调整、撤销）、临时任务、积分任务设置
- 门店管理：员工管理、主题管理、维修登记、门店消息、操作记录、门店设置

菜单与按钮权限来自后端 `sys_menu`（`escape:*` 权限）。若依原有的用户、角色、菜单、字典、监控等页面源码仍保留；源码里的定时任务、代码生成等页面对应的后端模块默认未启用，使用前需完成模块配置。

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

三个仓库属于密室逃脱门店项目。当前后台的门店运营页面使用后端 `/escape/**`，系统管理页面使用若依的系统管理 API；门店端的对接情况以 escape-room-app 仓库说明为准，微信订阅通知另有云函数支持。

## 快速启动

使用 Node.js 20+ 与 npm，先启动后端和其 MySQL / Redis 依赖。

```bash
npm install
cp .env.development.example .env.development
cp .env.production.example .env.production
cp .env.staging.example .env.staging
npm run dev
```

Windows PowerShell 可用 `Copy-Item` 复制文件；若本地环境文件已经存在则保留原配置。开发服务器配置写在 `.env.development`：`VITE_DEV_PORT`（端口，默认 `80`）、`VITE_PROXY_TARGET`（`/dev-api` 转发到的后端地址，默认 `http://localhost:8080`）、`VITE_OPEN_BROWSER`（启动时是否打开浏览器，默认 `true`）。也可临时指定端口：`npm run dev -- --port 5173`。

`VITE_APP_TITLE` 设置标题，`VITE_APP_BASE_API` 设置 API 路径。生产与预发布使用 `/prod-api`、`/stage-api`，部署服务器需配置反向代理。所有 `VITE_*` 值会进入前端构建产物，不能填写服务端密码或私钥。

```bash
npm run build:prod
npm run build:stage
npm run preview
```

构建输出为 `dist/`。使用后端自行初始化的账号登录；登录页不预填密码，“记住账号”仅保存用户名，并清理旧版本保存的密码 Cookie。仓库不包含前端解密私钥。

## 项目结构

```text
src/api/          登录、系统管理及监控接口；escape/ 为门店运营接口
src/views/        系统管理、监控、登录与工具页面；index.vue 为门店概览
src/views/escape/ 门店运营页面、共用组件（components/）与共用工具（shared.js、escape.scss）
src/router/       路由定义
src/store/        Pinia 用户、权限、字典和界面状态
src/layout/       导航、侧栏、标签栏和主布局
src/components/   表格、上传、字典等通用组件
src/directive/    角色与权限指令
src/utils/        请求、认证、校验及通用工具
vite/plugins/     构建插件
public/           公共静态资源
tests/            界面验收脚本（截图输出到 tests/screenshots/，不入库）
```

## 界面验收

需要后端（默认 `http://127.0.0.1:8087`）、开发服务器（默认 `http://127.0.0.1:8097`）和本机 Redis（读取登录验证码），并使用全局安装的 Playwright 与系统 Edge：

```bash
node tests/admin-ui.mjs          # HEADED=1 可看到浏览器操作过程
```

脚本通过登录页登录，逐页检查表头、控制台错误和界面文案，并实际操作发通知、主题增删、临时任务发布与取消、订单代推进与收款等；测试数据带时间戳，可重复运行。

## 简历描述示例

参与密室逃脱项目管理后台建设，基于 Vue 3、Pinia 与 Element Plus 实现用户、角色、菜单及系统监控界面，通过动态路由、按钮权限与 Axios 请求封装对接若依后端。

## 开源说明

基于 RuoYi-Vue3，保留原项目 MIT `LICENSE` 和代码署名。环境文件仅保存在本地，仓库提供无敏感信息的 `.example` 模板。
