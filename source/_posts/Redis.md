---
title: Redis
date: 2024-06-17 16:18:09
tags: Redis
category: 数据库
---

# Redis

### Linux下登录Redis

```shell
redis-cli -h 127.0.0.1 -p 6379 -a YourPassword --raw //raw显示原数据
```

### 使用Docker启动redis

```docker
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v /docker/redis/conf/redis.conf:/etc/redis/redis.conf \
  -v /docker/redis/data:/data \
  --restart unless-stopped \
  redis:latest \
  redis-server /etc/redis/redis.conf --appendonly yes --requirepass "123456"
```

> 注意：redis insight客户端需要填写用户名，默认为default

### Redis的数据格式

#### String

```java
47.121.141.189:6379> set name fuish
OK
47.121.141.189:6379> get name
"fuish"
47.121.141.189:6379> del name
(integer) 1
47.121.141.189:6379> exists name
(integer) 0
47.121.141.189:6379> set age 22
OK
47.121.141.189:6379> keys * //keys patten ：模式匹配键
1) "age"
2) "x"
47.121.141.189:6379> keys *ge
1) "age"
47.121.141.189:6379> set msg 中文消息也是以二进制保存
OK
47.121.141.189:6379> get msg
"\xe4\xb8\xad\xe6\x96\x87\xe6\xb6\x88\xe6\x81\xaf\xe4\xb9\x9f\xe6\x98\xaf\xe4\xbb\xa5\xe4\xba\x8c\xe8\xbf\x9b\xe5\x88\xb6\xe4\xbf\x9d\xe5\xad\x98"
47.121.141.189:6379> redis-cli -h 47.121.141.189 -p 6379 -a **** --raw //加上--raw参数表示以原始形式显示内容
47.121.141.189:6379> get msg
中文消息也是以二进制保存
47.121.141.189:6379> ttl msg //查看key过期时间
-1
47.121.141.189:6379> expire msg 10 // 设置key的过期时间，10s
1
47.121.141.189:6379> ttl msg
6
47.121.141.189:6379> ttl msg
2
47.121.141.189:6379> setex name 10 fuish //设置带有过期时间的键值对，10s
OK
47.121.141.189:6379> ttl name
4
47.121.141.189:6379> ttl name
0
47.121.141.189:6379> setnx name kk // 键不存在时才设置键的值
1
47.121.141.189:6379> get name
kk
47.121.141.189:6379> setnx name fuish
0
47.121.141.189:6379> get name
kk
```

#### List

旧版本底层是双向链表，新版本换成了quicklist

```java
127.0.0.1:6379> lpush list a b c d e  //push elements in the head of the list
(integer) 5
127.0.0.1:6379> lrange list 0 -1 
1) "e"
2) "d"
3) "c"
4) "b"
5) "a"
127.0.0.1:6379> rpop list // remove element in the tail
"a"
127.0.0.1:6379> lpop list
"e"
127.0.0.1:6379> llen list
(integer) 3
127.0.0.1:6379> lpush list  d e f g
(integer) 7
127.0.0.1:6379> lrange list 0 -1
1) "g"
2) "f"
3) "e"
4) "d"
5) "c"
6) "b"
7) "a"
127.0.0.1:6379> ltrim list 2 4  //trim 
OK
127.0.0.1:6379> lrange list 0 -1
1) "e"
2) "d"
3) "c"
```

#### Set

```java
127.0.0.1:6379> sadd animal dog
(integer) 1
127.0.0.1:6379> smembers animal
1) "dog"
127.0.0.1:6379> sadd animal dog // Duplicate element is NOT allowed in Set
(integer) 0
127.0.0.1:6379> sismember animal dog // Is dog a member of Set Animal
(integer) 1
127.0.0.1:6379> srem animal dog // Remove dog
(integer) 1
127.0.0.1:6379> sadd s1 dog cat pig
(integer) 3
127.0.0.1:6379> sadd s2 cat pig
(integer) 2
127.0.0.1:6379> sinter s1 s2 // Intersection of two Sets
1) "cat"
2) "pig"
127.0.0.1:6379> sunion s1 s2 // Union of two Sets
1) "dog"
2) "cat"
3) "pig"
127.0.0.1:6379>  sdiff s1 s2 // Difference of two Sets
1) "dog"

```

