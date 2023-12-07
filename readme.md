# 说明

本工具用于识别五线谱中的各个音符, 将其翻译为对应的音符名(如 C, #D)

# 示例

待翻译的图片:

![待翻译的图片](./input/example.jpg)

翻译后的图片:

![翻译后的图片](./output/example.jpg)

# 使用

1. 编辑 app.conf 配置

   1.1 调整谱子的升降调号 `tune` (必须)

   1.2 调整缩放系数 `sheetScale` (必须)

   1.3 调整其他参数 (可选)

2. 将待识别的图片放到 input 目录下

3. 执行代码，鉴于opencv安装在各个环境下有一定不确定性, 建议使用docker来跑

```
# 在当前工作目录下
sudo docker run -it \
   --mount type=bind,source=./app.conf,target=/usr/src/app/app.conf \
   --mount type=bind,source=./input,target=/usr/src/app/input \
   --mount type=bind,source=./output,target=/usr/src/app/output \
   qs20199/piano-sheet-translate:latest
```

如果不使用docker，可参考以下信息自行搭建开发环境

# 开发环境

在以下环境运行通过, 可供参考:

 - windows
 - nodejs 14.18.1
 - opencv 4.8.0

## 开发环境安装

1. 下载 opencv 的 release 包 https://opencv.org/releases/
2. 将 release 包安装至指定目录, 并将 `prepare-opencv.js` 中的 `opencvDir` 变量更新为你安装的目录
3. 安装nodejs, 推荐使用 `nvm` 工具来安装指定的nodejs版本
4. 执行 `npm install`
5. 执行 `npm run prepare-opencv`, 该过程可能持续数十分钟
6. 执行 `npm run build-ts`

## 发布docker

```shell
# 编译
docker build -t qs20199/piano-sheet-translate ./

# 发布
docker push qs20199/piano-sheet-translate
```
