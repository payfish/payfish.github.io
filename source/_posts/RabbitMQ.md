---
title: RabbitMQ
date: 2024-08-04 15:26:19
tags: 消息队列
category: 微服务组件
---

### 简介

消息队列，提供异步通信，解决同步通信问题，例如支付服务中用户支付完成后需要调用用户服务扣减余额，还需要调用交易服务更新订单状态。

- **拓展性差**：每次有新的需求，现有支付逻辑都要跟着变化，代码经常变动，不符合开闭原则，拓展性不好
- **性能低下**：如果全是同步调用，支付服务需要等待扣减余额，更新订单状态等业务结束，最终才能结束，调用时长是这些同步调用时长的累加和
- **级联失败**：同步调用中的某个服务出现故障，整个事务都会回滚，导致交易失败

下面给出异步调用模型

- 消息代理：也就是消息broker，管理、暂存、转发消息

![](异步调用模型.png)

异步调用的优势包括：

- 耦合度更低
- 性能更好
- 业务拓展性强
- 故障隔离，避免级联失败

当然，异步通信也并非完美无缺，它存在下列缺点：

- 完全依赖于Broker的可靠性、安全性和性能
- 架构复杂，后期维护和调试麻烦

#### 目前使用过的场景

- 异步秒杀
- 支付服务支付成功后通知交易服务修改订单状态为已支付
- 延迟消息队列插件实现订单30分钟未支付取消订单

### Docker部署

```shell
docker run \
 -e RABBITMQ_DEFAULT_USER=fuish \
 -e RABBITMQ_DEFAULT_PASS=123456 \
 -v mq-plugins:/plugins \
 --name mq \
 --hostname mq \
 -p 15672:15672 \
 -p 5672:5672 \
 --network bmdp \
 -d \
 rabbitmq:3.8.19-management
```

### RabbitMQ组件

#### 交换机

交换机没有存储消息的能力，只是将消息路由到与之绑定的队列中

- fanout：广播消息给所有绑定的队列
- direct：队列和交换机绑定时需指定`RoutingKey`，消息的发送方在 向 Exchange发送消息时，也必须指定消息的 `RoutingKey`。绑定的队列只有其`Routingkey`与消息的 `RoutingKey`完全一致，才会接收到消息
- topic：允许队列在绑定`BindingKey` 的时候使用通配符！

#### 队列

存储消息，等待消费者监听，消费者监听队列就可以拿到里面的消息

#### 消息转换器

消息转换器也就是序列化和反序列化器。

Spring的消息发送代码接收的消息体是一个Object:

```java
public void convertAndSend(String exchange, String routingKey, Object object)
```

传输消息时，它会把你发送的消息序列化为字节发送给MQ，接收消息的时候，还会把字节反序列化为Java对象。

若不配置消息转换器，Spring默认采用JDK序列化，JDK序列化有如下问题

- 数据体积过大
- 有安全漏洞
- 可读性差

> 添加配置类配置消息转换器

```java
@Configuration
public class MqConfig {

    @Bean
    public MessageConverter messageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        //配置自动创建消息id，用于识别不同消息，也可以在业务中基于ID判断是否是重复消息
        converter.setCreateMessageIds(true);
        return converter;
    }
}
```

### 异步秒杀简单实战

优惠券秒杀功能中，判断用户有秒杀资格后就可以直接返回前端秒杀成功，而异步在后台更新扣减优惠券库存和保存优惠券订单的业务逻辑，可以用消息队列实现

> 发送消息

```java
...
	//走到这里代表有秒杀资格
    long orderId = redisIDGenerator.nextId("order");
    //生成优惠券订单
    VoucherOrder voucherOrder = new VoucherOrder();
    voucherOrder.setId(orderId);
    voucherOrder.setVoucherId(voucherId);
    voucherOrder.setUserId(userId);
    //将订单发布到消息队列中，在VoucherOrderListener中实现监听
    try {
        //发送消息
        rabbitTemplate.convertAndSend("secKill.topic", "secKill.success", voucherOrder);
    } catch (Exception e) {
        log.error("秒杀成功的消息发送失败，支付单id：{}， 优惠券id：{}", orderId, voucherId, e);
    }
    //直接返回前端
    return Result.ok(orderId);
...
```

> 消费者，自定义监听类，异步监听消息队列处理消息

```java
@Slf4j
@Service
public class VoucherOrderListener {

    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(name = "secKill.success.queue"),
            exchange = @Exchange(name = "secKill.topic"),
            key = "secKill.success"
    ))
    public void onMessage(VoucherOrder voucherOrder) {
        try {
            //处理消息
            handlerVoucherOrder(voucherOrder);
        } catch (Exception e) {
            log.error("处理订单有异常发生：", e);
            // 根据业务逻辑可以考虑消息重试或者放入死信队列
        }
    }
}
```



### MQ自身可靠性

#### 数据持久化

交换机持久化、队列持久化、消息持久化

#### LazyQueue