#### SortedSet（ZSet）

维护一个score，按照分数排序

```java
127.0.0.1:6379> zadd schools 700 清华 680 浙大 660 复旦 640 成电
(integer) 4
127.0.0.1:6379> zrange schools 0 -1
成电
复旦
浙大
清华
127.0.0.1:6379> zrange schools 0 -1 withscores
成电
640
复旦
660
浙大
680
清华
700
127.0.0.1:6379> zscore schools 清华
700
127.0.0.1:6379> zrank schools 清华 // Index of "清华"
3
127.0.0.1:6379> zrevrank schools 清华 // Reverse the rank of "清华" and output
0
127.0.0.1:6379> zrevrank schools 成电
3
127.0.0.1:6379> zrank schools 清华 
3
```

#### Hash

![](hash.png)

```java
127.0.0.1:6379> hset dog name fuish
1
127.0.0.1:6379> hset dog age 22
1
127.0.0.1:6379> hset dog msg hello
1
127.0.0.1:6379> hgetall dog
name
fuish
age
22
msg
hello
127.0.0.1:6379> hdel dog msg
1
127.0.0.1:6379> hgetall dog
name
fuish
age
22
127.0.0.1:6379> hdel dog msg
0
127.0.0.1:6379> hgetall dog
name
fuish
age
22
127.0.0.1:6379> hexists dog name
1
127.0.0.1:6379> hkeys dog
name
age

```

### 事务

不同于数据库事务是一个原子操作，要么全部成功要么全部失败。Redis事务只是一批任务的执行集合，允许个别失败，不影响其他任务的成功执行

### 持久化

#### RDB：Redis DataBase

- 配置文件自动每隔指定的时间间隔将Redis中的数据写入硬盘中

- save命令，生成dump.rbd，rdb 文件是紧凑的二进制文件，适合备份和传输。创建快照过程中Redis是阻塞的，性能开销大
- bgsave命令(background save)：Redis 通过fork系统调用创建一个子进程来完成快照操作（复制了映射到内存数据的页表），主进程可以同步接收请求。但是如果在快照之间发生故障，可能会丢失最新的一些数据。

![](rdb.png)

#### AOF ：Append-Only File

- Redis 可以将每个写操作都追加到一个日志文件中（AOF 文件）。
- Redis重启时，重新执行AOF文件中的命令来重建数据集。

![](aof.png)

**bgrewriteaof**

随着时间的推移，AOF 文件可能会变得非常大，因为它包含了大量的冗余命令。

`bgrewriteaof`命令的同样也是fork一个子进程去操作，主要目的是通过创建一个新的 AOF 文件来重写现有的 AOF 文件。这个新的 AOF 文件只包含恢复当前数据库状态所必需的最小命令集。它在后台运行，不会阻塞 Redis 的主线程，这意味着在重写 AOF 文件的过程中，Redis 仍然可以处理客户端的请求。

例如，假设 Redis 执行了多次对同一个键的修改操作，原始的 AOF 文件会记录每一次修改命令。而`bgrewriteaof`会根据当前键的最终状态生成一个新的 AOF 文件，其中可能只包含一条或几条必要的命令，从而大大减小了 AOF 文件的大小，提高了 Redis 的启动速度（因为在启动时需要加载 AOF 文件），并且在一定程度上提高了数据恢复的效率。

### 主从复制

将主节点（Master）上 的数据复制到从节点（Slave）

在Redis主从架构中，主节点负责处理所有的写操作，并将这些操作异步复制到从节点，从节点主要用于读取操作，以分担主节点的压力和提高读取性能

主从复制的主要作用是什么？

- **数据冗余**：实现了数据的热备份，是持久化之外的一种数据冗余方式
- **故障恢复**：如果主节点挂掉了，可以将一个从节点提升为主节点，实现故障的快速恢复

使用Sentinel哨兵来实现自动的故障转移，主节点挂掉后Sentinel会自动将一个从节点升级为主节点，保证系统的可用性

- **负载均衡：** 在主从复制的基础上，配合读写分离，可以由主节点提供写服务，由从节点提供读服务 *（即写 Redis 时连接主节点，读 Redis 时连接从节点）*，分担服务器负载。尤其是在写少读多的场景下，通过多个从节点分担读负载，可以大大提高 Redis 服务器的并发量。
- **高可用基石：** 除了上述作用以外，主从复制还是哨兵和集群能够实施的 **基础**。

