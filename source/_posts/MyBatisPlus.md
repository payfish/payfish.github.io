---
title: MyBatis-Plus
date: 2024-07-22 15:15:04
tags: MyBatis-plus
category: 微服务组件
---

### 简介

[MyBatis-Plus](https://github.com/baomidou/mybatis-plus) 是一个 [MyBatis](https://www.mybatis.org/mybatis-3/) 的增强工具，在 MyBatis 的基础上只做增强不做改变，为简化开发、提高效率而生。引入它不会对现有工程产生影响，如丝般顺滑。

### 依赖

```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-boot-starter</artifactId>
    <version>3.5.3.1</version>
</dependency>
```

### 注解

**`@TableName(value = "", schema = ""....)`**

- 描述：表名注解，标识实体类对应的表
- 使用位置：实体类

> 除了常见的value属性，还支持如下属性

| **属性**         | **类型** | **必须指定** | **默认值** | **描述**                                                     |
| ---------------- | -------- | ------------ | ---------- | ------------------------------------------------------------ |
| value            | String   | 否           | ""         | 表名                                                         |
| schema           | String   | 否           | ""         | schema                                                       |
| keepGlobalPrefix | boolean  | 否           | false      | 是否保持使用全局的 tablePrefix 的值（当全局 tablePrefix 生效时） |
| resultMap        | String   | 否           | ""         | xml 中 resultMap 的 id（用于满足特定类型的实体类对象绑定）   |
| autoResultMap    | boolean  | 否           | false      | 是否自动构建 resultMap 并使用（如果设置 resultMap 则不会进行 resultMap 的自动构建与注入） |
| excludeProperty  | String[] | 否           | {}         | 需要排除的属性名 @since 3.3.1                                |



**`@TableId(value = "id", type = IdType.AUTO)`**

- 描述：主键注解，标识实体类中的主键字段
- 使用位置：实体类的主键字段

>  IdType 是枚举类，默认值为ASSIGN_ID，支持的类型如下

| **值**        | **描述**                                                     |
| :------------ | :----------------------------------------------------------- |
| AUTO          | 数据库 ID 自增                                               |
| NONE          | 无状态，该类型为未设置主键类型（注解里等于跟随全局，全局里约等于 INPUT） |
| INPUT         | insert 前自行 set 主键值                                     |
| ASSIGN_ID     | 分配 ID(主键类型为 Number(Long 和 Integer)或 String)(since 3.3.0),使用接口IdentifierGenerator的方法nextId(默认实现类为DefaultIdentifierGenerator雪花算法) |
| ASSIGN_UUID   | 分配 UUID,主键类型为 String(since 3.3.0),使用接口IdentifierGenerator的方法nextUUID(默认 default 方法) |
| ID_WORKER     | 分布式全局唯一 ID 长整型类型(please use ASSIGN_ID)           |
| UUID          | 32 位 UUID 字符串(please use ASSIGN_UUID)                    |
| ID_WORKER_STR | 分布式全局唯一 ID 字符串类型(please use ASSIGN_ID)           |



**`@TableField`**

- 描述：普通字段注解

> 只有特殊情况下我们才需要给字段添加`@TableField`注解：

- 成员变量名与数据库字段名不一致

- 成员变量是以`isXXX`命名，按照`JavaBean`的规范，`MybatisPlus`识别字段时会把`is`去除，这就导致与数据库不符。

- 成员变量名与数据库一致，但是与数据库的关键字冲突。使用`@TableField`注解给字段名添加转义字符：``

  如 ``order``



### 配置

和 MyBatis 的配置几乎一样，

```YAML
mybatis-plus:
	type-aliases-package: com.hmall.service.domain.po
global-config:
	db-config:
  		id-type: auto # 全局id类型为自增长
```



### 实例

#### 替代MyBatis

> 自定义的方法统统不再需要了

```java
public interface UserMapper extends BaseMapper<User> {
//    void saveUser(User user);
//    void deleteUser(Long id);
//    void updateUser(User user);
//    User queryUserById(@Param("id") Long id);
//    List<User> queryUserByIds(@Param("ids") List<Long> ids);
}
```

> 取而代之的是BaseMapper提供给我们的方法

```java
userMapper.insert(user);
User user = userMapper.selectById(5L);
List<User> users = userMapper.selectBatchIds(List.of(1L, 2L, 3L, 4L));
userMapper.updateById(user);
List<User> queryUserByIds(@Param("ids") List<Long> ids);
```



#### Wrapper

条件构造器，上面的方法只能基于id进行简单的crud，一些复杂的查询条件我们需要借助这玩意儿来生成。

![wrapper继承结构](wrapper继承结构.png)

**QueryWrapper**：查询条件构造器，当然也可以用来更新

> ``SELECT id,username,info,balance FROM user WHERE (balance >= ? AND username LIKE ?)``

```java
@Test
void testQueryWrapper() {
    QueryWrapper<User> wrapper = new QueryWrapper<User>()
            .select("id", "username", "info", "balance")
            .ge("balance", 1000) //greater and equals
            .like("username", "o"); //LIKE '%值%'
    userMapper.selectList(wrapper).forEach(System.out::println);
}
```

**UpdateWrapper**：更新条件构造器

> ``UPDATE user SET balance = balance + 1000 WHERE (id IN (?,?,?))``

```java
@Test
void testUpdateWrapper() {
    List<Long> ids = List.of(1L, 2L, 4L);
    UpdateWrapper<User> wrapper = new UpdateWrapper<User>()
            .in("id", ids)
            .setSql("balance = balance + 1000");
    userMapper.update(null, wrapper);
}
```

**LambdaQueryWrapper**：

无论是QueryWrapper还是UpdateWrapper在构造条件的时候都需要写死字段名称，会出现字符串`魔法值`。这在编程规范中显然是不推荐的。 那怎么样才能不写字段名，又能知道字段名呢？

其中一种办法是基于变量的`gettter`方法结合反射技术。因此我们只要将条件对应的字段的`getter`方法传递给MybatisPlus，它就能计算出对应的变量名了。而传递方法可以使用JDK8中的`方法引用`和`Lambda`表达式。 因此MybatisPlus又提供了一套基于Lambda的Wrapper，包含两个：

- LambdaQueryWrapper
- LambdaUpdateWrapper

分别对应QueryWrapper和UpdateWrapper

> `SELECT id,username,info,balance FROM user WHERE (balance >= ? AND username LIKE ?)`

```java
@Test
void testLambdaQueryWrapper() {
    LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
            .select(User::getId, User::getUsername, User::getInfo, User::getBalance)
            .ge(User::getBalance, 1000)
            .like(User::getUsername, "o");
    userMapper.selectList(wrapper).forEach(System.out::println);
}
```

**自定义SQL**：

必须用`ew``，SqlSelect 是自定义的待查询字段，customSqlSegment 是自定义的查询条件

> `UPDATE user set balance = balance + ? WHERE (id IN (?,?,?))`

```java
@Test
    void listUserByCondition() {
        List<Long> ids = List.of(1L, 2L, 4L);
        LambdaQueryWrapper<User> lbWrapper = new LambdaQueryWrapper<User>()
                .select(User::getId, User::getUsername, User::getInfo, User::getBalance)
                .like(User::getUsername, "o")
                .in(User::getId, ids);
        userMapper.listUserByCondition("user", lbWrapper).forEach(System.out::println);
    }
//这里是UserMapper接口中的对应方法
@Select("select ${ew.SqlSelect} from ${tableName} ${ew.customSqlSegment}")
List<User> listUserByCondition(@Param("tableName") String tableName, @Param("ew") Wrapper wrapper);
```

自定义多表联查

> `select u.id,u.username,u.info,u.balance from user u INNER JOIN address a ON u.id = a.user_id WHERE (a.city = ? AND u.id IN (?,?,?))

```java
@Test
void testCustomJoinWrapper() {
    List<Long> ids = List.of(1L, 2L, 4L);
    QueryWrapper<User> wrapper = new QueryWrapper<User>()
            .select("u.id", "u.username", "u.info", "u.balance")
            .eq("a.city", "北京")
            .in("u.id", ids);
    userMapper.listUserCustomJoin(wrapper).forEach(System.out::println);
}
//这里是UserMapper中的对应方法
@Select("select ${ew.SqlSelect} from user u INNER JOIN address a ON u.id = a.user_id 		  			${ew.customSqlSegment}")
List<User> listUserCustomJoin(@Param("ew") QueryWrapper<User> wrapper);

```



#### IServcie

IServcie接口为我们封装了一系列CRUD操作，当我们自己的Service继承了IServcie，且我们自己Service的实现类继承了ServiceImpl（也就是IServcie的实现类）后，我们可以在Controller中直接调用IServcie提供的方法而不需要编写一句Service代码。当然复杂的除外。

```java
public interface IUserService extends IService<User> {
    void deductMoneyById(Long id, Integer money);
}
```

```java
@Service
public class IUserServiceImpl extends ServiceImpl<UserMapper, User> implements IUserService {//这里继承的ServiceImpl固定两个参数<继承自BaseMapper的自定义Mapper，对应的实体类>
    @Override
    public void deductMoneyById(Long id, Integer money) {
        User user = getById(id);
        if (user == null || user.getStatus() == 2) throw new RuntimeException("异常");
        if (user.getBalance() < money) throw new RuntimeException("异常");
        LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<User>()
                .eq(User::getId, id)
                .set(User::getBalance, user.getBalance() - money);
        	  //.setSql("balance = balance - " + money); // 这种方式存在 SQL 注入风险
       update(null, wrapper);
    }
}
```

> Controller

```java
@RestController()
@RequestMapping("/users")
@Api(tags = "用户管理接口")
@RequiredArgsConstructor()
public class UserController {

    private final IUserService userService;

    @ApiOperation("新增用户")
    @PostMapping()
    public void addUser(@RequestBody UserFormDTO userFormDTO) {
        User user = BeanUtil.copyProperties(userFormDTO, User.class);
        userService.save(user);
    }

    @ApiOperation("删除用户")
    @DeleteMapping("{id}")
    public void deleteUserById(@ApiParam("用户id") @PathVariable("id") Long id) {
        userService.removeById(id);
    }

    @ApiOperation("根据id查询用户")
    @GetMapping("/{id}")
    public UserVO selectUserById(@ApiParam("用户id") @PathVariable("id") Long id) {
        User user = userService.getById(id);
        return BeanUtil.copyProperties(user, UserVO.class);
    }

    @ApiOperation("根据ids查询用户")
    @GetMapping
    public List<UserVO> byIds(@ApiParam("用户id集合") @RequestParam("ids") List<Long> ids) {
        List<User> users = userService.listByIds(ids);
        return BeanUtil.copyToList(users, UserVO.class);
    }

    @ApiOperation("根据id扣减余额")
    @PutMapping("/{id}/deduct{money}")
    public void deductMoneyById(@ApiParam("用户id") @PathVariable("id") Long id,
                                        @ApiParam("扣减金额") @PathVariable("money") Integer money) {
        userService.deductMoneyById(id, money);
    }
}
```

#### 批处理

`rewriteBatchedStatements=true` 是一个 MySQL 连接参数，用于优化批量插入操作的性能。它的作用是将多条 SQL 语句重写为一条更大、更高效的 SQL 语句，从而减少与数据库服务器之间的通信次数，提高插入操作的速度。

#### 逻辑删除

顾名思义，删除时只是设置某个字段的值为某特殊值，而不是真正的删除，比如设置 deleted = 1，MyBatisplus会自动帮我们在所有SQL语句最后加上对 deleted的判断。如下，删除操作其实是更新操作。

这样有利也有弊，数据堆积问题，影响查询效率

> UPDATE address SET deleted=1 WHERE id=? AND deleted=0
>
> SELECT id,user_id,province,city,town,mobile,street,contact,deleted FROM address WHERE id=? AND deleted=0

```yaml
//只需为MP加一行配置
mybatis-plus:
  global-config:
    db-config:
      logic-delete-field: deleted
```

#### 枚举处理器

```java
@AllArgsConstructor
@Getter
public enum UserStatus {

    NORMAL(1, "正常"),
    FREEZE(2, "冻结");

    @EnumValue //MyBatis Plus 提供的注解，用于指定哪个字段值将被映射到数据库中的相应列。
    private final int status;
    @JsonValue //指定SpringMVC返回给前端的UserVO中的status字段显示的值
    //具体来说，用于指定在将枚举类型序列化为 JSON 时，使用哪个字段值作为枚举的 JSON 表示。
    private final String desc;
```

```yaml
mybatis-plus:
  configuration:
    default-enum-type-handler: com.baomidou.mybatisplus.core.handlers.MybatisEnumTypeHandler
```

#### JSON处理器

我们想把User实体对象中的info字段也改为一个自定义类型存储，之前是String类型，需要引入JSON处理器，帮助我们处理数据库中info字段和User实体类中info字段的转换。

> `autoResultMap` 是 MyBatis-Plus 提供的一个功能，用于自动处理结果集的映射，特别是当实体类中包含嵌套对象或自定义类型时。它通过自动生成结果映射（ResultMap）来简化开发过程

> `typeHandler`：User实体类info字段是UserInfo对象，而数据库info字段是JSON字符串：{"age": 21, "intro": "小比崽子", "gender": "male"}，查询用户或者新增用户时，JacksonTypeHandler帮助我们反序列化和序列化。

简单来说，你的实体类中还嵌套了另一个自定义类型，User类嵌套了UserInfo类，就需要开启 `autoResultMap = true`，以及设置 `typeHandler`

```java
@TableName(value = "user", autoResultMap = true)
public class User {
/**
 * 详细信息
 */
	@TableField(typeHandler = JacksonTypeHandler.class)
	private UserInfo info;
}
```

### 细节

#### listByIds

此方法使用的SQL语句是 `where id in (?, ?, ?)`，即使你传入的ids列表是有序的，查出来的结果也可能不按照原本的顺序

可以使用 `ORDER BY FIELD(id, 5, 3, 1)` （假设blogIds是（5,3,1））子句，保证查出来的结果集按照ids原有的顺序排序

```
String idStr = StrUtil.join(",", blogIds);
List<Blog> blogs = query()
        .in("id", blogIds)
        .last("ORDER BY FIELD(id," + idStr + ")").list();
```