在默认情况下，RabbitMQ会将接收到的信息保存在内存中以降低消息收发的延迟。但在某些特殊情况下，这会导致消息积压，比如：

- 消费者宕机或出现网络故障
- 消息发送量激增，超过了消费者处理速度
- 消费者处理业务发生阻塞

一旦出现消息堆积问题，RabbitMQ的内存占用就会越来越高，直到触发内存预警上限。此时RabbitMQ会将内存消息刷到磁盘上，这个行为叫`PageOut`. `PageOut`会耗费一段时间，并且会阻塞队列进程。因此在这个过程中RabbitMQ不会再处理新的消息，生产者的所有请求都会被阻塞。

为了解决这个问题，从RabbitMQ的3.6.0版本开始，就增加了Lazy Queues的模式，也就是惰性队列。惰性队列的特征如下：

- 接收到消息后直接存入磁盘而非内存
- 消费者要消费消息时才会从磁盘中读取并加载到内存（也就是懒加载）
- 支持数百万条的消息存储

#### 集群

##### 普通集群

意思就是在多台机器上启动多个 RabbitMQ 实例，每个机器启动一个。你创建的 queue，只会放在一个 RabbitMQ 实例上，但是每个实例都同步 queue 的元数据（元数据可以认为是 queue 的一些配置信息，通过元数据，可以找到 queue 所在实例）。

你消费的时候，实际上如果连接到了另外一个实例，那么那个实例会从 queue 所在实例上拉取数据过来。这方案主要是提高吞吐量的，就是说让集群中多个节点来服务某个 queue 的读写操作。

##### 镜像集群

在镜像集群模式下，你创建的 queue，无论元数据还是 queue 里的消息都会存在于多个实例上，每个 RabbitMQ 节点都有这个 queue 的一个完整镜像，包含 queue 的全部数据

任何一个机器宕机了，其它机器（节点）还包含了这个 queue 的完整数据，别的 consumer 都可以到其它节点上去消费数据。坏处在于，这个性能开销也太大了吧，消息需要同步到所有机器上，导致网络带宽压力和消耗很重！



### 生产者可靠性

#### 生产者重试机制

SpringAMQP提供的消息发送时的重试机制。即：当`RabbitTemplate`与MQ连接超时后，多次重试。

#### 生产者确认机制

RabbitMQ提供了生产者消息确认机制，包括`Publisher Confirm`和`Publisher Return`两种。在开启确认机制的情况下，当生产者发送消息给MQ后，MQ会根据消息处理的情况返回不同的**回执**。

- 当消息投递到MQ，但是路由失败时，通过**Publisher Return**返回异常信息，同时返回ack的确认信息，代表投递成功
- 临时消息投递到了MQ，并且入队成功，返回ACK，告知投递成功
- 持久消息投递到了MQ，并且入队完成持久化，返回ACK ，告知投递成功
- 其它情况都会返回NACK，告知投递失败

其中`ack`和`nack`属于**Publisher Confirm**机制，`ack`是投递成功；`nack`是投递失败。而`return`则属于**Publisher Return**机制。默认两种机制都是关闭状态，需要通过配置文件来开启。

### 消费者可靠性

#### 消费者确认机制

当消费者处理消息结束后，应该向RabbitMQ发送一个回执，告知RabbitMQ自己消息处理状态。回执有三种可选值：

- ack：成功处理消息，RabbitMQ从队列中删除该消息
- nack：消息处理失败，RabbitMQ需要再次投递消息
- reject：消息处理失败并拒绝该消息，RabbitMQ从队列中删除该消息

SpringAMQP帮我们实现了消息确认。并允许我们通过配置文件设置ACK处理方式

**auto**：自动模式。SpringAMQP利用AOP对我们的消息处理逻辑做了环绕增强，当业务正常执行时则自动返回`ack`.  当业务出现异常时，根据异常判断返回不同结果：

- 如果是**业务异常**，会自动返回`nack`;
- 如果是**消息处理或校验异常**，自动返回`reject`;

#### 失败重试机制

当消费者出现异常后，消息会不断requeue（重入队）到队列，再重新发送给消费者。如果消费者再次执行依然出错，消息会再次requeue到队列，再次投递，直到消息处理成功为止。

#### 消费者如何保证消息一定被消费

- 开启消费者确认机制为auto，由spring检查消息成功处理后返回ack，失败返回nack
- 开启消费者失败重试机制，设置`MessageRecoverer`，失败后将消息投递到一个指定的，专门存放异常消息的队列，后续由人工集中处理。



### 死信队列

在消息队列系统中，“死信”通常是指以下几种情况的消息：

1. **消息被拒绝（Rejection）**：
   - 消费者收到消息后，显式拒绝（`reject` 或 `nack`）处理消息，且不希望重新投递（`requeue`），此时消息会被转发到死信队列。
2. **消息过期（TTL Expiration）**：
   - 消息在队列中存放的时间超过了设定的 TTL（Time To Live，生存时间）阈值。消息一旦超过设定的时间还没有被消费，就会成为死信。