Redis删除过期数据的策略：

- 惰性删除：只会在取出Key的时候才检查Key是否过期并删除，对CPU友好，但是内存中可能积压大量过期Key
- 定期删除：定期抽取一批Key执行删除过期Key的操作，对内存友好

Redis采用二者结合的方式

### 哨兵模式

哨兵模式用于监控Redis实例的健康状况，并在主节点故障时进行自动故障转移。它是一种高可用性解决方案，确保Redis集群能够在主节点发生故障时继续正常运行。

#### 工作机制

1. **监控**：Sentinel不断检查主节点和从节点是否正常运行。
2. **通知**：当某个节点出现问题时，Sentinel可以通知系统管理员或其他应用程序。
3. **自动故障转移**：如果主节点故障，Sentinel会自动将一个从节点提升为新的主节点，并将其他从节点指向新的主节点。
4. **配置提供**：客户端可以通过Sentinel获取当前的主节点地址，从而连接到正确的主节点。





### Redis生产问题

#### 缓存穿透
定义：客户端请求的数据在缓存和数据库中都找不到，缓存永不生效，请求全打到数据库。

解决方法
- 缓存空对象
    - 优点： 实现简单，维护方便
    - 缺点： 额外的内存消耗，且可能造成短期的数据不一致问题
- 布隆过滤器
    - 优点：内存占用少，没有多余的key
    - 缺点：实现复杂，且存在误判可能


#### 缓存雪崩
定义：同一时段大量的缓存key同时失效或者Redis服务宕机，导致大量请求到达数据库，带来巨大压力。

解决方案
- 给不同key的TTL添加随机值（√）
- 搭建Redis集群提高服务的可用性（废话）
- 给缓存业务添加降级限流策略
- 给业务添加多级缓存

#### 缓存击穿（热点key问题）
定义：一个被高并发访问并且缓存重建业务较复杂的key突然失效了，无数的请求访问会在瞬间给数据库带来巨大的冲击。

解决方案
- 互斥锁：同一时间只能有一个线程拿到锁执行缓存重建
    - 优点：简单方便，没有多余的内存消耗，保证强一致性
    - 缺点：线程等待获取锁的时间过长，可能有死锁风险

- 逻辑过期
    - 不设置TTL，加一个expire time，当前线程查询缓存发现逻辑过期时间已经过期后，获取互斥锁，开启一个新线程来为自己执行重建缓存的操作。其他线程查询这个缓存均返回过期数据就行，无需等待
    - 缺点：不保证一致性，有额外的内存消耗，实现复杂

### Redis验证码登录

- 客户端请求服务端，传给服务端手机号
- 服务端校验手机号是否合法，生成验证码，保存验证码到Redis，通过云服务发送验证码给对应手机号
- 客户端输入验证码登录，传给服务端手机号和验证码，服务端校验手机号，对比客户端验证码和Redis中的验证码
- 执行业务逻辑，根据手机号查询用户，没有就新建用户，生成一个随机Token（UUID）作为登录凭证，同时使用这个Token作为key，用户信息作为value，存入Redis中，方便后续校验
- 后续用户访问其他页面，需要登录校验，可以定义一个拦截器，`String token = request.getHeader("authorization");` 拿到前端请求中的Token，去Redis找对应的用户信息，并存入ThreadLocal中，方便未来使用

### 优惠券秒杀

几个关键点：

- 高并发情况下的库存超卖问题
- 一人一单
- 全局Id
- 自调用AOP解决方案

