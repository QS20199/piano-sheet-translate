# 说明

本工具用于识别五线谱中的各个音符, 将其翻译为对应的音符名(如 C, #D)

# 环境

在以下环境运行通过, 可供参考:

windows
nodejs 14.18.1
opencv 4.8.0

# 安装

1. 下载 opencv 的 release 包 https://opencv.org/releases/
2. 将 release 包安装至指定目录, 并将 `prepare-opencv.js` 中的 `opencvDir` 变量更新为你安装的目录
3. 安装nodejs, 推荐使用 `nvm` 工具来安装指定的nodejs版本
4. 执行 `npm install`
5. 执行 `npm run prepare-opencv`, 该过程可能持续数十分钟
6. 执行 `npm run build-ts`

# 使用

1. 编辑 app.conf 配置
   1.1 调整谱子的升降调号 `tune` (必须)
   1.2 调整缩放系数 `sheetScale` (必须)
   1.3 调整其他参数 (可选)
2. 将待识别的图片放到 input 目录下, 执行 `node ./` 即可, 识别后的结果将输出至 output 目录