3. **达到最大重试次数（Max Delivery Attempts）**：
   - 消息的传递次数超过了指定的最大重试次数。在某些消息队列系统中，如果一个消息在被多次消费时一直没有被成功确认（`ack`），则会被认定为“死信”。

用途：

1. **错误隔离**：
   - 将死信与正常消息隔离开，避免死信影响正常的消息处理流程。
2. **问题诊断**：
   - 通过分析死信，可以帮助系统开发者和运维人员诊断消息处理过程中出现的问题，例如消息格式错误、数据不一致、系统Bug等。
3. **重试机制**：
   - 有些系统会设置专门的服务来监听死信队列，针对死信进行特定的重试或补偿逻辑。
4. **监控与报警**：
   - 监控死信队列中的消息数量或消息增长速率，以及时发现系统异常或问题。



### 可靠性总结

支付服务与交易服务之间的订单状态一致性是如何保证的？

- 首先，支付服务会正在用户支付成功以后利用MQ消息通知交易服务，完成订单状态同步。
- 其次，为了保证MQ消息的可靠性，我们采用了生产者确认机制、消费者确认、消费者失败重试等策略，确保消息投递的可靠性
- 最后，我们还在交易服务使用SpringTask + Cron表达式设置定时任务，定期查询订单支付状态。这样即便MQ通知失败，还可以利用定时任务作为兜底方案，确保订单支付状态的最终一致性。

### 延迟消息

[订单超时取消的11种方式](https://cloud.tencent.com/developer/article/2342808)

JUC包中提供了DelayQueue延迟队列，用于实现延时任务。只有实现了 `java.util.concurrent.Delayed` 接口的元素才能存入DelayQueue。`Delayed` 接口有一个方法 `getDelay(TimeUnit unit)`，返回元素剩余的延迟时间。当你向 `DelayQueue` 中放入一个元素时，它会根据这个元素的延迟时间进行排序。只有当元素的延迟时间到了，才能从队列中获取到该元素。

rabbitmq没有提供延迟队列，有以下两种实现方式：

#### 死信交换机+普通交换机

定义一个死信交换机+死信队列，以及原来的普通交换机+普通队列，如果一个队列通过dead-letter-exchange属性指定了一个交换机，那么该队列中的死信就会投递到这个交换机中，这个交换机就是死信交换机。图中将ttl.queue设置死信交换机属性绑定hmall.direct。

普通队列不绑定消费者，消息设置ttl，并设置routingKey，假设ttl=5000(ms)，routingKey="blue"

注意死信交换机与其队列的routingKey需要和消息的routingKey一致，这样就可以保证消息成为死信后一定会到达死信队列（direct.queue1）

后面就简单了，消息因为无人消费，ttl到了之后就会到达死信队列，消费者再绑定这个死信队列即可实现延迟消费

![](死信.png)

- 缺点：死信队列的实现方式存在一个问题，那就是可能造成队头阻塞，因为队列是先进先出的，而且每次只会判断队头的消息是否过期，那么，如果队头的消息时间很长，一直都不过期，那么就会阻塞整个队列，这时候即使排在他后面的消息过期了，那么也会被一直阻塞。同时需要声明很多队列(exchange)出来，会增加系统的复杂度

#### 延迟消息插件

RabbitMQ社区大神开发了延迟消息插件，在[这个网站](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases)下载对应RabbitMQ版本的插件，上传到RabbitMQ的插件目录对应的数据卷目录：

```Shell
docker volume inspect mq-plugins #查看目录
```

执行如下命令安装插件即可使用

```Shell
docker exec -it mq rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

安装并启用这个插件之后，就可以创建x-delayed-message类型的队列了。消息并不会立即进入队列，而是先把他们保存在一个基于Erlang开发的Mnesia数据库中，然后通过一个定时器去查询需要被投递的消息，再把他们投递到x-delayed-message队列中。

#### 15分钟未支付自动取消订单

写个逻辑：使用消息队列的延迟消息实现15分钟自动关闭订单，15分钟时间到了，延迟消息队列自动将消息投递给消费者，消费者实现关闭订单逻辑，我之前疑惑的是这15分钟之间如果用户支付了订单会出现什么问题，现在我有一个想法就是如果用户支付了订单，就执行正常的消息队列通知交易服务修改订单支付状态的逻辑，然后15分钟时间到了之后，延迟消息队列将订单号消息投递给消费者，消费者需要确保幂等性，先查询数据库的订单状态是不是已支付，如果已支付就不做处理，如果是未支付才执行关闭订单逻辑。

完整逻辑：

- 15分钟时间到，消费者查询订单         
- 检测订单状态，判断是否已支付             
- 订单不存在或者已经支付，直接返回                
- 未支付，需要查询支付流水状态，防止支付成功但还未及时通知到数据库修改支付状态 
- 判断是否支付             
- 已支付，标记订单状态为已支付             
- 未支付，取消订单，恢复库存
