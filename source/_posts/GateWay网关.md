---
title: Gateway网关
date: 2024-07-25 22:09:45
tags: Gateway
category: 微服务组件
---

### 什么是网关

网关-网络的关口，门卫。数据从一个网络传输到另一个网络需要经过网关来做数据的路由和转发，以及数据安全的校验工作。从此以后，前端请求不再直接访问后端服务，而是访问网关（也是一个微服务）。

- 路由：选择数据要去的服务的目的地址
- 转发：转发数据给对应的服务
- 校验：在网关层面进行数据鉴权

![网关工作示意图](网关.jpg)

SpringCloud提供了两种网关实现：

- Netflix Zuul：早期实现，目前已经淘汰
- SpringCloudGateway：基于Spring的WebFlux技术，完全支持响应式编程，吞吐能力更强

> 响应式编程模型，即通过异步和非阻塞的方式处理数据流和事件。

### 依赖

```xml
<!--网关-->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
<!--负载均衡-->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

### 配置

```yaml
gateway:
  routes: #路由
    - id: item-service  #路由唯一标识
      uri: lb://item-service  #路由目标地址
      predicates: #断言，判断请求是否符合当前路由
        - Path=/items/**,/search/**
    - id: cart-service
      uri: lb://cart-service
      predicates:
        - Path=/carts/**
  default-filters: #过滤器，也可以添加在每一个路由中
	- AddRequestParameter=red, blue 
```

```java
// 过滤器执行示意
@ApiOperation("分页查询商品")
@GetMapping("/page")
public PageDTO<ItemDTO> queryItemByPage(PageQuery query, @RequestParam("red") String res) {
    System.out.println(res); //输出blue
```

### JWT校验流程

- 用户登录后，用户微服务user-service使用预定义的jwt秘钥为用户生成一个JWT令牌（token），返回给客户端
- 用户之后对任何微服务的请求都必须带上这个token，服务端校验token（为空、篡改、过期等），成功后才执行请求的方法，返回数据。

### 使用网关进行登录校验

每个微服务都实现JWT校验逻辑未免太过复杂，而我们的网关正好会对所有的请求路由和转发，在网关层进行JWT校验在合适不过。

不过，这里存在几个问题：

- 网关路由是配置的，请求转发是Gateway内部代码，我们如何在转发之前做登录校验？

  > -- 网关过滤器

- 网关校验JWT之后，如何将用户信息传递给微服务？

  > -- SpringMVC拦截器拦截网关转发的所有http请求，将用户信息保存到ThreadLocal中

- 微服务之间也会相互调用，这种调用不经过网关，又该如何传递用户信息？ 

  > -- OpenFeign请求拦截器，一个微服务在通过Feign调用另一个微服务时，发起http请求之前先从ThreadLocal中拿到userId，将userId作为请求头加入http请求，再发送请求到另一个微服务

```java
//网关过滤器
@Component
@RequiredArgsConstructor
@EnableConfigurationProperties(AuthProperties.class)
public class AuthFilter implements GlobalFilter, Ordered {

    private final JwtTool jwtTool;
    private final AuthProperties authProperties;
    private final AntPathMatcher antPathMatcher = new AntPathMatcher();// Spring 框架提供的路径模式匹配器

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        //1.get request
        ServerHttpRequest request = exchange.getRequest();
        //1.1 check request path to see if it needs a login interception
        RequestPath path = request.getPath();
        if (pathIsExclude(path)) {
            return chain.filter(exchange);
        }
        //2.get token from header
        //3.verify token, check if user has login
        String token = null;
        List<String> headers = request.getHeaders().get("authorization");
        if (headers != null && !headers.isEmpty()) {
            token = headers.get(0);
        }
        //4.do jwt verifying
        Long userId;
        try {
            userId = jwtTool.parseToken(token); //校验token逻辑
        } catch (UnauthorizedException e) {
            //Unauthorized!
            ServerHttpResponse response = exchange.getResponse();
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return response.setComplete(); //return 401
        }
        //5.pass userinfo to next filter
        ServerWebExchange swe = exchange.mutate().request(builder ->
                builder.header("user-id", userId.toString())).build();
        return chain.filter(swe);
    }

    /**
     * 判断路径是否合法
     * @param path
     * @return
     */
    private boolean pathIsExclude(RequestPath path) {
        List<String> excludePaths = authProperties.getExcludePaths();
        for (String pathPatten : excludePaths) {
            if (antPathMatcher.match(pathPatten, String.valueOf(path))) {
                return true;
            }
        }
        return false;
    }

    /**
     * 定义Filter的优先级，需要低于NettyRoutingFilter的优先级Integer.MAX_VALUE
     * @return
     */
    @Override
    public int getOrder() {
        return 0;
    }
}
```

```java
//SpringMVC拦截器
@Component
public class AuthInterceptor implements HandlerInterceptor {

@Override
public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
    String userId = request.getHeader("user-id");
    if (StrUtil.isNotBlank(userId)) { //有些路径是不需要登录拦截的：/search /users/login /items
                                        //因此不会有user-id这个请求头，所以必须判断非空
        UserContext.setUser(Long.valueOf(userId));
    }
    return true; //放行
}

@Override
public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
    UserContext.removeUser();
}
```

```java
//OpenFeign请求拦截器
@Bean
RequestInterceptor feignRequestInterceptor() {
    return requestTemplate -> {
        Long userId = UserContext.getUser();
        if (userId != null) {
            requestTemplate.header("user-id", userId.toString());
        }
    };
}
```

