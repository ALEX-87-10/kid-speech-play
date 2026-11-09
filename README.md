# 星星小屋 · 会说话的启蒙乐园

面向幼儿园小朋友的纯静态语音互动网页：点读、语音问答、儿歌、古诗、认知卡片。

站点：https://chinahomeby.github.io/kid-speech-play/

## 能做什么

- **语音对话**：点一下大麦克风，小朋友说话，页面用关键词匹配回答并朗读出来。
- **儿歌乐园**：5 首儿歌，逐句朗读，正在读的那一句会高亮跳出来。
- **诗词课堂**：5 首古诗，逐句朗读 + 一句白话讲解。
- **认知启蒙**：动物 / 颜色 / 数字 / 水果 / 交通五类大卡片，点一下就读出名称和一句描述。
- **动画与光影**：星星闪烁、云朵漂移、麦克风呼吸圈、卡片按压反馈、完成时撒彩纸粒子。
- **音效**：用 Web Audio 实时合成点击音、成功音、提示音，没有外部音频文件，也不用担心版权。

## 技术说明

- 纯前端，原生 JS，无框架、无构建。
- 语音识别用 `SpeechRecognition`，朗读用 `speechSynthesis`，两者都是浏览器自带能力。
- 音效由 `AudioContext` 合成。
- 设置（音效开关、朗读开关、语速）存在 `localStorage`，键名 `kid-speak:settings:v1`。

## 文件

```
index.html                     入口
assets/css/base.css            基础层：背景、品牌、设置条、标签、语音对话
assets/css/cards.css           卡片层：栅格、点读卡片、展示区、粒子、断点
assets/js/data.js              内容库：儿歌与古诗
assets/js/data-cards.js        内容库：认知卡片与问答词条
assets/js/sound.js             音效合成 + 语音朗读封装
assets/js/app.js               页面切换、点读、逐句高亮、语音识别
assets/icon.svg                站点图标
.github/workflows/pages.yml    自动部署
```

## 本地运行

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

语音识别需要 HTTPS 或 localhost，`file://` 打开时只能点读、不能收音。

## 已知边界

- 不是大模型对话，词库外的内容会兑底回复「我还在学」。
- 朗读是浏览器 TTS 语音，不是原唱歌曲，音色取决于设备系统语音包。
- 部分国产浏览器会裁掉 Web Speech API，表现为麦克风按钮不可用；改用 Chrome / Edge / Safari 即可。
- 麦克风必须由用户手动授权，页面不会自动监听。

## 首次部署设置

新仓库首次运行如报 `Resource not accessible by integration`，需要在
`Settings → Pages` 把 Source 选为 `GitHub Actions`，并在
`Settings → Actions → General` 把 Workflow permissions 设为 `Read and write permissions`。
