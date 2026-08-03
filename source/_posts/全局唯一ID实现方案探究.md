---
title: 全局唯一ID实现方案探究
date: 2024-08-10 15:19:46
tags: 分布式
category: 分布式 

---

> 为什么需要全局唯一ID

单体架构基本都是单库且业务单表的结构，每个业务表的ID几乎都是通过AUTO_INCREMENT 默认从1开始自增。而在分布式系统下分库分表的设计，使得多个库或多个表存储相同的业务数据，这种情况根据数据库的自增ID就会产生相同ID的情况，不能保证主键的唯一性。

### UUID

Universally Unique Identifier，UUID是由一组32位数的16进制数字所构成，例如`59f51e7ea5ca453bbfaf2c1579f09f1d`

UUID有很多版本

- 基于时间的UUID：通过当前时间，随机数，和本地Mac地址来计算出来
- 基于名字的UUID（MD5）：通过计算名字和名字空间的MD5散列值得到
- 随机UUID：根据随机数，或者伪随机数生成UUID，JDK自带的UUID工具就是这个版本

缺点

- **不易于存储**：UUID太长，一个16进制数字半个字节，总共16字节128位，以 36 个字符的字符串格式表示（8-4-4-4-12），其中32个字符和4个连字符' - '。
- **对MySQL索引不利**：如果作为数据库主键，在InnoDB引擎下，UUID的无序性可能会引起数据位置频繁变动，严重影响性能
- **信息不安全**：基于MAC地址生成UUID的算法可能会造成MAC地址泄露，暴露使用者的位置。

### 数据库生成

分布式数据库本身其实也可以实现全局唯一ID，比如有三个数据库db1、db2、db3。只需为数据库设置相同的递增间距（`auto_increment_increment`）和不同的起点（`auto_increment_offset`）即可，如：

- db1: 1/4/7/10
- db2: 2/5/8/11
- db3: 3/6/9/12

这种方法明显的优势就是依赖于数据库自身不需要其他资源，并且ID号单调自增，可以实现一些对ID有特殊要求的业务。

但是缺点也很明显，首先它**强依赖DB**，当DB异常时整个系统不可用。虽然配置主从复制可以尽可能的增加可用性，但是**数据一致性在特殊情况下难以保证**。主从切换时的不一致可能会导致重复发号。其次就是**ID发号性能瓶颈限制在单台MySQL的读写性能**。

### Redis实现

Redis的INCR命令是原子自增操作，由于Redis自身的单线程的特点所以能保证生成的 ID 肯定是唯一有序的。

自定义ID格式64位，首位符号位，后31位时间戳，末32位序列号

> <--0--0000 0000 0000 0001 1111 0000 0000 111--0000 0000 0000 0000 1111 1111 0000 1111-->

```java
@Component
@RequiredArgsConstructor
public class RedisIDGenerator {

    private static final long BEGIN_TIMESTAMP = 1704067200L; //起始时间戳2024/1/1 0:0
    private static final int COUNT_BITS = 32;

    private final StringRedisTemplate stringRedisTemplate;

    public long nextId(String prefix) {
        LocalDateTime now = LocalDateTime.now();
        long nowEpochSecond = now.toEpochSecond(ZoneOffset.UTC);
        long timeStamp = nowEpochSecond - BEGIN_TIMESTAMP;//时间戳
        String date = now.format(DateTimeFormatter.ofPattern("yyyy:MM:dd"));
        long l = stringRedisTemplate.opsForValue().increment("icr:" + prefix + date);
        return timeStamp << COUNT_BITS | l;
    }
}
```

其中`increment("icr:" + prefix + date)` 可以实现每天生成一个不同的key，便于按年月日查询当天当月或者当年生成的ID数量，比如 prefix 是 "order"，那么对应的key就是"icr:order2024:08:10"。



> redis+lua脚本

```lua
local key = KEYS[1]
local beginTimestamp = tonumber(ARGV[1])
local countBits = tonumber(ARGV[2])

-- 获取当前时间的秒级时间戳
local now = redis.call('TIME')
local nowEpochSecond = tonumber(now[1])

-- 计算相对时间戳
local timeStamp = nowEpochSecond - beginTimestamp

-- 自增并获取自增值
local sequence = redis.call('INCR', key)

-- 生成唯一ID
local id = (timeStamp << countBits) | sequence

return id

```

```java
@Component
@RequiredArgsConstructor
public class RedisIDGenerator {

    private static final long BEGIN_TIMESTAMP = 1704067200L;
    private static final int COUNT_BITS = 32;
    
    private final StringRedisTemplate stringRedisTemplate;
    private final DefaultRedisScript<Long> script;

    @PostConstruct
    public void init() {
        script = new DefaultRedisScript<>();
        script.setScriptText(loadScript("redis_id_generator.lua"));
        script.setResultType(Long.class);
    }

    public long nextId(String prefix) {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy:MM:dd"));
        String key = "icr:" + prefix + date;
        Long id = stringRedisTemplate.execute(script, Collections.singletonList(key), String.valueOf(BEGIN_TIMESTAMP), String.valueOf(COUNT_BITS));
        if (id == null) {
            throw new IllegalStateException("ID generation failed");
        }
        return id;
    }

    private String loadScript(String scriptName) {
        try (InputStream inputStream = getClass().getResourceAsStream("/" + scriptName);
             BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            return reader.lines().collect(Collectors.joining("\n"));
        } catch (IOException e) {
            throw new IllegalStateException("Unable to load Lua script", e);
        }
    }
}

```

