---
title: Sentinel服务保护
date: 2024-07-31 13:08:47
tags: Sentinel
category: 微服务组件

---

### Sentinel

Sentinel是一个为微服务提供**流量控制**、**流量整形**、 **并发限制**、**熔断**、**系统自适应过载保护等**多方面保护机制的微服务哨兵。由alibaba开发。

Netflix还开发过一款Hystrix，当然已经不再维护。

### 簇点链路

一次请求进入服务后经过的每一个被Sentinel监控的资源链，默认Sentinel会监控SpringMVC的每一个EndPoint（HTTP接口/Controller中的方法）。限流熔断都是针对簇点链路中的资源设置的，资源名默认就是Controller中方法的请求路径。

如：`@RequestMapping("/carts")`，资源名称就是/carts，而如今我们的RestFul风格的Controller中，很多路径都是/carts，只有操作类型不一样，如:

```java
@ApiOperation("添加商品到购物车")
@PostMapping
public void addItem2Cart(@Valid @RequestBody CartFormDTO cartFormDTO)
    
@ApiOperation("更新购物车数据")
@PutMapping
public void updateCart(@RequestBody Cart cart)
```

因此需要添加以下配置，使用操作类型名称作为资源名

```yaml
http-method-specify: true
```

效果如下：

![簇点链路资源名称](簇点链路.png)

### 限流

#### 性能指标

**TPS**：Transactions Per Second。服务器每秒处理的事务数量。一个事务是指一个客户机向服务器发送请求然后服务器做出反应的过程。在分布式系统中完成一笔事务需要多个系统的配合。比如我们在电商系统购物，需要订单、库存、账户、支付等多个服务配合完成，有的服务需要异步返回，这样完成一笔事务花费的时间可能会很长。如果按照`TPS`来进行限流，时间粒度可能会很大大，很难准确评估系统的响应性能。

**HPS**：Hits per Second。每秒点击次数，指每秒钟服务端收到客户端的请求数量

**QPS**：Queries Per Second。服务端每秒能够响应的客户端查询请求数量。

目前多用做流控，设置规则QPS=7，即每秒最多7次访问

![流控设置](流控设置.png)

使用Jmeter测试，效果如下:

![](流控效果.png)

Jmeter中失败的请求返回的响应状态码为429（Too Many Requests），响应数据为：`Blocked by Sentinel (flow limiting)`

#### 线程隔离

一旦某个服务出现故障，我们必须隔离对这个服务的调用，避免发生雪崩。

查询购物车的时候需要查询商品，为了避免因商品服务出现故障导致购物车服务级联失败，我们可以把购物车业务中查询商品的部分隔离起来，限制可用的线程资源，比如设置为5，同一时间只允许5个并发线程访问

![](线程隔离设置.png)

这样，即便商品服务出现故障，最多导致查询购物车业务故障，并且可用的线程资源也被限定在一定范围，不会导致整个购物车服务崩溃。



### 熔断与降级

**熔断**：当调用失败达到一定的次数，或者慢调用达到一定次数，就将熔断器打开一段时间，这段时间内都不允许消费者向提供者发送请求了。当熔断时间到了，就将熔断器设置为半打开状态，允许消费者发送请求，统计成功次数，若达到指定成功次数，关闭熔断器恢复请求链路，否则打开熔断器

![熔断流程](熔断流程.png)

**降级**：服务发生熔断后，让请求走事先配置的处理方法，这个方法就是降级逻辑（fallback），服务降级是对非核心服务降级

#### dubbo整合sentinel实现熔断降级实战

**背景**：购物车服务cart-service中的查询购物车服务，需要调用商品服务item-service的方法，在之前的章节中我们分别使用了openfeign和dubbo进行了远程调用，这里基于dubbo整合sentinel进行服务熔断测试。

首先需要导入依赖：

```xml
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-core</artifactId>
</dependency>
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-dubbo-adapter</artifactId>
    <version>1.8.0</version>
</dependency>
```

在服务提供方item-service的服务实现类中，休眠线程500毫秒，主动模拟慢调用逻辑

```java
@Service
@Slf4j
@DubboService(interfaceClass = IItemService.class)
public class ItemServiceImpl extends ServiceImpl<ItemMapper, Item> implements IItemService {

    @Override
    //TODO:@SentinelResource注解
    @SentinelResource(value = "queryItemByIds", fallback = "fallbackQueryItemByIds")
    public List<ItemDTO> queryItemByIds(Collection<Long> ids) {
        ThreadUtil.sleep(500); //模拟慢调用
        return BeanUtils.copyList(listByIds(ids), ItemDTO.class);
    }

    //不知道为啥始终走不到这个降级逻辑
    //废话，熔断后根本没有发起dubbo调用，怎么可能到达这里
    public List<ItemDTO> fallbackQueryItemByIds(Collection<Long> ids, Throwable ex) {
        log.info("查询商品服务繁忙，请稍后再试", ex);
        return CollUtils.emptyList();
    }
}
```

在购物车服务的启动类下配置了全局fallback处理器

```java
@MapperScan("com.hmall.cart.mapper")
@SpringBootApplication
@EnableDubbo
@Slf4j
//@EnableFeignClients(basePackages = "com.hmall.api.client", defaultConfiguration = DefaultFeignConfig.class)
public class CartServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(CartServiceApplication.class, args);
        DubboAdapterGlobalConfig.setConsumerFallback((invoker, invocation, e) -> {
            log.error("降级了，参数：{}, 服务名：{}, 方法：{}", invocation.getArguments(),
                    invocation.getServiceName(), invocation.getMethodName());
            return (Result) AsyncRpcResult.newDefaultAsyncResult(invocation);
        });
    }
}
```

前端页面访问一次购物车，可以看到如下簇点链路信息，我们的服务接口IItemService和服务方法均注册成功。

![簇点链路](簇点链路2.png)

为服务方法设置熔断规则，各参数信息如下：

- 最大RT：最大请求耗时，超过了就计入慢调用比例
- 比例阈值：（0.5）十次调用有五次都是慢的
- 熔断时长：熔断器开启的时长，时间结束后进入half-open状态
- 最小请求数：最少要发几次请求sentinel才开始统计慢调用、异常比例等等
- 统计时长：统计的周期，比如1秒内，请求达到了10次，5次都是慢调用，则开启熔断器

![熔断参数设置](1.png)

多访问几次查询购物车服务，可以发现时而访问成功，时而失败，sentinel监控面板显示如下信息：

![监控](熔断监控.png)

控制台输出fallback逻辑：

```
com.hmall.cart.CartServiceApplication    : 降级了，参数：[[1713453, 5089253]], 服务名：null, 方法：queryItemByIds
```