```java
@Service
public class VoucherOrderServiceImpl extends ServiceImpl<VoucherOrderMapper, VoucherOrder> implements IVoucherOrderService {

    @Resource
    private ISeckillVoucherService iSeckillVoucherService;
    @Resource
    private RedisIDGenerator redisIDGenerator;

    private final ConcurrentHashMap<Long, Object> locks = new ConcurrentHashMap<>();
    
    @Override
    public Result secKillByVoucherId(Long voucherId) {
        //查询优惠券
        SeckillVoucher seckillVoucher = iSeckillVoucherService.getById(voucherId);
        //判断秒杀是否开始
        if (seckillVoucher.getBeginTime().isAfter(LocalDateTime.now())) {
            return Result.fail("秒杀尚未开始！");
        }
        if (seckillVoucher.getEndTime().isBefore(LocalDateTime.now())) {
            return Result.fail("秒杀已经结束！");
        }
        //判断库存是否充足
        if (seckillVoucher.getStock() == 0) {
            return Result.fail("库存不足！");
        }
        Long userId = UserHolder.getUser().getId();
        //方案一：使用字符串常量池来保证userId的唯一性
//        synchronized (userId.toString().intern()) {
//            IVoucherOrderService iVoucherOrderServiceProxy = (IVoucherOrderService) AopContext.currentProxy();
//            return iVoucherOrderServiceProxy.createVoucherOrder(voucherId);
//        }
        
        //方案二：使用concurrentHashMap存储userId
        Object lock = locks.computeIfAbsent(userId, k -> new Object());
        synchronized (lock) {
            IVoucherOrderService iVoucherOrderServiceProxy = (IVoucherOrderService) AopContext.currentProxy();
            return iVoucherOrderServiceProxy.createVoucherOrder(voucherId);
        }
    }
    
    @Transactional
    public Result createVoucherOrder(Long voucherId) {
        //一人一单
        Long userId = UserHolder.getUser().getId();

        int count = query().eq("user_id", userId).eq("voucher_id", voucherId).count();
        if (count > 0) {
            return Result.fail("每人只能购买一张！");
        }
        //扣减库存
        boolean success = iSeckillVoucherService.update()
                .setSql("stock = stock - 1")
                .eq("voucher_id", voucherId)
                .gt("stock", 0)
                .update();
        if (!success) {
            return Result.fail("库存不足！");
        }
        //创建订单
        long orderId = redisIDGenerator.nextId("order");//使用redis实现的全局Id生成器
        VoucherOrder voucherOrder = new VoucherOrder();
        voucherOrder.setId(orderId);
        voucherOrder.setVoucherId(voucherId);
        voucherOrder.setUserId(userId);

        save(voucherOrder);
        //返回订单id
        return Result.ok(orderId);
    }
}
```

> 超卖解决方案

- 1.如上文，增加判断 `gt("stock", 0)`，也就是 `update SeckillVoucher set stock = stock - 1 WHERE id = 1001 and stock > 0`。当然这里也可以用CAS比较stock==之前查出来的stock，只是这样会阻塞很多没必要阻塞的线程，因为只要库存大于0便都可以执行操作
- 2.版本号，CAS操作
- 3.利用Redis单线程

### Redis实现分布式锁

基于synchronized悲观锁锁住UserId的方案存在以下问题：

- 单机模式下可行，但是效率低
- 集群模式下不可行，当在不同的端口启动项目时（模拟分布式集群），请求通过nginx负载均衡到不同的端口（部署项目的机器），而每台机器上运行的JVM进程都是独立的，synchronized锁不可能跨进程发挥作用

解决方案：分布式锁（集群模式下多进程可见的互斥锁）

- redis实现分布式锁，通过key（KeyPrefix+userId）--> value（UUID+ThreadId）锁到同一台redis中。
- 数据库实现
- zookeeper

> redis分布式锁控制一人一单实战

```java
public class RedisDistributedLock implements ILock{

    private String name;
    private StringRedisTemplate redisTemplate;
    private static final String keyPrefix = "lock:";
    private static final String idPrefix = UUID.randomUUID().toString(true) + "-";

    private static DefaultRedisScript<Long> UNLOCK_SCRIPT;//lua脚本保证解锁操作的原子性
    static {
        UNLOCK_SCRIPT = new DefaultRedisScript<>();
        UNLOCK_SCRIPT.setResultType(Long.class);
        UNLOCK_SCRIPT.setLocation(new ClassPathResource("unLock.lua"));
    }

    public RedisDistributedLock(String name, StringRedisTemplate redisTemplate) {
        this.name = name;
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean tryLock(long timeoutSeconds) {
        String lockKey = keyPrefix + name;
        String value = idPrefix + Thread.currentThread().getId();
        Boolean b = redisTemplate.opsForValue().setIfAbsent(lockKey, value, timeoutSeconds, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(b);
//        return BooleanUtil.isTrue(b);
    }


    @Override
    public void unlock() {
        redisTemplate.execute(UNLOCK_SCRIPT,
                Collections.singletonList(keyPrefix + name),
                idPrefix + Thread.currentThread().getId()
        );
    }
}
```

