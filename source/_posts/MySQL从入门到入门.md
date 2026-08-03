---
title: MySQL从入门到入门
date: 2024-04-11 21:43:27
tags: MySQL
category: 数据库
---

# 部署与启动
[阿里云安装MySQL](https://blog.csdn.net/qq_45441466/article/details/109670194)

### 启动MySQL服务
```
service mysql start / service mysqld start
```

### 登录MySQL
```
mysql -uroot -p
```
### docker启动

```docker
docker run -d \
  --name mysql \
  -p 3306:3306 \
  -e TZ=Asia/Shanghai \
  -e MYSQL_ROOT_PASSWORD=****** \
  mysql
```

# 基础

### 关系型数据库VS非关系型数据库  
关系型：二维表格模型，ACID特性（Atomicity，Consistency，Isolation，    Durability）。有MySQL、Oracle、SQL Server。慢，海量数据读写，扩展性和可用性  
非关系型：NoSQL，键值对存储，分布式，不保证ACID。有MongoDB、Redis、CouchDB。快，key-value查询，海量数据访问

### MySQL执行流程

![借用小林Coding的图](mysql查询流程.webp)

**Server层**

1、连接器

- 与客户端进行 TCP 三次握手建立连接
- 校验客户端的用户名和密码，如果用户名或密码不对，则会报错
- 如果用户名和密码都对了，会读取该用户的权限，然后后面的权限逻辑判断都基于此时读取到的权限

2、查询缓存

- 以key-value形式保存，key为SQL语句，value为SQL查询结果
- MySQL 8.0已经删除

3、解析器

- 词法分析：把SQL语句分解成关键词
- 语法分析：构建SQL语法树，方便后续模块获取表名、字段名等

4、执行SQL

- 预处理器：检查 SQL 查询语句中的表或者字段是否存在、将 ``select *`` 中的 ``*`` 符号，扩展为表上的所有列
- 优化器：将 SQL 查询语句的执行方案确定下来，比如在表里面有多个索引的时候，优化器会基于查询成本的考虑，来决定选择使用哪个索引。
- 执行器：与存引擎交互，过程为：
  - 主键索引查询
  - 全表扫描
  - 索引下推

5、总结

执行一条 SQL 查询语句，期间发生了什么？

- 连接器：建立连接，管理连接、校验用户身份；
- 查询缓存：查询语句如果命中查询缓存则直接返回，否则继续往下执行。MySQL 8.0 已删除该模块；
- 解析 SQL，通过解析器对 SQL 查询语句进行词法分析、语法分析，然后构建语法树，方便后续模块读取表名、字段、语句类型；
- 执行 SQL：执行 SQL 共有三个阶段：
  - 预处理阶段：检查表或字段是否存在；将 select * 中的 * 符号扩展为表上的所有列；
  - 优化阶段：基于查询成本的考虑，选择查询成本最小的执行计划；
  - 执行阶段：根据执行计划执行 SQL 查询语句，从存储引擎读取记录，返回给客户端；

###  存储引擎

MySQL存储引擎架构：采用插件式架构，支持多种存储引擎，我们甚至可以为不同的数据库表设置不同的存储引擎以适应不同场景的需要。存储引擎是基于表的，而不是数据库。目前MySQL默认使用InnoDB

- MyISAM：MySQL5.5之前的默认引擎，在插入和查询上性能很高，但不支持事务，只能添加表级锁
- Innodb：MySQL5.5之后的默认引擎，支持事务（唯一支持事务的引擎），行级锁，外键，性能不及MyISAM，更消耗资源
- Memory：数据存储在内存，Hash格式，多用于临时表

### DDL

DDL：Data Definition Language，定义/改变表的结构、数据类型、表之间的链接等操作。CREATE、DROP、ALTER，用于定义SQL模式、基本表、视图和索引的创建和撤销操作。

#### 创建数据库/表

创建/删除数据库

```sql
CREATE DATABASE 数据库名
drop database 数据库名
```

为了让数据库支持中文，也可以创建时指定编码

```sql
CREATE DATABASE IF NOT EXISTS 数据库名 DEFAULT CHARSET utf8 COLLATE utf8_general_ci;
```

创建表

```sql
create table 表名(列名 数据类型[列级约束条件],
             列名 数据类型[列级约束条件],
             ...
             [,表级约束条件])
```

修改表

```sql
ALTER TABLE 表名 [ADD 新列名 数据类型[列级约束条件]]
			    [DROP COLUMN 列名[restrict|cascade]]
				[ALTER COLUMN 列名 新数据类型]
```

我们可以通过ADD来添加一个新的列，通过DROP来删除一个列，不过我们可以添加restrict或cascade，默认是restrict，表示如果此列作为其他表的约束或视图引用到此列时，将无法删除，而cascade会强制连带引用此列的约束、视图一起删除。还可以通过ALTER来修改此列的属性。

#### 数据类型

1、smallint（16位有符号）、int（32位有符号）、unsigned int（32位无符号）、bigint（64位有符号）

2、字符串类型：CHAR和VARCHAR，CHAR是定长字符串，VARCHAR是变长字符串。

> CHAR 在存储时会在右边填充空格以达到指定的长度，检索时会去掉空格；VARCHAR 在存储时需要使用 1 或 2 个额外字节记录字符串的长度，检索时不需要处理。

3、定点类型DECIMAL和浮点类型FLOAT/DOUBLE: DECIMAL可以存储精确的小数值（货币相关），FLOAT/DOUBLE只能存储近似的小数值  
4、时间类型： 

- DATETIME(8字节)：1000-01-01 00:00:00 ~ 9999-12-31 23:59:59 
- TIMESTAMP(4字节)：1970-01-01 00:00:01 ~ 2037-12-31 23:59:59

#### 约束

**列级约束**

- 主键

- 唯一

- 外键：它用于建立两个表（主表和从表）之间的关联关系，确保从表中的某些列（外键列）的值必须与主表中的某些列（主键列或者唯一键列）的值相匹配，或者为 NULL。。假设客户表`customers`的主键是`customer_id`，订单表`orders`中的`customer_id`是外键。如果试图在`orders`表中插入一个`customer_id`为 999 的记录，而`customers`表中不存在`customer_id = 999`的客户，数据库将拒绝这个插入操作，因为这违反了外键约束，从而维护了数据的完整性。

  ```sql
  CREATE TABLE customers (
      customer_id INT PRIMARY KEY,
      customer_name VARCHAR(50)
  );
  
  CREATE TABLE orders (
      order_id INT PRIMARY KEY,
      customer_id INT,
      order_date DATE,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
  );
  ```

  `orders`表中的`customer_id`列被定义为外键，它参照（REFERENCES）`customers`表中的`customer_id`列（主键）。

- 受检（MySQL不支持，SQL Server支持）

- default

- 非空/空值 not null/ null

**表级约束**

- 主键
- 唯一
- 外键
- 受检（MySQL不支持，SQL Server支持）

### DML

Data Manipulate Language，INSERT、UPDATE、DELETE

插入数据

```sql
INSERT INTO 表名 VALUES(值1, 值2, 值3)
```

如果插入的数据与列一一对应，那么可以省略列名，但是如果希望向指定列上插入数据，就需要给出列名

```sql
INSERT INTO 表名(列名1, 列名2) VALUES(值1, 值2)
```

我们也可以一次性向数据库中插入多条数据:

```sql
INSERT INTO 表名(列名1, 列名2) VALUES(值1, 值2), (值1, 值2), (值1, 值2)
```

数据量过大时改用load优化。

### DQL

Data Query Language

#### 单表查询

```sql
-- 指定查询某一列数据
SELECT 列名[,列名] FROM 表名
-- 会以别名显示此列
SELECT 列名 别名 FROM 表名
-- 查询所有的列数据
SELECT * FROM 表名
-- 只查询不重复的值
SELECT DISTINCT 列名 FROM 表名
```

#### 多表查询

多表查询是同时查询的两个或两个以上的表，多表查询会通过连接转换为单表查询。

```sql
SELECT * FROM 表1, 表2
SELECT * FROM 表1, 表2 WHERE 条件
```

直接这样查询会得到两张表的笛卡尔积，也就是每一项数据和另一张表的每一项数据都结合一次，会产生庞大的数据。

**自连接查询**

自身连接，就是将表本身和表进行笛卡尔积计算，得到结果，但是由于表名相同，因此要先起一个别名：

```sql
SELECT * FROM 表名 别名1, 表名 别名2
```

其实自身连接查询和前面的是一样的，只是连接对象变成自己和自己了。

**外连接查询**

外连接就是专门用于联合查询情景的，比如现在有一个存储所有用户的表，还有一张用户详细信息的表，我希望将这两张表结合到一起来查看完整的数据，我们就可以通过使用外连接来进行查询，外连接有三种方式：

- inner join，内连接，只会返回两个表满足条件的交集部分
- left join，左连接，返回左表的全部数据以及交集部分，而在右表中缺失的数据会使用`null`来代替
- right join，右连接，同理

**嵌套查询**（子查询）

我们可以将查询的结果作为另一个查询的条件，比如：

```sql
SELECT * FROM 表名 WHERE 列名 = (SELECT 列名 FROM 表名 WHERE 条件)
```

#### 函数

聚合函数：聚合函数用于对一组值进行计算并返回单一的值。它们通常用于查询中的`GROUP BY`子句，用于对分组后的数据进行统计分析。

- COUNT()：用于计算查询结果中的行数。例如，要统计一个名为`users`表中的用户数量，可以使用`SELECT COUNT(*) FROM users;`。这里的`*`表示计算所有行，如果只想计算某一列非空值的数量，可以指定具体的列名，如`SELECT COUNT(username) FROM users;`。
- SUM()：对某一列的数值进行求和。例如，在一个`orders`表中，有`order_amount`列，表示每个订单的金额，要计算所有订单的总金额，可以使用`SELECT SUM(order_amount) FROM orders;`。
- AVG()：计算某一列数值的平均值。假设`scores`表中有`score`列，表示学生的考试成绩，要计算平均成绩可以使用`SELECT AVG(score) FROM scores;`。
- MIN () 和 MAX ()：分别用于获取某一列中的最小值和最大值。例如，在`products`表中有`price`列，表示产品价格，要找到最低价格和最高价格的产品，可以使用`SELECT MIN(price) FROM products;`和`SELECT MAX(price) FROM products;`。

字符串函数

- CONCAT()：用于连接两个或多个字符串。例如，在`users`表中有`first_name`和`last_name`列，要将用户的名和姓连接成一个完整的姓名，可以使用`SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM users;`。
- SUBSTRING()：用于截取字符串的一部分。例如，从一个`text`列中截取前 10 个字符，可以使用`SELECT SUBSTRING(text, 1, 10) FROM my_table;`，这里`1`表示起始位置，`10`表示要截取的长度。
- UPPER () 和 LOWER ()：分别用于将字符串转换为大写和小写形式。例如，将`users`表中的`username`列中的字符串转换为大写，可以使用`SELECT UPPER(username) FROM users;`。

日期和时间函数

- NOW()：返回当前的日期和时间。例如，要获取当前系统的日期和时间并插入到`logs`表中的`log_time`列，可以使用`INSERT INTO logs (log_time) VALUES (NOW());`。
- DATE ()、TIME () 和 DATETIME ()：分别用于从日期时间值中提取日期部分、时间部分或者保持日期时间值不变。例如，在`events`表中有`event_datetime`列（类型为`DATETIME`），要只获取日期部分，可以使用`SELECT DATE(event_datetime) FROM events;`。
- DATE_ADD () 和 DATE_SUB ()：用于在日期上进行加法和减法运算。例如，在`orders`表中，`order_date`列记录订单日期，要计算订单日期 3 天后的日期，可以使用`SELECT DATE_ADD(order_date, INTERVAL 3 DAY) FROM orders;`。

数学函数

- ROUND()：用于将一个数值四舍五入到指定的小数位数。例如，对`1.2345`进行四舍五入保留两位小数，可以使用`SELECT ROUND(1.2345, 2);`，结果为`1.23`。
- CEIL () 和 FLOOR ()：分别用于向上取整和向下取整。例如，对于`1.2`，`CEIL(1.2)`结果为`2`，`FLOOR(1.2)`结果为`1`。

条件函数

- IF()：根据条件判断返回不同的值。例如，在`students`表中有`score`列，要根据分数判断是否及格（60 分及以上为及格），可以使用`SELECT IF(score >= 60, '及格', '不及格') FROM students;`。
- CASE WHEN... THEN... ELSE... END：这是一种更复杂的条件判断结构。例如，在`employees`表中有`salary`列，要根据工资范围进行分类，可以使用

### DCL

Data Control Language，庞大的数据库不可能由一个人来管理，我们需要更多的用户来一起管理整个数据库。

**创建用户**

```sql
CREATE USER 用户名 identified by 密码;
CREATE USER 用户名; -- 不带密码
```

我们可以通过@来限制用户登录的登录IP地址，`%`表示匹配所有的IP地址，默认使用的就是任意IP地址。

**用户授权**

```sql
grant all|权限1,权限2...(列1,...) on 数据库.表 to 用户 [with grant option]
```

其中all代表授予所有权限，当数据库和表为`*`，代表为所有的数据库和表都授权。如果在最后添加了`with grant option`，那么被授权的用户还能将已获得的授权继续授权给其他用户。

我们可以使用`revoke`来收回一个权限：

```sql
revoke all|权限1,权限2...(列1,...) on 数据库.表 from 用户
```

### 事务

事务就是一组原子性的SQL执行单元，其中的SQL语句要么全部成功，只要有一条失败，事务就会回滚

#### ACID

- Atomicity：原子性，单个事务，不可能只执行其中的一部分SQL语句，所有语句要么全部执行成功，要么全部失败。
- Consistency：一致性，事务保证了数据库的数据从一个状态转移到另一个状态，比如四条语句，第一条update使得money - 100，但是只要事务没有成功提交，这个update操作也不会成功，money不会-100，保证了数据的一致性。
- Isolation：隔离性，一个事务所做的修改在还未成功提交之前，对其他事务是不可见的，比如money-100的事务还未提交之前的任意时刻，其他事务来查询money都是未-100的原始数据。
- Durability：持久性，一旦事务提交，其所做的修改就永久保存到数据库中

InnoDB 引擎通过什么技术来保证事务的这四个特性的呢？

- 持久性是通过 redo log （重做日志）来保证的；
- 原子性是通过 undo log（回滚日志） 来保证的；
- 隔离性是通过 MVCC（多版本并发控制） 或锁机制来保证的；
- 一致性则是通过持久性+原子性+隔离性来保证；

### 事务的隔离级别

#### 读未提交

Read Uncommitted，允许事务访问其他事务未提交的数据

脏读，不可重复读，幻读

#### 读已提交

Read Committed，事务只能访问其他事务已提交的数据，在每个 select 都会生成一个新的 Read View，也意味着，事务期间的多次读取同一条数据，前后两次读的数据可能会出现不一致，因为可能这期间另外一个事务修改了该记录，并提交了事务。

不可重复读，幻读

#### 可重复读

Repeatable Read，事务执行过程中访问的数据都是事务开启之前的。也就是说事务执行过程中维护一个事务开启前的数据Read view。Innodb默认隔离级别

幻读

#### 串行化

 Serializable，顾名思义，对记录加上读写锁，如果发生读写冲突，事务按照访问的先后顺序执行

- 脏读：事务读取到其他事务还未提交的数据
- 不可重复读：事务**多次读取同一个数据**前后两次数据不一致
- 幻读：事务多次查询某记录数量前后两次记录数量不一致（记录被增删）

### 视图

视图可以将多个表的复杂查询封装成一个虚拟表。当查询涉及多个表的连接、嵌套查询等复杂操作时，直接编写查询语句可能会很繁琐且难以理解。通过创建视图，可以将这些复杂的查询逻辑隐藏在视图内部，对外只提供一个简单的视图名称作为查询对象。

假设存在一个包含订单信息（订单表`orders`）、客户信息（客户表`customers`）和产品信息（产品表`products`）的数据库系统。要查询每个客户购买的产品名称、数量和总价，需要连接这三个表并进行一些计算。可以创建一个视图`customer_product_summary`，在这个视图中定义好连接和计算逻辑。之后，当需要获取相关信息时，只需查询这个视图即可，如`SELECT * FROM customer_product_summary`，而无需每次都重新编写复杂的多表连接和计算的查询语句。

```sql
CREATE VIEW 视图名称(列名) as 子查询语句 [WITH CHECK OPTION];
```

WITH CHECK OPTION是指当创建后，如果更新视图中的数据，是否要满足子查询中的条件表达式，不满足将无法插入，创建后，我们就可以使用`select`语句来直接查询视图上的数据了，因此，还能在视图的基础上，导出其他的视图。不过更新视图有几个规则：

- 若视图是由两个以上基本表导出的，则此视图不允许更新。
- 在一个不允许更新的视图上定义的视图也不允许更新
- 若视图定义中含有GROUP BY子句，则此视图不允许更新。
- 若视图定义中含有DISTINCT短语，则此视图不允许更新。

### 触发器

触发器就像其名字一样，在某种条件下会自动触发，在`select`/`update`/`delete`时，会自动执行我们预先设定的内容，触发器通常用于检查内容的安全性，相比直接添加约束，触发器显得更加灵活。

触发器所依附的表称为基本表，当触发器表上发生`select`/`update`/`delete`等操作时，会自动生成两个临时的表（new表和old表，只能由触发器使用）

比如在`insert`操作时，新的内容会被插入到new表中；在`delete`操作时，旧的内容会被移到old表中，我们仍可在old表中拿到被删除的数据；在`update`操作时，旧的内容会被移到old表中，新的内容会出现在new表中。

```sql
CREATE TRIGGER 触发器名称 [BEFORE|AFTER] [INSERT|UPDATE|DELETE] ON 表名/视图名 FOR EACH ROW DELETE FROM student WHERE student.sno = new.sno
```

FOR EACH ROW表示针对每一行都会生效，无论哪行进行指定操作都会执行触发器！

### 存储过程

存储过程是一个包括多条SQL语句的集合，专用于特定表的特定操作

存储过程是跟函数归到一类的，但是存储过程跟函数的本质区别就是，函数必须在一条SQL语句中才能使用，而存储过程就行我们java的一个真正的函数一样，可以通过call来直接调用，不用写SQL

定义存储过程与定义函数极为相似，它也可以包含参数，函数中使用的语句这里也能使用，但是它没有返回值:
```sql
CREATE PROCEDURE lbwnb(`name`VARCHAR(20),pWd VARCHAR(255))
BEGIN
	INSERT INTO users(username,`password`) VALUES(`name`, pwd);
END
```

我们可以在存储过程中编写多条SQL语句，但是注意，MySQL的存储过程不具有原子性，当出现错误时，并不会回滚之前的操作，因此需要我们自己来编写事务保证原子性。

**游标**：cursor，可以把游标看作是一个指向查询结果集中某一行的指针，通过游标可以定位到结果集中的特定行，然后对该行的数据进行读取、修改或删除等操作。逐行遍历

```sql
BEGIN
    DECLARE id INT;
    DECLARE `name` VARCHAR(10);
    DECLARE ex VARCHAR(5);
    DECLARE cur CURSOR FOR SELECT * FROM student;//定义游标遍历select查询结果集的所有行
    OPEN cur;
    WHILE TRUE DO
    FETCH cur INTO id, `name`, sex;
    SELECT id,`name`, sex;
    END WHILE;
    CLOSE cur;
END
```

**IN/OUT**

用来限定存储过程的参数传递，参数默认为IN类型，IN表示用户输入的参数（a）能被存储过程拿到，但是无法为其赋值，OUT参数无法作为传入参数，但可以为其赋值，我们可以将参数设置为INOUT类型，表示既可以作为传入参数又可以赋值

```sql
CREATE PROCEDURE `lbwnb` (OUT a INT) 
BEGIN
    SELECT a;
    SET a = 100;
END
```

# 索引

1、索引是一种用于快速查询和检索数据的数据结构，其本质可以看成是一种排序好的数据结构。索引底层数据结构存在很多种类型，常见的索引结构有: B 树， B+树 和 Hash、红黑树。在 MySQL 中，无论是 Innodb 还是 MyIsam，都使用了B+树作为索引结构。索引存储在文件系统中，占用物理空间。

2、索引结构优劣对比

```
对于树型索引结构，树的深度加深一层，意味着多一次查询，对于数据库磁盘而言，就是多一次IO操作，导致查询效率低下。
```
- Hash：不支持范围查询
- 二叉搜索树：极端情况会成为一个链表
- 二叉平衡树（AVL）：频繁旋转降低性能、每个树节点存储一个数据，若查询的数据分布在多个节点，会进行多次磁盘IO
- 红黑树：平衡性较弱，可能导致树高变高。但插入删除操作仅需O(1)，因此TreeMap、TreeSet 以及 JDK1.8 的 HashMap 底层都用到了红黑树。
- B 树：数据分布在整棵树中，检索的过程相当于对范围内的每个节点的关键字做二分查找
- B+ 树：数据只存在于叶子结点，每一个叶子节点都包含指向下一个叶子节点的指针，从而方便叶子节点的范围遍历。

3、索引分类

按功能（逻辑分类）
- 主键索引：一张表只能有一个主键索引，不允许重复、不允许为 NULL。
- 唯一索引：数据列不允许重复，允许为 NULL 值，一张表可有多个唯一索引，索引列的值必须唯一，但允许有空值。如果是组合索引，则列值的组合必须唯一。
- 普通索引：一张表可以创建多个普通索引，一个普通索引可以包含多个字段，允许数据重复，允许 NULL 值插入。
- 全文索引：它查找的是文本中的关键词，主要用于全文检索。

按列数（逻辑分类）
- 单例索引：一个索引只包含一个列，一个表可以有多个单例索引。
- 组合索引：一个组合索引包含两个或两个以上的列。查询的时候遵循 mysql 组合索引的 “最左前缀”原则，即使用 where 时条件要按照建立索引的时候字段的排列方式放置索引才会生效。

物理分类

- 聚簇索引（clustered index）：数据和索引存储在一块，找到了索引就找到了需要的数据，那么这个索引就是聚簇索引。主键索引是聚簇索引。
- 二级索引：数据与索引分开存储，索引结构的叶子节点挂的是对应的主键
![聚集索引和回表查询](索引分类.png)


### 什么时候需要 / 不需要创建索引？
索引最大的好处是提高查询速度，但是索引也是有缺点的，比如：
- 需要占用物理空间，数量越大，占用空间越大；
- 创建索引和维护索引要耗费时间，这种时间随着数据量的增加而增大；
- 会降低表的增删改的效率，因为每次增删改索引，B+ 树为了维护索引有序性，都需要进行动态维护。

什么时候适用索引？
- 字段有唯一性限制的，比如商品编码；
- 经常用于 ``WHERE`` 查询条件的字段，这样能够提高整个表的查询速度，如果查询条件不是一个字段，可以建立联合索引。
- 经常用于 ``GROUP BY`` 和 ``ORDER BY`` 的字段，这样在查询的时候就不需要再去做一次排序了，因为我们都已经知道了建立索引之后在 B+Tree 中的记录都是排序好的。

什么时候不需要创建索引？
- 字段中存在大量重复数据时，如性别；
- 表数据太少时；
- 经常更新的字段不需要创建索引，比如不要对电商项目的用户余额建立索引，因为索引字段频繁修改，由于要维护 B+Tree 的有序性，那么就需要频繁的重建索引，这个过程是会影响数据库性能的。
- ``WHERE`` 条件，``GROUP BY``，``ORDER BY`` 里用不到的字段，索引的价值是快速定位，如果起不到定位的字段通常是不需要创建索引的，因为索引是会占用物理空间的。

### 索引语法
- 测试数据如下

![tb_user表](1.png)

- 创建索引 
```sql
create index idx_user_name on tb_user(name);//普通索引
create UNIQUE index idx_user_phone on tb_user(phone);//唯一索引
create index idx_user_pro_age_sta on tb_user(profession, age, status);//联合索引
```
- 查看索引 
```sql
show index from tb_user;
```
![查看索引](查看索引.png)

- 删除索引 
```sql
drop index user_name on tb_user;
```

### 索引性能分析
- explain
```sql
explain select * from tb_user;
```
![explain语法](explain.png)


### 最左前缀匹配法则

使用上面创建的联合索引``idx_user_pro_age_sta``
```sql
select * from tb_user where profession = "软件工程" and age = 31 and status = '0';
----或者----
select * from tb_user where age = 31 and status = '0' and profession = "软件工程";
查询语句中profession的位置不影响使用索引
```
索引会从创建索引时最左边的字段``profession``开始匹配，若存在就走索引，依次匹配下去，下图就是三个索引均用到了

![使用全部索引](最左前缀.png)

```sql
select * from tb_user where profession = "软件工程" and status = '0';
```
``age``没有匹配，则``status``也无法匹配

![仅用到profession索引](5.png)

```sql
select * from tb_user where age = 31 and status = '0';
```
最左前缀``profession``没有匹配，此条查询未走索引

![未走索引](6.png)

### 索引失效原则

- 使用函数

```sql
//查询手机号后两位等于15的user
 select * from tb_user where substring(phone, 10, 2) = '15'; //phone索引失效
```

- 字符串未加引号

  因为索引存的是字符串类型的值，你这里传进去的是整型，MySQL默认是遇到字符串和数字比较时把字符串转为数字，下面这条sql相当于第二句，对索引使用了函数，索引失效
```sql
 select * from tb_user where phone = 17799990015; 
 select * from tb_user where CAST(phone AS signed int) = 17799990015;
```

- 模糊查询

  索引是根据索引值有序存储的，只能根据前缀进行比较
```sql
 select * from tb_user where profession like '软件%'; //尾部模糊匹配，索引不失效
 select * from tb_user where profession like '%工程'; //头部模糊匹配，索引失效
```

- or 连接的条件

```sql
 select * from tb_user where id = '10' or age = '30'; //若or前面的条件有索引，后面的条件没有索引，索引失效
```

- 数据分布情况

MySQL视情况决定走不走索引

### SQL提示

```sql
select * from tb_user use index(idx_user_pro) where profession = '软件工程'; //建议数据库使用该索引
select * from tb_user ignore index(idx_user_pro_age_sta) where profession = '软件工程'; //让数据库忽略该索引
select * from tb_user force index(idx_user_pro) where profession = '软件工程'; //强制数据库使用该索引
```

### 前缀索引

```sql
create index idx_email_5 on tb_user(email(5));//数字5代表取email的前五个字符作为前缀索引，节省索引空间，降低建立索引的消耗
```

### 覆盖索引和回表查询

创建一个 phone 和 name 的联合索引，表中目前索引有：

![查看索引](7.png)

```sql
select id,phone,name from tb_user where phone = '17799990010' and name = '韩信';
```
![分析索引执行情况](8.png)

- 回表查询：由于 phone 和 name 均有唯一索引，而当前查询只走了 idx_user_phone 这条索引，故会根据 idx_user_phone 下的 id 值进行回表查询，查询 name 

- 覆盖索引：``select id,name from tb_user wherename = '韩信';``，idx_user_name 这条索引的叶子结点下挂的就是 id 值， 不需要回表查询，就叫覆盖索引
  

# 日志

![](微信截图_20240926173309.png)

### Binlog

undolog和redolog都是innodb存储引擎才有的，Binlog是MySQL层面的日志，主要作用有主从复制，全表备份，数据恢复等，还可以用于**数据审计**：企业可以通过分析 binlog 来审计数据库中的操作，查看哪些用户在什么时间执行了哪些操作，有助于保证数据的安全性和合规性

Canal 是阿里巴巴开源的一个基于 MySQL 数据库增量日志解析的组件。它主要用于将 MySQL 的二进制日志（binlog）解析为便于应用程序读取的格式，从而实现数据库的增量数据获取。例如，在数据同步场景中，Canal 可以将 MySQL 主库上的变更数据实时同步到从库或者其他数据存储系统中。

Binlog 有不同的工作模式，如 STATEMENT 模式、ROW 模式和 MIXED 模式。

- **STATEMENT 模式**：在这种模式下，binlog 记录的是执行的 SQL 语句。例如，当执行一条`INSERT INTO table_name (column1, column2) VALUES ('value1', 'value2')`语句时，binlog 会记录这条完整的 SQL 语句。这种模式的优点是日志文件相对较小，但是在一些复杂的情况下（如使用了函数、存储过程等）可能会导致数据不一致。
- **ROW 模式**：ROW 模式下，binlog 记录的是每一行数据的实际修改情况。例如，对于上述的`INSERT`操作，binlog 会记录插入的这一行数据的具体值。这种模式可以保证数据的准确性，但日志文件通常会比较大。
- **MIXED 模式**：MIXED 模式是前两种模式的混合，MySQL 会根据具体的操作情况选择以 STATEMENT 模式或者 ROW 模式记录 binlog。

### undo log

- 插入记录时，undo log中记录这条数据的主键值，之后若需要回滚只需要删除该主键值对应的记录
- 删除数据时，undo log记录这条数据的全部内容，回滚时只需把这条数据再插入即可
- 更新数据时，undo log记录被更新的列的旧值，回滚时把这些列更新为旧值即可

undo log 就是回滚日志，用来控制事务的回滚和MVCC，保证了原子性

### redo log

我们知道innodb有一个内存中的buffer pool缓冲池，查询数据库时若缓冲池没有再查磁盘，查到了刷到缓冲池中，写数据库时先修改缓冲池中的数据，被修改过的数据页就叫脏页（该页的数据与磁盘上的数据不一致），后续由后台线程将脏页写入磁盘，减少IO

但是buffer pool是基于内存的，掉电重启时有发生，不可靠，所以引入了redo log，更新数据时先更新内存缓冲池，标记脏页，同时把脏页的修改保存到redo log中（也是从redo log buffer 写到磁盘redo log 文件），事务提交时先将redo log持久化到磁盘，后续由后台线程将内存脏页写入磁盘时（这个叫WAL，write ahead logging 先写日志），如果这时系统掉电写入失败，就可以重启后去redo log 中更新最新数据。

> 简单记忆redo和undo log：redolog记录的是事务完成后的数据状态，记录更新后的值，undo记录事务开始前的状态

保证了持久性，不必多言，同时redo log是追加写的方式，磁盘操作是顺序IO，你buffer pool脏页写磁盘是随机IO，redo log还可以提升磁盘性能

### MVCC

#### 当前读和快照读

**当前读**读取记录的最新版本，对记录加锁，保证其他并发事务不能修改当前记录，比如select in share mode，select for update，和增删改

**快照读**就是简单的select语句，不加锁，读取到的某一个事务快照控制下的记录版本，可能读到历史版本。

读已提交隔离级别：每次select操作都生成一个快照（readView）

可重复读隔离级别：开启事务后的第一个select语句作为快照，后续事务中的快照读语句都复用这个快照

#### 隐藏字段

其实MySQL中的一个表innodb会自动帮你生成三个隐藏字段拼在后面，DB_TRX_ID（记录最后一次修改这条记录的事务的id）、DB_ROLL_PTR（回滚指针，指向这条记录的上一个版本）、DB_ROW_ID（隐藏主键，表没有指定主键时生成）

#### undolog 版本链

很好理解，并发事务1234如果同时开启，并且都会修改同一条数据，那么每一个事务修改后的记录都会写入undolog中，前面说过记录后面还有两个隐藏字段，记录修改该记录的事务id和一个指向记录的上一个版本的指针，如下图：

![](版本链.png)

#### MVCC原理

前面铺垫了这么多，接下来正式讲MVCC，在不同的隔离级别下，MVCC的实现方式是不同的，因为readView的原因，前面也说了读已提交隔离级别：每次select操作都生成一个快照（readView）。可重复读隔离级别：开启事务后的第一个select语句作为快照，后续事务中的快照读语句都复用这个快照，而一个快照中保存的就是生成快照的这一时刻的活动事务id、最小事务id等等一系列事务id信息。

所以并发事务工作时，一个事务中的快照读会根据快照信息去undolog中读取对应的记录信息，他是从版本链的当前记录出发，依次根据回滚指针往前的版本寻找，对比各个版本的事务id是否符合快照中规定的事务id匹配规则，从而拿到我应该读取哪个版本的记录信息的。总结下来就是：MVCC控制着事务在快照读的时候，读到的是记录的哪一个版本

![](rc.png)

**重要：**见上图，所以说为什么RC读已提交隔离级别会产生不可重复读和幻读现象，因为你事务5的第一条select语句拿到的快照是执行select时刻的快照，这时事务2已经提交，可以读到事务2修改的数据，但是第二条select语句执行时快照又是另一个了，又可以读到事务3修改的数据，所以会出现不可重复读（连续读取同一数据不一致）和幻读（两次记录数量不一致，比如记录被事务3删了）

而RR可重复读就只有幻读，因为事务5的两条select语句共享第一条select执行时的快照，两次快照都一样，读取的数据肯定是一样的

那为什么会有幻读？幻读指的是一个事务在两次查询结果集的过程中，另一个事务插入了满足查询条件的数据行，导致两次查询结果集的行数不同。如果事务5的两次查询都是范围查询，因为快照只针对已经存在的数据行，对于新插入的数据行，在后续的查询中可能会被发现，从而产生幻读现象。

所以又有了间隙锁，见下文锁。

# 锁

### 全局锁

锁住了DML和DDL操作

```sql
flush tables with read lock
unlock tables
```

>  全局锁应用场景是什么？

全局锁主要应用于做**全库逻辑备份**，这样在备份数据库期间，不会因为数据或表结构的更新，而出现备份文件的数据与预期的不一样。当然这样锁住整个数据库对业务的影响很大。

如果数据库引擎支持可重复读 隔离级别，那么在备份数据库之前先开启事务，会先创建 Read View，然后整个事务执行期间都在用这个 Read View，而且由于 MVCC 的支持，备份期间业务依然可以对数据进行更新操作。

备份数据库的工具是 mysqldump，在使用 mysqldump 时加上 `–single-transaction` 参数的时候，就会在备份数据库之前先开启事务。

### 表级锁

```sql
//表级别的共享锁，也就是读锁；
lock tables t_student read;
//表级别的独占锁，也就是写锁；
lock tables t_stuent write;
//会释放所有表的锁
unlock tables
```

元数据锁：（Meta Data Lock），在表上有活动事务的时候，不可以对元数据进行写入操作，保证当用户对表执行 CRUD 操作时，防止其他线程对这个表结构做了变更。

当我们对数据库表进行操作时，会自动给这个表加上 MDL，MDL 是在事务提交后才会释放，这意味着**事务执行期间，MDL 是一直持有的**。

### 行级锁

如果要在查询时对记录加行锁，可以使用下面这两个方式，这种查询会加锁的语句称为**当前读**（锁定读），这些语句必须放在事务中。

```sql
//普通查询不加锁（除了串行化隔离级别）
select ...
//共享锁（S型锁）
select ... lock in share mode;
//排他锁（独占锁、X型锁）
select ... for update;
insert、update、delete
```

不同隔离级别下，行级锁的种类是不同的。

在读已提交隔离级别下，行级锁的种类只有记录锁，也就是仅仅把一条记录锁上。

在可重复读隔离级别下，行级锁的种类除了有记录锁，还有间隙锁（目的是为了避免幻读），所以行级锁的种类主要有三类：

- Record Lock，记录锁，也就是仅仅把一条记录锁上，有S锁和X锁之分；
- Gap Lock，间隙锁，锁定一个范围，但是不包含记录本身；
- Next-Key Lock：Record Lock + Gap Lock 的组合，锁定一个范围，并且锁定记录本身。

行锁**加锁的对象是索引，加锁的基本单位是 next-key lock**，它是由记录锁和间隙锁组合而成的，**next-key lock 是前开后闭区间，而间隙锁是前开后开区间**。

**在线上在执行 update、delete、select ... for update 等具有加锁性质的语句，一定要检查语句是否走了索引，如果没走索引是全表扫描的话，会对每一个索引加 next-key 锁，相当于把整个表锁住了**，一旦锁住了整张表，并发性能必然大大下降

#### 死锁的四个条件

- 互斥
- 占有并等待
- 不可剥夺
- 循环等待

# SQL优化

### insert

不要一条一条语句insert，可以批量插入，一条sql语句插入多个数据 比如：insert into user values(1,'Tom'),(2,'Bob'),(3,'Jack'); 为什么？因为每一条insert都是一次与数据库建立TCP链接进行网络传输的过程，当然是合到一条insert中节约资源

手动提交事务，减少事务开启提交的耗时

主键顺序插入，性能高于乱序插入，见下文

对于大批量的数据插入，不要用insert了，而用load指令。要使用load指令需要在连接数据库指令加上--local-infile，同时设置全局参数local-infile = 1，开启从本地文件加载的开关，最后使用load指令

### 主键优化

主键顺序插入

- 插入数据时有页分裂现象，删除元素时有页合并现象，乱序插入页分裂情况就会很多，比较耗时

降低主键长度，因为主键在二级索引中是作为叶子结点的值存储的，key是二级索引，值是主键，主键太长了浪费空间

比如UUID和身份证号码就不适合做主键，1是这两个玩意都无序，2是太长了

### order by优化

order by查询，查出来的有序结果，通常是innodb根据两种情况来帮你排序的：

- using filesort：查询出来数据行，在排序缓冲区sort buffer中排序完再返回给你，性能低
- using index：查询出来的就是索引中有序数据，不需要再额外排序了，性能高

首先查询的字段必须走覆盖索引，如果查询*的话，需要回表查询，那么就不可能直接查出来的数据就是using index的了，必定会using filesort重新排序。

其次就是你想让数据using index的话，比如`select id,age,phone from tb_user order by age asc, phone desc`，你可以给age和phone创建联合索引，`create index idx_user_age_phone on tb_user(age asc, phone desc);` 这样就可以保证走的是按照你索引排序规则的覆盖索引，提升效率，本质上还是空间换时间

![联合索引，键是联合字段，值是id](orderby优化.png)

补充一点就是不可避免使用filesort的时候，可以适当增加排序缓冲区的大小

### group by优化

为分组字段创建合适的索引，多字段分组查询的话也是满足最左前缀法则的

### limit优化

limit分页查询时，查询的起点非常大时查询的效率就会很低，比如`select * from tb_user limit 10000000,10;`，返回10000000~10000010的数据

可以通过覆盖索引+子查询优化，具体说来就是不要直接查询全部数据了，因为会导致回表查询，先直接查询id，`select id from tb_user order by id limit 10000000,10; `再根据查出来的id集去查对应的数据，两种形式：

```sql
select * from tb_user where id in (select id from tb_user order by id limit 10000000,10);
select t.* from tb_user t, (select id from tb_user order by id limit 10000000,10) s where t.id = s.id;
```

### count优化

count函数的参数可以count(*)，count(字段)，count(主键)，count(123这种数字)，每一种的性能都是不同的

count(*)innodb引擎不会把字段全部取出来，而是服务层直接按行进行累加

count(1)也不取值出来，服务层每行放一个数字1，然后按行进行累加

count(主键)innodb引擎遍历全表，取出每一行的主键返回给服务层，服务层按行累加

count(字段)会遍历全表取出每一行的字段值，根据字段有没有not null约束服务层来判断，然后累加

所以性能上count(*)≈count(1)>count(主键)>count(字段)

### update优化

见行锁
