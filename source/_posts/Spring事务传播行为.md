---
title: Spring事务传播行为
date: 2024-10-04 11:11:59
tags: Spring
category: SpringBoot

---

### 概述

在一个Service中含有事务的方法里调用另一个Service有事务的方法时，此时BService中的事务被传播到了AService，这就是事务的传播

```java
@Service
public class AService {
    
    @Autowired
    private BService bservice;
    
    @Transanctional
    public void order() {
        yyyyy();
        bservice.xxx();
        zzzzz();
    }
}
```

生成的sql可能如下：

```sql
begin;
   update yyyy;
   begin;
      update xxxx;
   commit;
   update zzzz;
commit;
```

由于MySQL是不支持嵌套事务的，第二个事务开启时会隐式地将第一个事务提交。所以Spring对这种事务的传播做一些微调，具体有如下：

- 融入事务：直接去掉BService中关于开启事务和提交事务的begin和commit语句，将BService的代码融入到AService的事务中。问题：B事务的错误会引起A事务的回滚。 

- 挂起事务：如果不想B事务的错误引起A事务的回滚，可以开启两个连接，一个执行A事务一个执行B，互不影响，执行到B的时候把A事务挂起，建立新连接去执行B，B执行完了再唤醒A执行。 

- 嵌套事务：将B事务的开启和提交替换为savepoint和rollback去模拟嵌套事务，把B设置成伪事务。这样既不影响A事务的正常运行，B事务出问题了也可以回滚到保存点。（MYSQL支持保存点模拟嵌套事务，其他数据库可能直接支持嵌套事务）

  ```sql
  begin;
     update yyyy;
     savepoint a;
        update xxxx;
     rollback to a;
     update zzzz;
  commit;
  ```

### 事务传播

- REQUIRED：（默认传播行为），表示当前方法需要事务，如果AService存在事务，则BService的事务融入AService的事务，如果AService不存在事务，BService自己新建事务运行。
- SUPPORTS：如果AService存在事务，支持当前事务，融入运行，如果没有事务，则非事务执行，
- REQUIRES_NEW ：BService开启一个新的事务执行。如果AService已经存在一个事务，则先将这个存在的事务挂起
- MANDATORY：（强制性的必须在事务中执行）如果已经存在一个事务，支持当前事务。如果没有一个活动的事务，则抛出异常 
- NOT_SUPPORTED ：（不支持事务）总是非事务地执行，并挂起任何存在的事务
- NEVER：不会运行在有事务的环境，若有事务直接抛出异常
- NESTED ：如果一个活动的事务存在，则运行在一个嵌套的事务中。如果没有活动事务, 则按 REQUIRED 属性执行。 不同厂商对于嵌套事务的支持是不一样的。
  
