---
title: nacos
date: 2024-08-02 16:25:24
tags: nacos
category: 微服务组件

---

### 安装

1. 数据库：nacos默认的数据库是derby，可以配置MySQL作为nacos的数据库，去[官方仓库](https://github.com/alibaba/nacos/blob/develop/distribution/conf/mysql-schema.sql)下载mysql-schema.sql脚本，配置到数据库中

2. 环境变量：使用docker部署，只需要将下面的环境变量文件挂载到nacos容器的env-file下，见启动docker命令

```
PREFER_HOST_MODE=hostname
MODE=standalone
SPRING_DATASOURCE_PLATFORM=mysql
MYSQL_SERVICE_HOST=##MySQL地址##
MYSQL_SERVICE_DB_NAME=nacos
MYSQL_SERVICE_PORT=3306
MYSQL_SERVICE_USER=root
MYSQL_SERVICE_PASSWORD=**
MYSQL_SERVICE_DB_PARAM=characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai
```

3. docker启动

```docker
docker run -d \
--name nacos \
--env-file ./nacos/custom.env \
-p 8848:8848 \
-p 9848:9848 \
-p 9849:9849 \
--restart=always \
nacos/nacos-server:v2.1.0-slim
```

### 依赖

```xml
<!--nacos 服务注册发现-->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
</dependency>
<!--nacos配置管理-->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
</dependency>
<!--读取bootstrap文件-->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-bootstrap</artifactId>
</dependency>
```

### 配置中心

设置Bootstrap.yaml文件，这样SpringCloud启动时便可以自动读取Bootstrap文件中的nacos地址，从而去nacos的配置中心拉去各种共享配置，以及实现配置的热更新。

```yaml
spring:
  application:
    name: cart-service # 服务名称
  profiles:
    active: dev
  cloud:
    nacos:
      server-addr: *ip*:8848 # nacos地址
      config:
        file-extension: yaml # 文件后缀名
        shared-configs: # 共享配置
          - dataId: shared-jdbc.yaml # 共享mybatis配置
          - dataId: shared-log.yaml # 共享日志配置
          - dataId: shared-swagger.yaml # 共享日志配置
```

### 热更新

业务需要对购物车的最大容量限制做热更新，新增配置文件，`@ConfigurationProperties` 用于将配置文件中的属性绑定到一个 Java Bean 上。相当于`@RefreshScope` + `@Value`

```java
@Data
@Component
@ConfigurationProperties(prefix = "hm.cart")
public class CartProperties {
    private Integer maxAmount;
}
```

在nacos的控制台配置中心中新增cart-service.yaml文件，从而可以通过修改控制台中的属性值实现无需重启服务自动更新maxAmount值

```yaml
hm:
  cart:
    maxAmount: 6 # 购物车商品数量上限
```

