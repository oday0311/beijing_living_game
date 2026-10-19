# 北京浮生记（网页改编）

原作由郭祥昊于 2000 至 2001 年创作。本项目是 2026 年完成的单人网页改编，包含经典模式与新北京模式。游戏共 40 天，可以在行情中买卖、访问城市服务并换站推进日期；新北京模式还提供身份、电子钱包、天气和信用机制。

## 运行

需要 Node.js 与 pnpm。安装依赖并启动本地预览：

```bash
pnpm install
pnpm dev
```

打开终端显示的本地地址。游戏进度、设置和每种模式的前十名成绩保存在当前浏览器的本地存储中，不会上传。设置中可以导出、导入或重置当前存档；清除浏览器站点数据也会清除这些记录。

## 验证

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

端到端测试在独立的 Vite `test` 模式中运行，并在 `test-results/` 生成三档视口截图。此目录不纳入版本控制。

## 版权

项目依据 [GNU General Public License v2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html) 发布，不提供任何担保。事件插画由本项目在本地程序化生成，界面图标来自 Lucide，图标许可见 [随附说明](public/licenses/lucide-license.txt)。详见 [NOTICE.md](NOTICE.md)。
