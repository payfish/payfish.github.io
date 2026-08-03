---
title: Dubbo序列化问题与解决记录
date: 2024-08-07 14:28:27
tags: Dubbo
category: 微服务组件

---

在使用Dubbo调用服务时出现了异常:

```
Fail to decode request due to: RpcInvocation [methodName=queryItemByIds, parameterTypes=null]
```

服务提供方也报错：

```shell
org.apache.dubbo.common.serialize.SerializationException: com.alibaba.fastjson2.JSONException: create instance error interface java.util.Set, offset 7
```

调用该服务的代码：

```java
Map<Long, Integer> itemNumMap = detailDTOS.stream()
        .collect(Collectors.toMap(OrderDetailDTO::getItemId, OrderDetailDTO::getNum));
Set<Long> itemIds = itemNumMap.keySet();
//查询商品
List<ItemDTO> items = itemService.queryItemByIds(itemIds);
```

而另一个消费者调用该服务是正常的：

```java
Set<Long> itemIds = vos.stream().map(CartVO::getItemId).collect(Collectors.toSet());
//查询商品
List<ItemDTO> items = itemService.queryItemByIds(itemIds);
```

对比了一下应该是传入参数Set的类型不一致导致的异常，失败的调用传入的参数是keySet，只是Map的一个集合视图，无法被Dubbo序列化和反序列化，修改为HashSet后就可以成功调用了：

```java
Set<Long> itemIds = new HashSet<>(itemNumMap.keySet());
```

