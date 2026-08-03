---
title: Feed流
date: 2024-08-18 14:28:02
tags: Feed流

---

### 什么是Feed流

完成了一个需求，展示关注的人发布的博文，这里面就涉及到Feed流系统的设计。Feed 流产品在我们手机APP中几乎无处不在，比如微信朋友圈、新浪微博、今日头条等。只要大拇指不停地往下划手机屏幕，就有一条条的信息不断涌现出来。就像给宠物喂食一样，只要它吃光了就要不断再往里加，故此得名Feed（饲养）。

#### 定义

- Feed：Feed流中的每一条消息或者状态都是Feed，比如你微博关注的明星发布的微博，朋友圈朋友发的一篇文章
- Feed流：将用户主动订阅的若干消息源组合在一起形成内容聚合器，帮助用户持续地获取最新的订阅源内容

#### 分类

- TimeLine：基于关注关系并按时间排列，按照Feed流内容更新的时间先后顺序，将内容展示给用户，早期的微博、朋友圈都是典型的timeline。
- Rank：基于算法推荐，按照某些因素计算内容的权重，以决定展示内容的先后顺序

### Feed模式

#### push

推模式：作者发布新的动态时，要推送给其所有的粉丝。

优点：每次用户想要读取关注作者的文章都可以从自己的收件箱直接读取，读取延时低

缺点：内存占用高，一个作者的动态要写N份到其粉丝的收件箱中，逻辑复杂，粉丝数多的时候会是灾难

#### pull

拉模型：作者发布动态时只发送到自己的发件箱，用户拉取关注的每个作者的动态，聚合后展示

优点：拉模型不需要存储额外的数据，逻辑简单

缺点：每次用户想要读取关注作者的文章，都需要重新拉取，读取延迟较高，关注人数多的时候会出现灾难

#### 推拉结合

- 推只推给活跃粉丝
- 僵尸粉只配自己拉

### 基于推模式实现Feed流实战

使用Redis的ZSet作为粉丝的收件箱，使用时间戳对博文排序，Key为博文id

```java
//feed博文id到所有粉丝收件箱
List<Follow> followUsers = followService.query().eq("follow_user_id", user.getId()).list();
for (Follow follow : followUsers) {
    Long userId = follow.getUserId();
    String key = FEED_KEY + userId;
    stringRedisTemplate.opsForZSet().add(key, blog.getId().toString(), System.currentTimeMillis());
}
```

粉丝在查询自己的收件箱时可能出现分页问题。Feed流本质上是一个动态列表，列表内容会随着时间不断变化。传统的前端分页参数使用page_size和page_num，分表表示每页几条，以及当前是第几页，对于静态列表没问题，但是对于一个动态列表，可能会出现分页时还有人新发布笔记的情况，如果继续按照数据的角标分页，就会导致重复展示之前页面展示过的数据。

比如当前列表blogId为（5、4、3、2、1），一页展示三条，第一页就是（5、4、3），此时发布了新的博客（id = 6）并推送到了Redis收件箱：（6、5、4、3、2、1），按照角标的话，第二页就会展示（3、2、1），重复查询了id = 3 的博客

所以这里采用上一页的最后一项（比如5、4、3、3、2、1，一页三条的话最后一项就是3）来标记下一页的起始位置，同时指定一个offset（这里有2个3）用来跳过已经在上一页末尾显示过的重复项

```java
/**
 * 粉丝接收feed流
 * @param max
 * @param offset
 * @return
 */
@Override
public Result queryBlogFollow(Long max, Integer offset) {
    Long userId = UserHolder.getUser().getId();
    String key = FEED_KEY + userId;
    //查询自己的收件箱
    Set<ZSetOperations.TypedTuple<String>> typedTuples = stringRedisTemplate.opsForZSet().
            reverseRangeByScoreWithScores(key, 0, max, offset, 2);
    if (typedTuples == null || typedTuples.isEmpty()) {
        return Result.ok(Collections.emptyList());
    }
    //解析数据：blogId，时间戳, offset
    long minTime = 0;
    int offset1 = 1;
    List<Long> blogIds = new ArrayList<>(typedTuples.size());
    for (ZSetOperations.TypedTuple<String> typedTuple : typedTuples) {
        blogIds.add(Long.valueOf(typedTuple.getValue()));
        long t = typedTuple.getScore().longValue();
        if (t == minTime) {
            offset1 += 1;
        } else {
            minTime = t;
            offset1 = 1;
        }
    }
    //根据blogIds查询对应的blog，添加blog的点赞信息，封装滚动分页查询对象返回
    String idStr = StrUtil.join(",", blogIds);
    List<Blog> blogs = query()
            .in("id", blogIds)
            .last("ORDER BY FIELD(id," + idStr + ")").list();
    for (Blog blog : blogs) {
        updateBlogByUserInfo(blog);
        isBlogLiked(blog);
    }
    ScrollResult scrollResult = new ScrollResult();
    scrollResult.setList(blogs);
    scrollResult.setOffset(offset1);
    scrollResult.setMinTime(minTime);
    return Result.ok(scrollResult);
}
```
