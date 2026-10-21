# 林间 · 交互海报

画面支持鼠标和触屏互动。树木自动生长；靠近时叶片逐渐变黄并飘落，离开后会重新长出。页面只保留互动提示和「重新生成森林」按钮。

## 本地预览

保持 `index.html`、`style.css`、`sketch.js` 在同一文件夹。使用 VS Code 的 Live Server 打开 `index.html`。网页通过 CDN 加载 p5.js，因此预览时需要联网。

## 调整效果

打开 `sketch.js`，在文件开头的 `SETTINGS` 修改树木密度、大小、鼠标影响范围、落叶速度和叶片大小。

## 发布

将这三个网页文件放进 GitHub 仓库根目录，在 **Settings → Pages** 选择 **Deploy from a branch**，设置 `main` 和 `/(root)` 后保存。部署完成后使用 GitHub Pages 提供的 HTTPS 链接分享；微信公众号文章可添加该链接或网页卡片。
