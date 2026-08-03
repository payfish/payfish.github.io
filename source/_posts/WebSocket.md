---
title: WebSocket
date: 2024-08-30 10:40:37
tags: WebSocket
category:

---

### 简介

**WebSocket** 是一种计算机通信协议，为 Web 应用程序提供了全双工通信通道。它是为了克服 HTTP 协议的一些局限性而设计的，特别是 HTTP 是单向的——客户端请求，服务器响应。在 WebSocket 连接中，客户端和服务器之间的通信是持续的，可以相互发送消息，而不必每次都重新建立连接。

**握手过程**: WebSocket 连接从 HTTP 请求开始，客户端发起一个 HTTP 请求到服务器，请求头中包含 `Upgrade: websocket` 字段。服务器响应并同意升级协议，成功升级后，建立 WebSocket 连接。

### 应用场景

- 网页聊天：客户端和服务器可以随时发送消息，且不需要建立新连接，减少了延迟和资源开销。
- 视频弹幕：不用介绍了
- 实时更新：金融数据、股票市场、货币交易、比赛比分等需要将最新数据实时推送到客户端页面

### 依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```
