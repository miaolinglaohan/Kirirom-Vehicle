Kirirom-Vehicle - 车辆申请登记管理系统

📖 项目简介
Kirirom-Vehicle 是一个为企业或机构设计的车辆申请登记管理系统。该项目通过微信小程序提供便捷的界面，让用户能够在线提交用车申请、预约车辆；同时为管理员提供强大的后台管理工具，包括：

申请审核：实时查看并处理用户的报备申请。
数据同步：支持批量导入（Excel/CSV）和导出数据功能。
用户管理：管理驾驶员列表、用户权限及关联信息。
车辆维护：动态更新车队状态、车型详情等基础信息。
🚀 核心功能模块
1. 用户端 (Miniprogram)
首页展示: 直观展示当前可用的车辆信息或申请入口。
申请流程：用户可填写详细的用车需求（时间、地点、用途等），系统自动进入审核流。
详情查看：支持查看个人提交历史及报送单的状态更新。
2. 管理后台 (Cloud Functions & Admin Panel)
云函数逻辑层：
submitApplication: 处理用户端发起的申请请求。
approveApplication: 后台审核通过/驳回相关业务。
importApplications / exportApplications: 支持大规模数据的批量操作。
getDriverList / get_userList: 管理员获取并维护员工/驾驶员资料。
后台管理功能：
车辆更新: 快速通过后台修改车辆模型、载重及现有状态。
用户过滤与删除：确保数据库内用户信息同步且准确。
文件处理逻辑：自动生成并处理导出文件的相关清理任务（如 adminDeleteExportFile）。
🛠 技术栈
前端: 原生微信小程序框架 (WXML, WXSS, JavaScript)
后端/基础设施: 微信云开发 (WeChat Cloud Development)
数据存储: 云数据库 (Cloud Database)
工具链: Node.js 云函数加速驱动
📂 项目结构说明
代码
· text
├── cloudfunctions/           # 云函数目录：核心业务逻辑处理（如审核、导入导出、获取列表等）
│   ├── adminDeleteExportFile/  配置并执行导出的清理操作
│   ├── submitApplication/      接收用户提交的申请单
│   └── getVehicleList/         用于后台或前台查询车辆数据
├── miniprogram/              # 微信小程序前端源码
│   ├── pages/
│   │   ├── index/         首页入口（车辆展示）
│   │   ├── apply/         用户填写申请表单
│   │   ├── admin/         管理后台主界面
│   │   ├── approve/       审核中心页面
│   │   └── detail/         详情查看
│   └── app.json            小程序基础配置（路由、窗口属性等）
├── project.config.json      微信开发者工具项目配置文件
└── README.md                当前文档
🚀 快速开始
环境准备
下载并安装 微信开放文档。
确保已开通云开发能力。
克隆仓库后，使用 npm install 安装依赖（如有相关插件）。
部署步骤
本地预览：
在微信开发者工具中打开项目。
配置好“云开发”环境地址。
云函数部署：
进入 cloudfunctions 目录，使用 npm install 安装对应的依赖包（如涉及第三方库）。
通过菜单或命令行同步/发布云函数至生产环境。
真机调试：
扫码登录，并在开发者工具中进行真实环境测试。
📝 开发规范与注意事项
API 调用：所有涉及数据库（Database）操作的操作均应通过 wx.env.miniprogram 环境判断或直接调用云函数（Cloud Functions）。
权限控制：管理端相关 API 需具备相应的鉴权逻辑，确保普通用户无法调用 admin* 开头的云函数。
文件路径：涉及到导出文件的临时路径，建议使用当前标准的云存储规范。