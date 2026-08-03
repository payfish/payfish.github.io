---
title: docker容器一直重启的解决办法
date: 2024-08-22 14:19:26
tags: docker
category: Bugs

---

项目通过docker compose部署上线时，出现了容器疯狂重启的情况，昨天是nacos不断挂掉重启，连带着seata也一直重启，排查发现是内存不足的原因，重新分配内存后得以解决。

今天seata和Sentinel又开始了，我寻思内存已经够用了啊，nacos都没事了，怎么这两个又出问题了，搜索一番终于解决，记录一下原因和解决方案。

### 错误信息

使用docker logs seata查看日志，只有一行错误信息：

> unable to allocate file descriptor table - out of memorylibrary initialization failed

### 系统级修改

错误信息表示系统的文件描述符（file descriptor）限制不足，可能导致服务（如 Seata）无法正常启动或运行。

使用 `ulimit -n` 查看当前用户的文件描述符限制，只有1024

修改系统级别的ulimit参数：`vim /etc/security/limits.conf` ，设置

```
* soft nofile 65536
* hard nofile 65536
```

编辑 `/etc/pam.d/common-session` 和 `/etc/pam.d/common-session-noninteractive` 文件，添加

```
session required pam_limits.so
```

编辑 `/etc/sysctl.conf` 文件，添加

```
fs.file-max = 65536
```

重启`sudo sysctl -p`，并重启系统

### 修改docker-compose.yml文件

为重启的容器添加`ulimits:`字段限制:

```dockerfile
version: '3.8'
services:
  seata:
    image: seata/seata-server
    ulimits:
      nofile:
        hard: 65535
        soft: 65535
  sentinel-dashboard:
    image: sentinel/sentinel-dashboard
    ulimits:
      nofile:
        hard: 65535
        soft: 65535
```

重新启动docker compose，修改成功，容器正常运行

```docker
docker compose down
docker compose up -d
```