而之前秒杀功能中的synchronized锁便被替换为了自定义的redis锁

```java
RedisDistributedLock redisDistributedLock = redisLockFactory.createLock("order:" + userId);
boolean lock = redisDistributedLock.tryLock(1200);
if (!lock) {
    return Result.fail("一人只能下一单");
}
try {
    IVoucherOrderService iVoucherOrderServiceProxy = (IVoucherOrderService) AopContext.currentProxy();
    return iVoucherOrderServiceProxy.createVoucherOrder(voucherId);
} finally {
    redisDistributedLock.unlock();
}
```

unLock.lua脚本文件，判断将要解锁的锁（lockKey）下的value是不是自己之前设置的UUID+ThreadId，防止把别人的

锁解开了（删除了）

> lua脚本可以将该线程的这些redis命令原子地执行，执行过程中不允许其他线程的redis命令执行

```lua
--unLock.lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
```

### Redisson

基于Redis的setnx命令实现的分布式锁存在以下问题：

- 不可重入
- 不可重试
- 超时释放
- 主从一致性

> Redisson可重入锁原理

同Reentrantlock一样，Reentrantlock通过state变量记录重入的次数，重入锁state+1，释放锁state-1

Redisson通过redis的hash结构控制重入，其中key是锁的名称，value的键是线程的标识，值是重入次数，源码通过lua脚本控制获取锁和释放锁的操作，每次获取锁和释放锁都要为key重新设置有效期，除非释放锁导致重入次数归零，此时直接删除锁

> Redisson重试机制

利用信号量和发布订阅（pub、sub）功能实现等待、唤醒、获取锁失败的重试机制

> 超时续约

利用watchDog，每隔releaseTime/3的时间便重置超时时间

> 主从一致性保证

multiLock，redisson不再区分主从节点，分布式锁需要在每个redis节点同步更新，必须在所有节点都获取到重入锁，才算获取锁成功

### 总结对于Redis的各种数据结构的实战使用

#### String

用户使用手机号登录，后台生成验证码后，使用手机号作为key，存储验证码

```java
stringRedisTemplate.opsForValue().set(LOGIN_CODE_KEY + phone, code, LOGIN_CODE_TTL, TimeUnit.MINUTES);
```

#### Hash

用户登录后，生成一个随机Token（UUID）作为登录凭证，同时使用这个Token作为key，用户信息作为value，存入Redis中，用户信息被转换成了一个HashMap。后续该用户的各种访问，通过拦截器去Redis拿他的用户信息来进行校验。

```java
//
stringRedisTemplate.opsForHash().putAll(LOGIN_USER_KEY + token, userMap);
stringRedisTemplate.expire(LOGIN_USER_KEY + token, LOGIN_USER_TTL, TimeUnit.MINUTES);

// 基于token获取redis中的用户
Map<Object, Object> userMap = stringRedisTemplate.opsForHash().entries(LOGIN_USER_KEY + token);
```

#### Set

- 存储用户id，控制一个用户只能下一单（不重复性质）
- 共同关注功能（intersect函数功能，查交集）

#### ZSet

存储对应博文点赞的用户id，并按照时间戳排序，便于将最先点赞的用户展示在最前面

```java
stringRedisTemplate.opsForZSet().add(key, userId.toString(), System.currentTimeMillis());
```

### 异步秒杀

> 思路就是把对于库存余量和一人一单的判断放到redis去做，只要这两个条件满足就先允许用户下单，把订单信息存到一个消息队列中（这里使用阻塞队列简单实现），对于数据库的更新操作是通过监听消息队列后台异步执行的，提升了性能

