---
title: Docker安装最新版redis以及正确配置
date: 2024-08-19 16:54:43
tags: Docker
category: Docker

---

### 安装

最近docker数据源大量失效，拉不下来镜像不是你的问题，可以自己检索还能用的镜像源

> docker pull redis

### 启动redis

#### 创建目录

首先需要手动创建/docker/redis/conf/redis.conf这个文件，命令如下：

```shell
mkdir -p /docker/redis/conf && touch /docker/redis/conf/redis.conf
```

再在/docker/redis下创建一个data文件夹，用来存放rdb和aof文件

```shell
cd /docker/redis/conf
mkdir data
```

#### 下载配置文件

接着去[官网](https://redis.io/docs/latest/operate/oss_and_stack/management/config/)下载redis.conf文件，下载最新版即可（因为我们pull的是最新版）。

需要修改端口号和保护模式：

```shell
#bind 127.0.0.1 -::1 只允许本地访问，注释掉，改为允许所有端口访问
bind 0.0.0.0

protected-mode no #确保 protected-mode 设为 no
```

#### 上传配置文件

将配置文件复制到我们之前创建的`/docker/redis/conf/redis.conf`中，需要用到vim，可自行学习，下面简单说一下步骤

```
1、首先全部复制我们修改好的配置文件
2、vim /docker/redis/conf/redis.conf
3、按i键
4、粘贴
5、输入:wq
6、回车
```

#### 运行容器

```docker
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v /docker/redis/conf/redis.conf:/etc/redis/redis.conf \
  -v /docker/redis/data:/data \
  --restart unless-stopped \
  redis:latest \
  redis-server /etc/redis/redis.conf --requirepass "123456"
```

>  注意：redis insight客户端需要填写用户名，默认为default

