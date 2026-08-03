---
title: OpenFeign最佳实践
date: 2024-07-21 11:46:34
tags: OpenFeign
category: 微服务组件
---

### 简介

Spring Cloud OpenFeign 它是 Spring 官方推出的一种声明式服务调用与负载均衡组件。它底层基于 Netflix Feign，Netflix Feign 是 Netflix 设计的开源的声明式 WebService 客户端，用于简化服务间通信。

Spring Cloud openfeign 对 Feign 进行了增强，使其支持 **Spring MVC** 注解，另外还整合了 Ribbon 和 Nacos，从而使得 Feign 的使用更加方便。



### 依赖

```xml
<!--openFeign-->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<!--负载均衡器-->
<!--此依赖会自动为 Feign 客户端配置一个负载均衡器。你不需要显式配置，Spring Cloud 会在后台处理。-->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```



### 实践

我们有两个服务 cart-service 和 item-service，cart 服务需要用到 item 服务的查询方法，那么在原始的 cart 服务中，我们应该通过：http://localhost:8081/items/ids=10086,10088 这种 url 请求 item 服务（通过一堆ids查询items），由于我们把所有服务注册到了 nacos ，现在引入 OpenFeign 基于动态代理帮助我们调用服务。

使用 OpenFeign 我们只需定义一个接口，而无需主动实现该接口，OpenFeign 会在调用服务时自动通过动态代理的方式创建代理对象进行操作。这里我们使用 SpringMVC 注解来定义请求路径和参数，@FeignClient("item-service") 注解声明 Feign 客户端，item-service 是要调用的服务名称。

>  注意服务名称不能包含 ```_``` 下划线 。

```java
@FeignClient("item-service")
public interface ItemClient {

    @GetMapping("/items")
    List<ItemDTO> queryItemByIds(@RequestParam("ids") Collection<Long> ids);
}
```

同时，在 cart-service 的启动类上加入 ``EnableFeignClients`` 注解

```java
@EnableFeignClients(basePackages = "com.hmall.api.client") //因为将Feign拆分成另一个api模块，需要引入api依赖同时指定包扫描
```

接着，在 cart -service 的实现类中 注入 Feign 客户端接口，之后就可以愉快地调用 item 服务的方法啦，（其实不是 item 的方法，因为 feign 是帮我们完成了构造 uri ，拉取服务，负载均衡，发送 http 请求的所有工作，相当于对 item-service 发起了一次新的 http 请求调用）

```java
private final ItemClient itemClient;
List<ItemDTO> items = itemClient.queryItemByIds(itemIds);
```



### 调试

通过调试来看看OpenFeign在底层到底干了什么，在这句代码前打个断点：

```java
List<ItemDTO> items = itemClient.queryItemByIds(itemIds);
```

发现 OpenFeign 通过动态代理构造了一个代理对象为我们执行方法，进入这个 FeignInvocationHandler，发现 ``equals/hashCode/toString`` 不走代理，我们的方法名 ``queryItemByIds`` 当然要走代理，继续进入：

![](D:\Github\payfish.github.io\source\_posts\OpenFeign最佳实践\调试1.png)

下面这一步是在 ``invoke`` 之前构造请求服务的 uri，Feign 通过 `RequestTemplate` 构建请求模板。

根据方法上的注解（如 `@RequestMapping`、`@GetMapping`、`@RequestParam` 等），以及方法参数，填充请求模板中的 URL、请求方法、请求头和请求体。

![](D:\Github\payfish.github.io\source\_posts\OpenFeign最佳实践\调试2.png)

这里构造了形如 ``http://item-service/items?ids=10000`` 的请求，接下来还需要把 ``item-service`` 替换为 ``nacos`` 中对应服务名称的 ``host + port``，下面这一步执行两个操作：

- 构造 `Request` 对象，包含了最终的 URL、HTTP 方法、请求头和请求体等信息。

- 通过 `Client` 接口发送请求，`Client` 接口的实现类有多种（如 `Feign.Default`、`ApacheHttpClient`、`OkHttpClient` 等）。

![](D:\Github\payfish.github.io\source\_posts\OpenFeign最佳实践\调试3.png)

在``Feign``的阻塞负载均衡客户端中，通过负载均衡客户端的``choose`` 方法拿到了 ``nacos`` 中 ``item`` 服务的实例，实例中自然包含其``host:port``。

![](D:\Github\payfish.github.io\source\_posts\OpenFeign最佳实践\调试4.png)

拼接上形成最终 ``http uri``: ``reconstructedUri``，使用新的 URI 构造一个新的 `Request` 对象。最后通过 ``LoadBalancerUtils`` 把 ``feign`` 客户端、`Request` 对象、负载均衡等等一堆鬼东西全部扔进去执行 HTTP 请求。

![](D:\Github\payfish.github.io\source\_posts\OpenFeign最佳实践\调试7.png)

![](D:\Github\payfish.github.io\source\_posts\OpenFeign最佳实践\调试6.png)



### 连接池

上面的 ``delegate`` 就是``feign`` 客户端，默认是 ``HttpURLConnection`` ，不支持HTTP连接池，因此我们通常会使用带有连接池的客户端来代替默认的 ``HttpURLConnection`` 。比如 ``Apache HttpClient`` 或者 ``OK Http``.

- 导入依赖

```XML
<!--OK http 的依赖 -->
<dependency>
  <groupId>io.github.openfeign</groupId>
  <artifactId>feign-okhttp</artifactId>
</dependency>
```

- 配置开启okhttp

在`cart-service`的`application.yml`配置文件中开启Feign的连接池功能：

```YAML
feign:
  okhttp:
    enabled: true # 开启OKHttp功能
```

重启服务，搞定。



### 日志



### 总结

OpenFeign 主要做了如下工作：

- 基于接口和注解构造请求对象（URI)
- 去 nacos 寻找服务，得到服务实例（Instance）
- 负载均衡
- 动态代理生成代理对象处理请求