```java
/**
 * 基于redis+阻塞队列实现异步秒杀
 * @param voucherId
 * @return
 */
@Override
public Result secKillByVoucherId(Long voucherId) {
    //上传秒杀优惠券时，使用redis的hash存储了秒杀开始和结束时间，以及库存
    Map<Object, Object> seckillMap = stringRedisTemplate.opsForHash().entries(SECKILL_MAP_KEY + voucherId);
    SeckillVoucherRedis svr = BeanUtil.mapToBean(seckillMap, SeckillVoucherRedis.class, false);
    if (svr.getBeginTime().isAfter(LocalDateTime.now())) {
        return Result.fail("秒杀尚未开始！");
    }
    if (svr.getEndTime().isBefore(LocalDateTime.now())) {
        return Result.fail("秒杀已经结束！");
    }
    Long userId = UserHolder.getUser().getId();
    Long res = stringRedisTemplate.execute(
            SECKILL_SCRIPT,
            Collections.emptyList(),
            voucherId.toString(),
            userId.toString()
    );
    assert res != null;
    int i = res.intValue();
    if (i != 0) return Result.fail(i == 1 ? "库存不足！" : "一人只能下一单");
    long orderId = redisIDGenerator.nextId("order");
    //生成订单，放到阻塞队列中
    VoucherOrder voucherOrder = new VoucherOrder();
    voucherOrder.setId(orderId);
    voucherOrder.setVoucherId(voucherId);
    voucherOrder.setUserId(userId);
    queue.add(voucherOrder);
    iVoucherOrderServiceProxy = (IVoucherOrderService) AopContext.currentProxy();
    return Result.ok(orderId);
}
```

> lua脚本

```lua
---
--- Generated by EmmyLua(https://github.com/EmmyLua)
--- Created by Fu1sh.
--- DateTime: 2024/8/16 22:42
---
local voucherId = ARGV[1]
local userId = ARGV[2]

local stockKey = 'seckill:map:'..voucherId
local orderKey = 'seckill:order:'..voucherId
-- 判断库存《hash》
if (tonumber(redis.call('hget', stockKey, 'stock')) <= 0) then
    return 1
end
-- 判断用户是否已经下过单《set》
if (redis.call('sismember', orderKey, userId) == 1) then
    return 2
end

redis.call('hincrby', stockKey, 'stock', -1)
redis.call('sadd', orderKey, userId)
return 0
```

> 以下是异步更新数据库的逻辑

```java
private IVoucherOrderService iVoucherOrderServiceProxy;

private static final ExecutorService pool = Executors.newSingleThreadExecutor();

private BlockingQueue<VoucherOrder> queue = new ArrayBlockingQueue<>(1024 * 1024);

@PostConstruct//当一个类的实例被创建并且所有的依赖已经注入后,@PostConstruct标记的方法就会被自动调用。
private void init() {
    pool.submit(() -> {
        while (true) {
            VoucherOrder voucherOrder = null;
            try {
                voucherOrder = queue.take();
                handlerVoucherOrder(voucherOrder);
            } catch (Exception e) {
                log.error("处理订单有异常发生：", e);
            }
        }
    });
}

/**
 * 异步将订单存入数据库
 * @param voucherOrder
 */
private void handlerVoucherOrder(VoucherOrder voucherOrder) {
    Long userId = voucherOrder.getUserId();
    RLock myLock = redissonClient.getLock("lock:order:" + userId);
    boolean lock = false;
    lock = myLock.tryLock();
    if (!lock) {
        log.error("不能重复下单");
        return;
    }
    try {
        iVoucherOrderServiceProxy.createVoucherOrder(voucherOrder);
    } finally {
        myLock.unlock();
    }
}

@Transactional
public void createVoucherOrder(VoucherOrder voucherOrder) {
    Long userId = voucherOrder.getUserId();
    Long voucherId = voucherOrder.getVoucherId();
    int count = query().eq("user_id", userId).eq("voucher_id", voucherId).count();
    if (count > 0) {
        log.error("不能重复下单");
    }
    //扣减库存
    boolean success = iSeckillVoucherService.update()
            .setSql("stock = stock - 1")
            .eq("voucher_id", voucherId)
            .gt("stock", 0)
            .update();
    if (!success) {
        log.error("库存不足");
    }
    save(voucherOrder);
}
```

#### 阻塞队列的缺点

- 基于JVM，队列中的元素存储在JVM内存中，不支持持久化，一旦掉电消息丢失
- 占内存，影响性能
- 只能存取消息一次

#### Redis消息队列

- List：双向链表，LPUSH，RPOP等，可以做消息队列，基于redis不占JVM内存，可持久化消息，满足消息有序性。但是无法避免消息丢失，且只支持单消费者（消息被一个消费者拿走就从List移除了）
- PubSub：发布订阅模式，支持多生产多消费者。但是不支持消息持久化，无法避免消息丢失，消息堆积有上限，超出时消息就丢失了
- Stream

`优点`：

1. 使用成本低。几乎每一个项目都会使用Redis，用Stream做消息队列就不需要额外再引入中间件，减少系统复杂性，运维成本，硬件资源。

`缺点`：

1. Redis 的数据都存储在内存中，内存持续增长超过机器内存上限，就会面临 OOM 的风险
2. Stream 作为Redis的一种数据结构，Redis 在持久化或主从切换时有丢失数据的风险，所以Stream也有丢失消息的风险
3. 所有的消息会一直保存在Stream中，没有删除机制。要么定时清除，那么设置队列的长度自动丢弃先入列消息

#### RabbitMQ实现异步秒杀

> 秒杀逻辑，判断用户是否具有秒杀资格

```java
/**
 * 基于redis+消息队列实现异步秒杀
 * @param voucherId
 * @return
 */
@Override
public Result secKillByVoucherId(Long voucherId) {
    Map<Object, Object> seckillMap = stringRedisTemplate.opsForHash().entries(SECKILL_MAP_KEY + voucherId);
    SeckillVoucherRedis svr = BeanUtil.mapToBean(seckillMap, SeckillVoucherRedis.class, false);
    if (svr.getBeginTime().isAfter(LocalDateTime.now())) {
        return Result.fail("秒杀尚未开始！");
    }
    if (svr.getEndTime().isBefore(LocalDateTime.now())) {
        return Result.fail("秒杀已经结束！");
    }
    Long userId = UserHolder.getUser().getId();
    Long res = stringRedisTemplate.execute(
            SECKILL_SCRIPT,
            Collections.emptyList(),
            voucherId.toString(),
            userId.toString()
    );
    assert res != null;
    int i = res.intValue();
    if (i != 0) return Result.fail(i == 1 ? "库存不足！" : "一人只能下一单");
    //走到这里代表有秒杀资格
    long orderId = redisIDGenerator.nextId("order");
    //生成优惠券订单
    VoucherOrder voucherOrder = new VoucherOrder();
    voucherOrder.setId(orderId);
    voucherOrder.setVoucherId(voucherId);
    voucherOrder.setUserId(userId);
    //将订单发布到消息队列中，VoucherOrderListener中实现监听
    try {
        rabbitTemplate.convertAndSend("secKill.topic", "secKill.success", voucherOrder);
    } catch (Exception e) {
        log.error("秒杀成功的消息发送失败，支付单id：{}， 优惠券id：{}", orderId, voucherId, e);
    }
    //直接返回前端
    return Result.ok(orderId);
}
```

> 监听器，监听秒杀消息，异步在后台扣减优惠券库存已经保存订单信息

```java
@Slf4j
@Service
public class VoucherOrderListener {

    @Resource
    private RedissonClient redissonClient;

    @Resource
    private IVoucherOrderService voucherOrderService;

    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(name = "secKill.success.queue"),
            exchange = @Exchange(name = "secKill.topic"),
            key = "secKill.success"
    ))
    public void onMessage(VoucherOrder voucherOrder) {
        try {
            handlerVoucherOrder(voucherOrder);
        } catch (Exception e) {
            log.error("处理订单有异常发生：", e);
            // 根据业务逻辑可以考虑消息重试或者放入死信队列
        }
    }

    private void handlerVoucherOrder(VoucherOrder voucherOrder) {
        Long userId = voucherOrder.getUserId();
        //理论上redis+lua脚本已经实现了一人一单的功能，同一个用户不可能走到这里，但是还是留着兜底用
        RLock lock = redissonClient.getLock("lock:order:" + userId);

        boolean isLocked = lock.tryLock();

        if (!isLocked) {
            log.error("用户重复下单，用户ID：{}", userId);
            return;
        }

        try {
            voucherOrderService.createVoucherOrder(voucherOrder);
        } finally {
            lock.unlock();
        }
    }
}
```
